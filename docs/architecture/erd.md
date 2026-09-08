# ERD và integrity rules của MVP

```mermaid
erDiagram
  USER ||--o{ USER_ROLE : has
  ROLE ||--o{ USER_ROLE : grants
  USER ||--o{ REFRESH_SESSION : owns
  USER ||--o{ OWNER_APPLICATION : submits
  USER ||--o{ VENUE : owns
  AREA ||--o{ AREA : contains
  AREA ||--o{ VENUE : locates
  VENUE ||--o{ VENUE_IMAGE : has
  VENUE ||--o{ VENUE_AMENITY : has
  AMENITY ||--o{ VENUE_AMENITY : describes
  VENUE ||--o{ OFFERING : offers
  SPORT ||--o{ OFFERING : categorizes
  OFFERING ||--o{ COURT : contains
  VENUE ||--o{ OPERATING_HOUR : opens
  VENUE ||--o{ CLOSURE : closes
  COURT o|--o{ CLOSURE : may_close
  OFFERING ||--o{ PRICING_RULE : prices
  USER ||--o{ BOOKING : creates
  OFFERING ||--o{ BOOKING : requested_for
  COURT ||--o{ BOOKING : assigned_to
  BOOKING ||--o{ BOOKING_STATUS_HISTORY : records
  USER ||--o{ NOTIFICATION : receives
  USER ||--o{ IDEMPOTENCY_RECORD : submits
  USER ||--o{ AUDIT_LOG : acts

  USER { uuid id PK string email UK string phone string displayName string passwordHash boolean isLocked int securityVersion }
  REFRESH_SESSION { uuid id PK uuid userId FK uuid familyId string tokenHash datetime expiresAt datetime revokedAt }
  OWNER_APPLICATION { uuid id PK uuid userId FK string status string businessName string reason uuid reviewedById FK }
  AREA { uuid id PK string code UK string name string type uuid parentId FK }
  VENUE { uuid id PK uuid ownerId FK uuid areaId FK string name string address decimal latitude decimal longitude string status string moderationReason }
  OFFERING { uuid id PK uuid venueId FK uuid sportId FK string confirmationMode int advanceBookingDays int cancellationNoticeMinutes }
  COURT { uuid id PK uuid offeringId FK string internalName boolean isActive }
  OPERATING_HOUR { uuid id PK uuid venueId FK int weekday int startMinute int endMinute }
  CLOSURE { uuid id PK uuid venueId FK uuid courtId FK datetime startAt datetime endAt string reason }
  PRICING_RULE { uuid id PK uuid offeringId FK int weekday int startMinute int endMinute bigint pricePerSlot }
  BOOKING { uuid id PK uuid customerId FK uuid offeringId FK uuid courtId FK datetime startAt datetime endAt string status datetime expiresAt boolean occupiesCourt bigint priceAmount string currency int slotMinutes int cancellationNoticeMinutes string confirmationModeSnapshot json pricingBreakdown string cancellationReason }
  BOOKING_STATUS_HISTORY { uuid id PK uuid bookingId FK string fromStatus string toStatus uuid actorId FK string actorType string reason }
  IDEMPOTENCY_RECORD { uuid id PK uuid actorId FK string scope string key string requestHash uuid resourceId int responseStatus json responseBody }
  NOTIFICATION { uuid id PK uuid userId FK string type json payload datetime readAt }
  OUTBOX_EVENT { uuid id PK string aggregateType uuid aggregateId string eventType json payload datetime availableAt datetime dispatchedAt string lastError }
  PROCESSED_EVENT { uuid eventId PK string processorName datetime processedAt }
  AUDIT_LOG { uuid id PK uuid actorId FK string action string resourceType uuid resourceId json beforeData json afterData }
```

## Database invariants và index

- `users.email` lưu lowercase và unique; `roles.name` unique; `(user_id, role_id)` unique.
- Chỉ một owner application active (`PENDING`) trên mỗi user.
- `(venue_id, sport_id)` unique; `(offering_id, internal_name)` unique; `courts` có unique `(id, offering_id)` để booking dùng composite foreign key `(court_id, offering_id)`.
- `start_minute >= 0`, `end_minute <= 1440`, `start_minute < end_minute`; operating windows cùng venue/weekday không overlap.
- Pricing dùng exclusion constraint `(offering_id WITH =, weekday WITH =, int4range(start_minute,end_minute,'[)') WITH &&)`.
- Booking yêu cầu `start_at < end_at`, `court_id NOT NULL`, và `occupies_court = (status IN ('PENDING','CONFIRMED'))`.
- Booking dùng exclusion constraint `(court_id WITH =, tstzrange(start_at,end_at,'[)') WITH &&) WHERE (occupies_court)`.
- `(actor_id, scope, key)` unique cho idempotency; cùng key khác `request_hash` bị service từ chối.
- Outbox có index `(dispatched_at, available_at)`; notification có index `(user_id, read_at, created_at)`; mọi foreign key/filter chính có index.
- History có `actorType=USER|SYSTEM`; `actorId` nullable và chỉ bắt buộc với actor USER. Expiration/completion dùng SYSTEM.
- Mọi bảng nghiệp vụ có `createdAt`, `updatedAt` khi phù hợp. Migration bật extension `btree_gist` trước các exclusion constraint.
