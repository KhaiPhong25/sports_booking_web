# Phase 06 — Availability và booking an toàn đồng thời

## Mục tiêu và những gì đã xây

- Public tìm venue theo sport, area và interval; xem availability/capacity mà không đăng nhập.
- Chỉ user đã đăng nhập mới tạo, xem hoặc hủy booking.
- Server tự chọn physical court; response customer không lộ court nội bộ, response owner có court.
- Hỗ trợ `INSTANT` và `OWNER_APPROVAL` với hold 30 phút.
- Booking state machine tập trung, cancel policy, owner confirm/reject/cancel và reassignment.
- Idempotency key chống booking trùng khi client retry.
- PostgreSQL transaction, row lock và exclusion constraint chống double booking.
- UI public search/quote/create, customer booking list và owner booking actions.

## Correctness và lựa chọn thiết kế

Create-booking chạy trong transaction `Serializable`. Nó lock venue → offering, chủ động expire stale `PENDING`, chọn court active/free bằng `FOR UPDATE SKIP LOCKED`, tính giá authoritative rồi insert booking, history và idempotency record. Nếu transaction serialization/deadlock, service retry tối đa ba lần.

Database có hai invariant quan trọng:

- `occupiesCourt` chỉ đúng với `PENDING|CONFIRMED`.
- Exclusion constraint trên `courtId + tstzrange(startAt,endAt,'[)')` cấm hai booking đang chiếm cùng court overlap.

Pending quá hạn vẫn giữ court cho tới khi một transaction chuyển cả status và flag sang `EXPIRED`. Search/create chủ động làm việc này nên không phụ thuộc worker Phase 7 chạy đúng giây. Update expiration có điều kiện trên trạng thái cũ, vì vậy nhiều request cùng quét một hold cũng chỉ ghi đúng một history row.

## Luồng request/data

1. Browser gửi `offeringId`, `startAt`, `endAt` và header `Idempotency-Key`; không có price/court/owner.
2. Guard đọc user hiện tại, kể cả trạng thái account lock.
3. Time policy kiểm tra grid 30 phút, duration 60–240 phút, lead time 60 phút, advance horizon và một business date.
4. Pricing engine kiểm tra operating hours/closure/coverage và tạo snapshot.
5. Transaction khóa/chọn court, insert booking + history + idempotency.
6. Owner action lock booking; state policy từ chối transition sai. Reassignment lock old/target court theo UUID tăng dần.
7. Cancellation dùng notice snapshot trên chính booking, không dùng policy mới sửa.

## File quan trọng

- `apps/api/src/bookings/bookings.service.ts`
- `apps/api/src/bookings/booking-state-policy.ts`, `booking-time-policy.ts`
- `apps/api/prisma/migrations/20260909230000_booking_constraints/migration.sql`
- `apps/api/prisma/migrations/20260909233000_booking_expiry_invariant/migration.sql`
- `apps/api/test/booking-concurrency.integration-spec.ts`
- `apps/api/test/scheduling-booking-api.integration-spec.ts`
- `apps/web/src/pages/bookings.js`, `apps/web/src/pages/venues.js`

## Chạy và test

```bash
npm test -w @sports-booking/api -- --runInBand src/bookings
DATABASE_URL='postgresql://...' npm run db:migrate -w @sports-booking/api
TEST_DATABASE_URL='postgresql://...' npm run test:integration -w @sports-booking/api
npm test -w @sports-booking/web -- src/pages/bookings.test.js src/pages/venues.test.js
```

Concurrency suite gửi nhiều request overlap hơn tổng capacity, chọc thẳng DB để kiểm tra constraint, kiểm tra interval chạm biên, stale pending đồng thời, reassignment overlap/hết hạn, owner cancel sau giờ bắt đầu và race create-booking/deactivate-court.

## Lỗi thường gặp và bảo mật

- “Check availability rồi insert” không đủ; hai request có thể cùng thấy một court.
- Redis lock không thay thế database constraint vì PostgreSQL mới là source of truth.
- Không dùng `now()` trong predicate partial index; cờ `occupiesCourt` được state transition cập nhật atomically.
- Cùng idempotency key nhưng payload khác phải trả `IDEMPOTENCY_KEY_REUSED`.
- Owner role chưa đủ: mọi booking action còn so sánh owner của venue.
- Quote thành công không đảm bảo court còn trống ở thời điểm create; create luôn revalidate.

## Câu hỏi tự kiểm tra

1. Exclusion constraint bảo vệ điều gì mà row lock chưa chắc bảo vệ?
2. Vì sao interval `[10:00,11:00)` không conflict `[11:00,12:00)`?
3. Vì sao stale pending phải đổi cả `status` và `occupiesCourt` trong một transaction?
4. Idempotency key khác gì với kiểm tra double-booking?
