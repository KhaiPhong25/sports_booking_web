# API contract sơ bộ

Mọi endpoint nằm dưới `/api/v1`; Swagger UI ở `/docs`, OpenAPI JSON ở `/docs-json`. List trả `{ items, page, pageSize, total }`; `page >= 1`, `1 <= pageSize <= 100`, sort/filter chỉ nhận giá trị whitelist. Mọi tiền VND trong JSON là number safe-integer.

## Public và authentication

| Method | Path                                  | Input chính                                  | Output chính                              |
| ------ | ------------------------------------- | -------------------------------------------- | ----------------------------------------- |
| POST   | `/auth/register`                      | `{email,password,phone,displayName}`         | `201 {accessToken,user}` + refresh cookie |
| POST   | `/auth/login`                         | `{email,password}`                           | `200 {accessToken,user}` + refresh cookie |
| POST   | `/auth/refresh`                       | refresh cookie                               | access token mới + cookie xoay vòng       |
| POST   | `/auth/logout`                        | refresh cookie                               | `204`                                     |
| GET    | `/sports`                             | —                                            | sport list                                |
| GET    | `/areas`                              | —                                            | area list                                 |
| GET    | `/amenities`                          | —                                            | amenity list                              |
| GET    | `/catalog`                            | —                                            | sports + areas + amenities                |
| GET    | `/venues`                             | `sportId,areaId,startAt,endAt,page,pageSize` | public venue results đủ capacity          |
| GET    | `/venues/:venueId`                    | —                                            | approved venue detail                     |
| GET    | `/offerings/:offeringId/availability` | `startAt,endAt`                              | `{available,capacity}`                    |
| POST   | `/offerings/:offeringId/quotes`       | `{startAt,endAt}`                            | `{amount,currency,breakdown}`             |
| GET    | `/users/:userId/avatar`               | —                                            | binary JPEG/PNG/WebP hoặc `404`           |

Public không được gọi `POST /bookings`.

Public venue list/detail trả mỗi offering với `sportId` để lọc và `sportName` để giao diện hiển thị tên dễ đọc; không lộ tên court vật lý. `latitude`/`longitude` thuộc venue dùng cho map adapter, còn tile map không đi qua API nghiệp vụ.

## Customer

| Method | Path                          | Input chính                                            | Output chính               |
| ------ | ----------------------------- | ------------------------------------------------------ | -------------------------- |
| GET    | `/me`                         | bearer token                                           | profile + roles            |
| PATCH  | `/me`                         | `{displayName,phone}`                                  | profile                    |
| POST   | `/me/avatar`                  | multipart field `avatar`                               | profile có `avatarUrl` mới |
| DELETE | `/me/avatar`                  | bearer token                                           | `204`                      |
| PATCH  | `/me/password`                | `{currentPassword,newPassword}`                        | `204` + xóa refresh cookie |
| POST   | `/bookings`                   | header `Idempotency-Key`; `{offeringId,startAt,endAt}` | booking snapshot           |
| GET    | `/bookings`                   | `status?,from?,to?,page,pageSize,sort`                 | booking list của principal |
| GET    | `/bookings/:bookingId`        | —                                                      | booking của principal      |
| POST   | `/bookings/:bookingId/cancel` | `{reason?}`                                            | booking mới nhất           |
| GET    | `/notifications`              | `unread?,page,pageSize`                                | notification list          |
| POST   | `/notifications/:id/read`     | —                                                      | notification               |
| POST   | `/owner-applications`         | `{businessName,experience}`                            | application                |
| GET    | `/owner-applications`         | `page,pageSize`                                        | applications của principal |

Profile response chỉ trả `id`, `email`, `phone`, `displayName`, `roles` và `avatarUrl`; không trả password hash, storage object key hoặc security version. `email` và `roles` là read-only. Avatar nhận JPEG, PNG hoặc WebP tối đa 2 MiB, kiểm tra cả MIME và file signature. Binary nằm trong MinIO; client đọc ảnh qua public `GET /users/:userId/avatar`, còn `avatarUrl` có query version để tránh cache cũ. Xóa avatar là idempotent.

`newPassword` phải dài 12–128 ký tự. Đổi mật khẩu thành công tăng security version, revoke mọi refresh session, xóa refresh cookie và khiến access token cũ bị từ chối; giao diện xóa session local rồi chuyển tới `/login?reason=password-changed` để đăng nhập lại.

## Owner

