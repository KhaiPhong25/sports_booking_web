# Phase 1 — Nền tảng repository

## Mục tiêu và những gì đã xây

Tạo npm workspaces cho NestJS API, BullMQ worker, Vite vanilla web và shared package; thêm Docker Compose cho PostgreSQL, Redis, MailHog, MinIO cùng ba ứng dụng. API có health/readiness và Swagger; web có semantic shell responsive.

## Vì sao chọn thiết kế này

Monorepo giúp chạy chung lint/test/build và chia sẻ contract có kiểm soát. API và worker tách process để email/expiration không làm chậm HTTP nhưng vẫn giữ một codebase modular monolith. Node 24 trong container là runtime ổn định thay vì phụ thuộc Node 26 trên host.

## Luồng request/data

Browser gọi `/api/v1/*` → NestJS global validation/security middleware → controller → response JSON. Ở phase sau, controller sẽ gọi application service rồi PostgreSQL/outbox; worker nhận BullMQ job qua Redis.

## File quan trọng

- `package.json`: workspace scripts.
- `apps/api/src/bootstrap.ts`: prefix, validation, Helmet và Swagger.
- `apps/api/src/health/health.controller.ts`: health/readiness.
- `apps/worker/src/queue-names.ts`: tên queue ổn định.
- `apps/web/src/shell.js`: semantic application shell.
- `docker-compose.yml`: local infrastructure.
- `.env.example`: contract cấu hình không chứa secret thật.

## Cách chạy và test

```bash
npm run test:e2e -w @sports-booking/api
npm test -w @sports-booking/worker
npm test -w @sports-booking/web
npm run lint
npm run typecheck
npm run build
docker compose config
```

## Lỗi thường gặp và rủi ro

- Chạy bằng Node ngoài engine range có thể gặp package native/API chưa được hỗ trợ.
- Không copy `.env.example` thành `.env` trước khi chạy stack.
- Health chỉ chứng minh process sống; readiness chạy PostgreSQL `SELECT 1` và Redis `PING`, rồi trả `503` nếu dependency chưa sẵn sàng.
- SMTP có tính chất at-least-once ở thiết kế cuối; event ID ổn định giúp theo dõi/dedupe khi provider hỗ trợ.
- Docker Compose config đã được validate, nhưng Docker daemon không tồn tại tại `/var/run/docker.sock`, nên image build/clean-start smoke chưa thể chạy trong môi trường hiện tại.
- Không đưa secret thật vào file tracked.

## Câu hỏi tự kiểm tra

1. Vì sao API và worker là hai process nhưng vẫn không phải microservices?
2. Health khác readiness như thế nào?
3. Vì sao front-end dùng ES modules thay vì một file JavaScript lớn?
