# Hướng dẫn phát triển và vận hành local

## 1. Yêu cầu

- Node.js `>=22.12 <25`; Dockerfiles dùng Node 24.
- npm 11 trở lên.
- Docker Engine có Compose v2.
- Các port local còn trống: `3000`, `5173`, `5432`, `6379`, `8025`, `9000`, `9001`; SMTP dùng `1025`.

Không commit `.env`. `.env.example` chỉ chứa giá trị local để học và phải được thay bằng secret mạnh khi deploy.

## 2. Docker-first

```bash
test -f .env || cp .env.example .env
docker compose up -d --build
docker compose ps
docker compose exec api npm run db:seed -w @sports-booking/api
```

Compose chờ PostgreSQL/Redis healthy, chạy `prisma migrate deploy` qua service `migrate`, rồi mới khởi động API/worker; web chỉ khởi động sau khi API healthy. Seed là idempotent cho dữ liệu demo chính và có thể chạy lại.

Kiểm tra nhanh:

```bash
curl http://localhost:3000/api/v1/health
curl http://localhost:3000/api/v1/ready
curl -I http://localhost:5173
docker compose logs --tail=100 api worker migrate
```

Health chỉ cho biết process sống. Readiness còn kiểm tra PostgreSQL và Redis.

## 3. Chạy source trên host

Khởi động dependency trước:

```bash
test -f .env || cp .env.example .env
npm install
docker compose up -d postgres redis mailhog minio
npm run db:generate -w @sports-booking/api
npm run db:migrate -w @sports-booking/api
npm run db:seed -w @sports-booking/api
```

Sau đó mở ba terminal:

```bash
npm run dev:api
npm run dev:worker
npm run dev:web
```

Các script `dev` của API/worker và Prisma `validate/migrate/seed` dùng Node `--env-file-if-exists=../../.env`, vì npm workspace chạy với current directory bên trong `apps/*`. Nhờ vậy chúng nạp đúng `.env` ở repository root; nếu file không tồn tại, API/worker vẫn fail-fast vì thiếu biến bắt buộc. Vite đã đặt `envDir` về repository root. Trong Compose, các giá trị host được override thành service names.

## 4. Migration và seed

Tạo migration mới khi schema thay đổi:

```bash
npm run db:generate -w @sports-booking/api
npx prisma migrate dev --schema apps/api/prisma/schema.prisma --name <ten-migration>
```

Áp dụng migration đã commit:

```bash
npm run db:migrate -w @sports-booking/api
```

Không dùng `prisma db push` thay migration cho thay đổi cần chia sẻ. Raw SQL trong migration là chủ ý đối với `btree_gist`, exclusion constraint và locking/invariant PostgreSQL.

Seed local:

```bash
npm run db:seed -w @sports-booking/api
# hoặc khi toàn stack chạy Docker:
docker compose exec api npm run db:seed -w @sports-booking/api
```

## 5. Database test tách biệt

Không trỏ test integration vào `sports_booking`. Tạo database test một lần và migrate riêng:

```bash
docker compose up -d postgres redis
docker compose exec postgres createdb -U sports sports_booking_test
DATABASE_URL='postgresql://sports:sports_local_password@localhost:5432/sports_booking_test?schema=public' npm run db:migrate -w @sports-booking/api
```

Nếu `createdb` báo database đã tồn tại, bỏ qua. Chạy quality gates:

```bash
npm run verify
TEST_DATABASE_URL='postgresql://sports:sports_local_password@localhost:5432/sports_booking_test?schema=public' npm run test:integration -w @sports-booking/api
TEST_DATABASE_URL='postgresql://sports:sports_local_password@localhost:5432/sports_booking_test?schema=public' npm run test:e2e -w @sports-booking/api
npm run test:e2e -w @sports-booking/web
TEST_DATABASE_URL='postgresql://sports:sports_local_password@localhost:5432/sports_booking_test?schema=public' npm test -w @sports-booking/worker
```

MinIO và MailHog integration là opt-in:

```bash
TEST_OBJECT_STORAGE=true MINIO_SECRET_KEY=replace-local-minio-secret-long \
  TEST_DATABASE_URL='postgresql://sports:sports_local_password@localhost:5432/sports_booking_test?schema=public' \
  npm run test:integration -w @sports-booking/api

TEST_MAILHOG=true MAIL_HOST=localhost MAILHOG_API_URL=http://localhost:8025 \
  TEST_DATABASE_URL='postgresql://sports:sports_local_password@localhost:5432/sports_booking_test?schema=public' \
  npm test -w @sports-booking/worker
```

## 6. Giữ, backup và reset dữ liệu Docker

`docker compose down` giữ named volumes. Xem đúng volume của project:

```bash
docker volume ls --filter label=com.docker.compose.project=sports_booking_web
```

Backup PostgreSQL trước thay đổi rủi ro:

```bash
docker compose exec -T postgres pg_dump -U sports -d sports_booking > sports_booking_local.sql
```

File backup có thể chứa dữ liệu nhạy cảm; không commit. Chỉ khi chủ động muốn reset toàn bộ local data mới dùng:

```bash
docker compose down -v
```

## 7. Dọn dung lượng trong phạm vi project

```bash
docker compose down --rmi local
docker compose ps -a
docker volume ls --filter label=com.docker.compose.project=sports_booking_web
docker system df
```

`--rmi local` xóa image do Compose build cho project, giữ base images và named volumes. BuildKit cache không có project label đáng tin cậy; `docker builder prune` có thể ảnh hưởng cache build của repository khác, nên chỉ dùng sau khi kiểm tra daemon hoặc khi biết cache vừa được tạo riêng cho project. Không dùng `docker system prune -a --volumes` cho yêu cầu cleanup giới hạn phạm vi.

## 8. Troubleshooting

### Port đã được dùng

Kiểm tra `docker compose ps` và process host. Có thể đổi `PORT`, `WEB_PORT` trong `.env`; khi đổi web origin phải đồng bộ `WEB_ORIGIN` và proxy target.

### API không kết nối PostgreSQL

- Host process dùng `localhost:5432`; container dùng `postgres:5432`.
- Password local chuẩn là `sports_local_password` ở `.env.example`/Compose.
- Test phải đặt `TEST_DATABASE_URL`; `test/setup-env.ts` sẽ đồng bộ `DATABASE_URL` cho AppModule.

### `ready` trả 503

Chạy `docker compose ps`, `docker compose logs postgres redis api`, rồi kiểm tra `pg_isready` và `redis-cli ping`. Health 200 nhưng readiness 503 nghĩa là process API sống nhưng dependency chưa sẵn sàng.

### Seed trong container lỗi TypeScript

Đảm bảo đang dùng Dockerfile hiện tại có `/app/tsconfig.base.json`; rebuild `api` thay vì dùng image cũ:

```bash
docker compose build --no-cache api migrate
docker compose up -d
```

### Không thấy email hoặc ảnh

- Email local ở MailHog `http://localhost:8025`; xem log worker và Redis nếu outbox chưa dispatch.
- MinIO console ở `http://localhost:9001`; access key/secret phải khớp API và MinIO.
- Email là async; booking thành công không chờ SMTP.

### Node/npm cảnh báo version

Chạy `node --version` và `npm --version`. Project khóa Node dưới 25; dùng một bản Node 24 LTS tương thích với npm đang cài hoặc chạy qua Docker để tránh drift host toolchain.