Owner CRUD đều kiểm tra resource thuộc venue của principal.

- `GET /owner/venues`; `POST /owner/venues`; `GET|PATCH|DELETE /owner/venues/:venueId`.
- Venue mới là `PENDING_APPROVAL`; PATCH venue `APPROVED` chuyển ngay về `PENDING_APPROVAL`.
- `PUT /owner/venues/:venueId/amenities`; `POST /owner/venues/:venueId/images` multipart.
- `POST /owner/venues/:venueId/offerings`; `PATCH /owner/offerings/:offeringId`.
- `POST /owner/offerings/:offeringId/courts`; `PATCH /owner/courts/:courtId`; `PATCH /owner/courts/:courtId/active`.
- `GET|PUT /owner/venues/:venueId/operating-hours`; PUT body `{windows:[{weekday,startMinute,endMinute}]}`.
- `GET|POST /owner/venues/:venueId/closures`; `PATCH|DELETE /owner/closures/:closureId`.
- `GET|POST /owner/offerings/:offeringId/pricing-rules`; `PATCH|DELETE /owner/pricing-rules/:ruleId`.
- `GET /owner/bookings?venueId=&status=&from=&to=&page=&pageSize=&sort=`.
- `GET /owner/bookings/:id` trả booking thuộc venue của owner, gồm `customer: {displayName,email,phone}` phục vụ vận hành. Customer booking response không có object liên hệ này; booking của owner khác trả `404`.
- `POST /owner/bookings/:id/confirm` (empty body), `/reject` (`{reason}`), `/cancel` (`{reason}`), `/reassign` (`{courtId}`).

Archive/disable hoặc tạo closure trả `409 RESOURCE_HAS_ACTIVE_BOOKINGS` nếu chồng `PENDING`/`CONFIRMED` tương lai. Reassign khóa old/target theo UUID ổn định, target phải cùng offering, active và không overlap.

## Admin

- `GET /admin/users?query=&locked=&role=&page=&pageSize=`.
- `PATCH /admin/users/:userId/lock`; `PATCH /admin/users/:userId/unlock`.
- `GET /admin/owner-applications?status=&page=&pageSize=`; `POST /admin/owner-applications/:id/approve` (empty); `/reject` body `{reason}`.
- `GET /admin/venues?status=&page=&pageSize=`; `POST /admin/venues/:id/approve` (empty); `/reject` và `/hide` body `{reason}`.
- `GET /admin/audit-logs?action=&actorId=&resourceType=&resourceId=&page=&pageSize=&sort=`.

Admin chỉ moderation, không CRUD catalog thay owner và không hủy booking mặc định.
Approve/reject venue chỉ hợp lệ từ `PENDING_APPROVAL`; hide chỉ hợp lệ từ `APPROVED`. Quyết định dùng compare-and-set theo status nguồn nên hai admin thao tác đồng thời chỉ có một quyết định được commit và ghi audit.

## Notification và xử lý nền

Mutation booking tạo in-app notification và outbox event trong cùng PostgreSQL transaction. API không gọi SMTP trực tiếp. Outbox relay đưa event tới một trong hai BullMQ queue `notifications` và `booking-lifecycle`, dùng UUID của event làm `jobId` để enqueue lặp không tạo công việc logic mới. Event đã dispatch nhưng chưa có `processed_events` receipt sẽ được replay từ PostgreSQL sau một khoảng trễ; Redis local đồng thời bật AOF và volume.

- Email retry tối đa 5 lần với exponential backoff bắt đầu từ 1 giây. Sau lần cuối, worker ghi terminal receipt bền vững để reconciliation không tạo lại một chu kỳ retry mới. Trạng thái giao nhận nằm trên notification (`PENDING`, `SENT`, `FAILED`); lỗi SMTP không rollback booking. Advisory lock serialize các delivery cùng notification. SMTP có semantics at-least-once: crash đúng lúc SMTP đã nhận nhưng receipt PostgreSQL chưa commit vẫn có thể tạo email trùng.
- Booking `PENDING` có event expiration tại `expiresAt`; booking `CONFIRMED` có event completion tại `endAt`.
- Lifecycle worker khóa booking row, kiểm tra expected status và ghi `processed_events`, status history, notification mới trong một transaction. Event chạy lại hoặc thua race với confirm/cancel trở thành no-op an toàn.
- `GET /notifications` và mark-read luôn lấy `userId` từ bearer principal. ID của user khác trả `404`, không làm lộ resource.

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
