# API contract sơ bộ

Mọi endpoint nằm dưới `/api/v1`; Swagger UI ở `/docs`, OpenAPI JSON ở `/docs-json`. List trả `{ items, page, pageSize, total }`; `page >= 1`, `1 <= pageSize <= 100`, sort/filter chỉ nhận giá trị whitelist. Mọi tiền VND trong JSON là number safe-integer.

## Public và authentication

| Method | Path | Input chính | Output chính |
|---|---|---|---|
| POST | `/auth/register` | `{email,password,phone,displayName}` | `201 {user}` |
| POST | `/auth/login` | `{email,password}` | `200 {accessToken,user}` + refresh cookie |
| POST | `/auth/refresh` | refresh cookie | access token mới + cookie xoay vòng |
| POST | `/auth/logout` | refresh cookie | `204` |
| GET | `/sports` | — | sport list |
| GET | `/areas` | `parentId?` | area list |
| GET | `/venues` | `sportId,areaId,startAt,endAt,page,pageSize,sort` | public venue results đủ capacity |
| GET | `/venues/:venueId` | — | approved venue detail |
| GET | `/offerings/:offeringId/availability` | `startAt,endAt` | `{available,capacity}` |
| POST | `/offerings/:offeringId/quotes` | `{startAt,endAt}` | `{amount,currency,breakdown}` |

Public không được gọi `POST /bookings`.

## Customer

| Method | Path | Input chính | Output chính |
|---|---|---|---|
| GET | `/me` | bearer token | profile + roles |
| PATCH | `/me` | `{displayName,phone}` | profile |
| POST | `/bookings` | header `Idempotency-Key`; `{offeringId,startAt,endAt}` | booking snapshot |
| GET | `/bookings` | `status?,from?,to?,page,pageSize,sort` | booking list của principal |
| GET | `/bookings/:bookingId` | — | booking của principal |
| POST | `/bookings/:bookingId/cancel` | `{reason?}` | booking mới nhất |
| GET | `/notifications` | `unread?,page,pageSize` | notification list |
| POST | `/notifications/:id/read` | — | notification |
| POST | `/owner-applications` | `{businessName,experience}` | application |
| GET | `/owner-applications/me` | — | application gần nhất |

## Owner

Owner CRUD đều kiểm tra resource thuộc venue của principal.

- `GET /owner/venues`; `POST /owner/venues`; `GET|PATCH /owner/venues/:venueId`; `POST /owner/venues/:venueId/archive`.
- PATCH venue `APPROVED` chuyển ngay sang `PENDING_APPROVAL`; `POST /owner/venues/:venueId/submit` chỉ chuyển draft/rejected sang `PENDING_APPROVAL`.
- `POST /owner/venues/:venueId/images` multipart; `DELETE /owner/venues/:venueId/images/:imageId`.
- `GET|POST /owner/venues/:venueId/offerings`; `GET|PATCH /owner/offerings/:offeringId`; `POST /owner/offerings/:offeringId/archive`.
- `GET|POST /owner/offerings/:offeringId/courts`; `PATCH /owner/courts/:courtId`; `POST /owner/courts/:courtId/activate|deactivate`.
- `GET|PUT /owner/venues/:venueId/operating-hours`; PUT body `{windows:[{weekday,startMinute,endMinute}]}`.
- `GET|POST /owner/venues/:venueId/closures`; `PATCH|DELETE /owner/closures/:closureId`.
- `GET|POST /owner/offerings/:offeringId/pricing-rules`; `PATCH|DELETE /owner/pricing-rules/:ruleId`.
- `GET /owner/bookings?venueId=&status=&from=&to=&page=&pageSize=&sort=`.
- `POST /owner/bookings/:id/confirm` (empty body), `/reject` (`{reason}`), `/cancel` (`{reason}`), `/reassign` (`{courtId}`).

Archive/disable hoặc tạo closure trả `409 RESOURCE_HAS_ACTIVE_BOOKINGS` nếu chồng `PENDING`/`CONFIRMED` tương lai. Reassign khóa old/target theo UUID ổn định, target phải cùng offering, active và không overlap.

## Admin

- `GET /admin/users?query=&locked=&role=&page=&pageSize=`.
- `POST /admin/users/:userId/lock` body `{reason}`; `POST /admin/users/:userId/unlock` body `{reason}`.
- `GET /admin/owner-applications?status=&page=&pageSize=`; `POST /admin/owner-applications/:id/approve` (empty); `/reject` body `{reason}`.
- `GET /admin/venues?status=&page=&pageSize=`; `POST /admin/venues/:id/approve` (empty); `/reject` và `/hide` body `{reason}`.
- `GET /admin/audit-logs?action=&actorId=&resourceType=&resourceId=&page=&pageSize=&sort=`.

Admin chỉ moderation, không CRUD catalog thay owner và không hủy booking mặc định.

## Error và idempotency

Status code: `201` create, `200` query/action, `204` delete/logout, `400` validation/policy, `401` unauthenticated, `403` role/ownership, `404` hidden/absent, `409` duplicate/conflict/no capacity, `422` pricing coverage, `429` rate limit.

```json
{
  "code": "BOOKING_NO_CAPACITY",
  "message": "Không còn sân trống trong khoảng thời gian đã chọn.",
  "details": {},
  "requestId": "01J..."
}
```

Booking idempotency canonicalize `{offeringId,startAtUtc,endAtUtc}` rồi hash SHA-256. Cùng actor/scope/key và cùng hash trả lại status/body đã lưu; khác hash trả `409 IDEMPOTENCY_KEY_REUSED`; request đồng thời được serialize qua unique constraint và row lock.

Các error code cốt lõi: `VALIDATION_FAILED`, `AUTH_INVALID_CREDENTIALS`, `AUTH_ACCOUNT_LOCKED`, `AUTH_TOKEN_REUSED`, `FORBIDDEN`, `RESOURCE_NOT_FOUND`, `VENUE_NOT_PUBLIC`, `PRICING_NOT_COVERED`, `BOOKING_NO_CAPACITY`, `BOOKING_INVALID_TRANSITION`, `BOOKING_HOLD_EXPIRED`, `BOOKING_CANCELLATION_WINDOW_CLOSED`, `RESOURCE_HAS_ACTIVE_BOOKINGS`, `IDEMPOTENCY_KEY_REUSED`.
