# Sports Booking Platform

Nền tảng tìm kiếm và đặt sân thể thao tại Thành phố Hồ Chí Minh. MVP hỗ trợ bóng đá, bóng rổ và cầu lông, với ba vai trò customer, owner và admin.

## Trạng thái

Dự án đang được triển khai theo từng phase. Phase nền tảng cung cấp monorepo gồm:

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
npm run verify
docker compose up --build
```

Các bước migration, seed và tài khoản demo sẽ được bổ sung cùng Phase database. Không dùng giá trị placeholder trong `.env.example` cho production.

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
```

Ba lệnh `dev:*` chạy ở ba terminal riêng. Để khởi động toàn stack bằng một lệnh, dùng `docker compose up --build`.

Xem kiến trúc tại `docs/architecture/design-spec.md` và ghi chú học tập theo thứ tự trong `docs/learning-notes/`.
