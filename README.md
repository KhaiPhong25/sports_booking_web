# Sports Booking Platform

Nền tảng tìm kiếm và đặt sân thể thao tại Thành phố Hồ Chí Minh. MVP hỗ trợ bóng đá, bóng rổ và cầu lông, với ba vai trò customer, owner và admin.

## Trạng thái

Dự án đã hoàn thành đến Phase 6: nền tảng, authentication/users, owner application, venue/court inventory, lịch/giá và booking an toàn đồng thời.

- `apps/api`: NestJS REST API, prefix `/api/v1`, Swagger `/docs`.
- `apps/worker`: tiến trình BullMQ riêng.
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
npm run db:migrate -w @sports-booking/api
npm run db:seed -w @sports-booking/api
npm run verify
docker compose up --build
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
npm run test:integration -w @sports-booking/api
```

Ba lệnh `dev:*` chạy ở ba terminal riêng. Để khởi động toàn stack bằng một lệnh, dùng `docker compose up --build`.

`test:integration` cần `TEST_DATABASE_URL` trỏ tới database test đã migrate. Xem kiến trúc tại `docs/architecture/design-spec.md` và ghi chú học tập theo thứ tự trong `docs/learning-notes/`.

## Luồng đã có đến Phase 6

- Public không cần đăng nhập: xem catalog/venue, tìm theo sport/area/thời gian, xem capacity và quote.
- Customer đã đăng nhập: tạo booking với `Idempotency-Key`, xem chi tiết/danh sách có filter và hủy theo notice snapshot.
- Owner: quản lý venue/court, operating hours, closures, pricing; xem court được phân, confirm/reject/cancel/reassign booking.
- PostgreSQL chống overlap bằng transaction lock và exclusion constraint; concurrency tests dùng database thật.

UI chính: `/`, `/venues/:id`, `/bookings`, `/owner/venues`, `/owner/schedule`, `/owner/bookings`, `/admin/owner-applications`, `/admin/venues`.
