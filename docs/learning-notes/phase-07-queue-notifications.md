# Phase 07 — Queue và notifications

## Đã xây dựng gì

Phase này thêm một đường xử lý nền hoàn chỉnh cho booking:

- Booking create/confirm/reject/cancel ghi in-app notification và outbox event cùng transaction.
- Customer có API liệt kê notification, lọc chưa đọc và đánh dấu đã đọc.
- Outbox relay dùng PostgreSQL row lock `FOR UPDATE SKIP LOCKED`, sau đó đưa job sang BullMQ.
- Worker gửi email qua Nodemailer/MailHog và tự retry với exponential backoff.
- Worker tự động chuyển booking `PENDING` quá hạn sang `EXPIRED` và booking `CONFIRMED` đã kết thúc sang `COMPLETED`.
- `processed_events`, expected status và row lock giúp job chạy lặp vẫn an toàn.

## Vì sao chọn transactional outbox

Nếu API commit booking rồi gọi Redis/SMTP trực tiếp, process có thể chết ở giữa: booking đã tồn tại nhưng notification bị mất. Nếu gửi email trước rồi transaction rollback, user lại nhận email cho booking không tồn tại.

Transactional outbox giải quyết bằng cách ghi booking, notification và ý định gửi job trong cùng PostgreSQL transaction. Sau commit, relay mới chuyển event sang Redis. Redis và SMTP có thể tạm ngừng mà dữ liệu nghiệp vụ vẫn bền vững trong PostgreSQL.

BullMQ `jobId` bằng UUID của outbox event. Enqueue lại cùng event không tạo một công việc logic khác. Tuy nhiên queue-level deduplication chưa đủ, vì job hoàn thành có thể bị dọn; mỗi processor vẫn phải kiểm tra trạng thái bền vững.

## Luồng request và dữ liệu

1. Customer hoặc owner gọi booking action.
2. `BookingsService` khóa/kiểm tra booking, cập nhật state và gọi `NotificationPublisher` trong cùng Prisma transaction.
3. Publisher tạo `notifications` và `outbox_events`. Expiration/completion event có `availableAt` đúng thời điểm cần chạy.
4. Worker relay claim một outbox row, enqueue BullMQ job rồi mới đánh dấu `dispatchedAt`. Event chưa có durable receipt được replay sau khoảng trễ để phục hồi khi Redis mất dữ liệu.
5. Email processor gửi SMTP; thành công ghi `SENT` + `processed_events`, lỗi ghi `FAILED` rồi throw để BullMQ retry. Lần thứ 5 vẫn throw để BullMQ lưu failed job nhưng đồng thời ghi terminal receipt, nhờ đó reconciliation không mở thêm chu kỳ retry vô hạn.
6. Lifecycle processor khóa booking. Nó chỉ đổi `PENDING → EXPIRED` hoặc `CONFIRMED → COMPLETED`; state khác là no-op.
7. Customer gọi notification API để đọc dữ liệu của chính mình.

Email failure nằm ngoài booking transaction nên không thể rollback một booking đã thành công.

## File quan trọng

- `apps/api/src/notifications/notification-publisher.ts`: ghi notification và outbox.
- `apps/api/src/notifications/notifications.service.ts`: ownership, pagination và mark-read.
- `apps/api/src/bookings/bookings.service.ts`: phát event từ create và centralized transition.
- `apps/worker/src/outbox/postgres-outbox-store.ts`: claim/finalize outbox an toàn đồng thời.
- `apps/worker/src/outbox/bullmq-outbox-publisher.ts`: route queue, retry/backoff và stable job ID.
- `apps/worker/src/store/postgres-job-store.ts`: durable idempotency và lifecycle transaction.
- `apps/worker/src/processors/email-notification.processor.ts`: SMTP delivery state.
- `packages/shared/src/queues.ts`: queue/event contract dùng chung.
- `apps/api/prisma/migrations/20260910010000_notification_delivery/migration.sql`: delivery fields và constraint.

## Chạy và kiểm thử

```bash
npm run db:generate -w @sports-booking/api
npm run db:migrate -w @sports-booking/api
docker compose up -d --build postgres redis mailhog api worker

npm test -w @sports-booking/api
npm test -w @sports-booking/worker
TEST_DATABASE_URL=postgresql://sports:sports_local_password@localhost:5432/sports_booking_test?schema=public npm test -w @sports-booking/worker
TEST_MAILHOG=true MAIL_HOST=localhost MAIL_PORT=1025 npm test -w @sports-booking/worker -- --runTestsByPath src/adapters/email.adapter.integration-spec.ts
```

Kiểm tra worker ở trạng thái healthy bằng `docker compose ps worker`, log bằng `docker compose logs worker`, và email tại `http://localhost:8025`.

## Lỗi thường gặp và lưu ý bảo mật

- Không ghi `dispatchedAt` trước khi BullMQ nhận job; làm vậy có thể mất event.
- Không dùng Redis làm nguồn trạng thái booking. Redis bị xóa không được làm mất booking hoặc outbox.
- Redis local bật AOF và volume, nhưng reconciliation từ PostgreSQL mới là lớp phục hồi cho cửa sổ giữa enqueue và durable processing receipt.
- Không tin `userId` do client gửi khi đọc notification; luôn lấy từ access token.
- Không coi một email retry là một booking retry. SMTP lỗi chỉ thay đổi delivery status.
- Không chuyển state vô điều kiện trong worker. Luôn khóa row và kiểm tra state mong đợi để tránh race với confirm/cancel.
- Payload outbox không nên chứa access token, password hoặc secret. Production cần TLS/auth SMTP và địa chỉ người gửi đã xác minh.
- Job handler phải throw sau lỗi có thể retry; nếu chỉ log rồi return, BullMQ sẽ đánh dấu job thành công.
- Retry cần giới hạn theo logical event, không chỉ theo một BullMQ job. Terminal receipt sau attempt cuối giữ giới hạn 5 lần kể cả khi failed job bị BullMQ dọn sau 7 ngày.
- Advisory lock ngăn hai worker gửi đồng thời cùng notification. SMTP thường không có idempotency key: crash sau khi server mail nhận thư nhưng trước khi PostgreSQL ghi `SENT` vẫn có thể gửi trùng. Vì vậy delivery là at-least-once; nội dung email không được gây side effect nghiệp vụ.

## Câu hỏi tự kiểm tra

1. Vì sao chỉ dùng BullMQ `jobId` vẫn chưa đủ để bảo đảm idempotency lâu dài?
2. Chuyện gì xảy ra nếu Redis dừng sau khi booking đã commit?
3. Tại sao email failure không được rollback booking?
4. Row lock và expected status phối hợp thế nào khi confirm chạy cùng expiration?
5. Vì sao API mark-read trả `404` cho notification của user khác?
