# Sports Booking Platform

Nền tảng tìm kiếm và đặt sân thể thao tại Thành phố Hồ Chí Minh. MVP hỗ trợ bóng đá, bóng rổ và cầu lông, với ba vai trò customer, owner và admin.

## Trạng thái

Dự án đã hoàn thành đến Phase 10: nền tảng, authentication/users, owner application, venue/court inventory, lịch/giá, booking an toàn đồng thời, queue/notifications, trải nghiệm web cho customer/owner và khu vực quản trị đầy đủ cho admin.

- `apps/api`: NestJS REST API, prefix `/api/v1`, Swagger `/docs`.
- `apps/worker`: outbox relay và BullMQ workers riêng cho email, hết hạn và hoàn tất booking.
- `apps/web`: Vite + HTML/CSS/JavaScript thuần.
- `packages/shared`: contract/constants dùng chung có chủ đích.

## Yêu cầu hệ thống

- Node.js 22.12–24.x (khuyến nghị Node 24 LTS)
- npm 11+
- Docker Engine và Docker Compose

Host Node 26 chưa nằm trong dải runtime đã khóa. Dockerfiles dùng Node 24 để có môi trường lặp lại được.

## Khởi động nhanh

```bash
cp .env.example .env
npm install
npm run db:generate -w @sports-booking/api
npm run verify
docker compose up --build
docker compose exec api npm run db:seed -w @sports-booking/api
```

Nếu PostgreSQL chạy trong Docker nhưng API chạy trên host, dùng `DATABASE_URL` trong `.env.example`. Không dùng placeholder hoặc tài khoản demo cho production.

## Tài khoản demo local

Seed dùng chung mật khẩu `LocalDemo123!` chỉ cho môi trường local:

- `admin@sports.local`: CUSTOMER + ADMIN
- `owner1@sports.local`, `owner2@sports.local`: CUSTOMER + OWNER
- `customer@sports.local`: CUSTOMER

## URL local

- Web: http://localhost:5173
- API health: http://localhost:3000/api/v1/health
- Swagger: http://localhost:3000/docs
- MailHog: http://localhost:8025
- MinIO console: http://localhost:9001

## Lệnh phát triển

```bash
npm run dev:api
npm run dev:worker
npm run dev:web
npm run lint
npm run typecheck
npm test
npm run build
npm run verify
npm run test:e2e
npm run test:e2e -w @sports-booking/web
npm run test:integration -w @sports-booking/api
TEST_DATABASE_URL=postgresql://sports:sports_local_password@localhost:5432/sports_booking_test?schema=public npm test -w @sports-booking/worker
TEST_MAILHOG=true MAIL_HOST=localhost npm test -w @sports-booking/worker -- --runTestsByPath src/adapters/email.adapter.integration-spec.ts
```

Ba lệnh `dev:*` chạy ở ba terminal riêng. Để khởi động toàn stack bằng một lệnh, dùng `docker compose up --build`.

`test:integration` cần `TEST_DATABASE_URL` trỏ tới database test đã migrate. Xem kiến trúc tại `docs/architecture/design-spec.md` và ghi chú học tập theo thứ tự trong `docs/learning-notes/`.

## Luồng đã có đến Phase 10

- Public không cần đăng nhập: tìm theo môn/khu vực/ngày/giờ, xem sân còn trống, chi tiết venue, tiện ích, chế độ xác nhận, báo giá và bản đồ Leaflet. Khi bấm đặt sân, người chưa đăng nhập được đưa tới trang đăng nhập rồi quay lại đúng venue.
- Customer đã đăng nhập: tạo booking với `Idempotency-Key`, xem danh sách có filter, mở chi tiết, hủy theo notice snapshot, xem/lọc/đánh dấu đã đọc notification.
- Owner: xem dashboard và lịch booking theo tuần; lọc danh sách, mở chi tiết cùng thông tin liên hệ customer; confirm/reject/cancel/reassign booking; tạo, sửa, lưu trữ venue; quản lý offering/court, operating hours, closures và pricing.
- Admin: xem dashboard moderation; tìm/lọc/khóa/mở khóa user; lọc và xét hồ sơ owner; duyệt, từ chối hoặc ẩn venue; tra cứu audit history theo action và resource. Admin không thể tự khóa tài khoản đang dùng.
- PostgreSQL chống overlap bằng transaction lock và exclusion constraint; concurrency tests dùng database thật.
- Booking transaction ghi đồng thời in-app notification và outbox event. Worker chuyển event sang BullMQ với job ID ổn định, retry email theo exponential backoff và xử lý expiration/completion idempotent.
- Customer đọc/phân trang notification và chỉ có thể đánh dấu notification của chính mình đã đọc.

Email local được gửi tới MailHog, không gửi ra Internet. `OUTBOX_POLL_INTERVAL_MS` điều chỉnh chu kỳ relay; `OUTBOX_REPLAY_AFTER_SECONDS` xác định khi nào event chưa có durable receipt được enqueue lại; `MAIL_FROM` đặt người gửi hiển thị. PostgreSQL vẫn là nguồn dữ liệu bền vững nếu Redis hoặc SMTP tạm thời lỗi. Compose bật Redis AOF/volume và chạy migration service trước API/worker.

UI chính: `/`, `/venues/:id`, `/bookings`, `/bookings/:id`, `/notifications`, `/owner`, `/owner/calendar`, `/owner/bookings`, `/owner/bookings/:id`, `/owner/venues`, `/owner/schedule`, `/admin`, `/admin/users`, `/admin/owner-applications`, `/admin/venues`, `/admin/audit-logs`.

Web dùng OpenStreetMap qua một adapter Leaflet. Tile URL, attribution và zoom nằm tại `apps/web/src/config/map.js`, vì vậy có thể đổi nhà cung cấp bản đồ mà không sửa trang venue. Browser E2E dùng API giả lập tại ranh giới HTTP để kiểm tra ổn định hành trình UI; API E2E/integration riêng vẫn kiểm tra PostgreSQL và nghiệp vụ thật.
