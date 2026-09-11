# Báo cáo verification cuối MVP

**Ngày kiểm tra:** 2026-09-11

**Nhánh:** `main`

**Checkpoint implementation gần nhất:** `f233f46 test(phase-11): harden security and critical flows`

## 1. Sản phẩm hoàn thành

MVP hỗ trợ public discovery/availability, customer booking/notification, owner vận hành venue–court–schedule–price–booking, admin moderation/user lock/audit. Booking tự gán physical court, tính giá server-side, dùng interval `[startAt,endAt)`, transaction/row lock và PostgreSQL exclusion constraint chống double booking. Notification dùng transactional outbox, Redis/BullMQ worker, in-app record và MailHog email.

Không triển khai các mục ngoài MVP như payment, ticket, QR, chat, promotion, review, settlement, native mobile hoặc microservice split.

## 2. Kiến trúc cuối

- npm-workspaces monorepo.
- `apps/api`: NestJS + Express adapter + REST `/api/v1` + Swagger.
- `apps/worker`: outbox relay và BullMQ processors, chạy process riêng.
- `apps/web`: Vite + HTML/CSS/vanilla JavaScript ES modules.
- PostgreSQL là durable source of truth; Redis không lưu booking bền vững.
- Prisma cho ORM, raw SQL migration cho PostgreSQL-specific constraints.
- MinIO lưu ảnh local, MailHog nhận SMTP local, Leaflet dùng provider adapter.
- Docker Compose quản lý dependency health, migration gate và app healthcheck.

Chi tiết correctness ở [design spec](../architecture/design-spec.md), quan hệ dữ liệu ở [ERD](../architecture/erd.md).

## 3. Cây thư mục chính

```text
.
├── apps/
│   ├── api/       # NestJS modules, Prisma, unit/integration/E2E
│   ├── worker/    # BullMQ/outbox/email/lifecycle workers
│   └── web/       # Vite vanilla UI, unit và Playwright E2E
├── packages/
│   └── shared/    # contract/constants dùng chung
├── docker/        # API, worker, web Dockerfiles và nginx config
├── docs/
│   ├── api/
│   ├── architecture/
│   ├── guides/
│   ├── learning-notes/
│   ├── product/
│   └── quality/
├── docker-compose.yml
├── .env.example
└── README.md
```

## 4. Setup, URL và demo account

```bash
test -f .env || cp .env.example .env
npm install
docker compose up -d --build
docker compose exec api npm run db:seed -w @sports-booking/api
```

| Thành phần | URL/port                                |
| ---------- | --------------------------------------- |
| Web        | `http://localhost:5173`                 |
| API        | `http://localhost:3000/api/v1`          |
| Swagger    | `http://localhost:3000/docs`            |
| MailHog    | `http://localhost:8025` (SMTP `1025`)   |
| MinIO      | `http://localhost:9001` (S3 API `9000`) |
| PostgreSQL | `localhost:5432`                        |
| Redis      | `localhost:6379`                        |

Mật khẩu local chung `LocalDemo123!`: `admin@sports.local`, `owner1@sports.local`, `owner2@sports.local`, `customer@sports.local`. Xem [demo guide](../guides/demo-guide.md).

## 5. Verification evidence

### Quality gate

Lệnh cuối sau các review fix:

```bash
npm run verify
```

Kết quả:

- Prettier check: đạt.
- ESLint API/web/worker: đạt.
- Typecheck API + Prisma seed, web và worker/shared: đạt.
- API unit: 19 suites, 67 tests đạt.
- Web unit: 18 files, 47 tests đạt.
- Worker unit-only run: 6 suites/17 tests đạt; 6 integration tests skip có chủ ý vì lệnh không cấp external-service flags.
- Production build API/web/worker/shared: đạt; Vite build 32 modules.
- Prisma `db:validate` và worker Node env probe xác nhận workspace commands nạp `.env` ở repository root.

### PostgreSQL, service integration và E2E

Trên clean-start Docker stack:

```bash
TEST_OBJECT_STORAGE=true TEST_DATABASE_URL=... npm run test:integration -w @sports-booking/api
TEST_DATABASE_URL=... npm run test:e2e -w @sports-booking/api
TEST_MAILHOG=true TEST_DATABASE_URL=... npm test -w @sports-booking/worker
npm run test:e2e -w @sports-booking/web
```

Kết quả:

- API integration gồm PostgreSQL + MinIO: 5 suites, 16 tests đạt, không skip.
- API E2E: 8 suites, 19 tests đạt, không skip.
- Worker gồm PostgreSQL + MailHog: 9 suites, 23 tests đạt, không skip.
- Chromium Playwright: 7/7 critical customer/owner/admin và mobile-accessibility tests đạt.
- Stress race: 20 request tranh 2 court, đúng 2 success; 18 failure đều là `BOOKING_NO_CAPACITY`; hai booking dùng hai court khác nhau.
- Các auth/concurrency case quan trọng được chạy riêng; không còn phụ thuộc state test trước. Review cuối không còn Critical/Important.

### Docker clean-start smoke

Đã build API/migrate/worker/web từ trạng thái không có project image/cache, khởi động stack, chạy migration và seed. Clean-start phát hiện API runtime thiếu `tsconfig.base.json`; Dockerfile được sửa, rebuild và seed chạy thành công.

Sau thay đổi Phase 12 cho root `.env`, API/migrate images được build lại; Compose migration, `npm run db:seed -w @sports-booking/api` và readiness tiếp tục đạt với command mới.

Smoke đạt:

- `GET /api/v1/health` → `{"status":"ok"}`.
- `GET /api/v1/ready` → `{"status":"ready"}`.
- Web và Swagger JSON trả thành công.
- PostgreSQL `pg_isready`, Redis `PONG`, worker health `ready`.
- MailHog API và MinIO live endpoint trả thành công.
- Login demo admin và gọi authenticated `/api/v1/admin/users` thành công.

Sau smoke: dừng toàn bộ container, xóa project images và cache có thể tái tạo; giữ bốn base images và ba named volumes. Cleanup Phase 11 giải phóng `2.752GB` cache; lượt re-smoke Phase 12 giải phóng thêm `1.885GB`. Trạng thái cuối không còn project container/image, build cache là `0B`, volume dữ liệu được giữ khoảng `77.19MB` và bốn base images chiếm khoảng `1.406GB`.

### Dependency audit

- `npm audit --offline` trên host báo 0 theo advisory cache local.
- `npm ci` online trong Docker build báo 2 advisory mức moderate trong toàn dependency tree, không có High/Critical trong output.
- Môi trường không cho chạy truy vấn audit online riêng để gửi dependency metadata, nên chưa xác định package/impact. Không chạy `npm audit fix --force`; cần scan online có kiểm soát trong CI.

## 6. Giả định đã áp dụng

- Múi giờ nghiệp vụ `Asia/Ho_Chi_Minh`; lưu timestamp UTC.
- VND là integer; slot 30 phút; booking 1–4 giờ, lead time mặc định 60 phút.
- Public được search/xem availability nhưng tạo booking phải đăng nhập.
- Không OTP trong MVP; phone vẫn bắt buộc và chuẩn hóa E.164.
- Docker local giữ volume giữa các lần `down`; credentials trong `.env.example` chỉ dành cho local.
- Same-origin deployment cho web/API; refresh cookie HttpOnly/SameSite Strict, Secure ở production.

## 7. Known limitations và roadmap

Danh sách đầy đủ ở [known limitations và roadmap](../product/known-limitations-and-roadmap.md). Điểm quan trọng: chưa có production deployment/CI/observability, OTP/reset/MFA, payment, WCAG certification, load benchmark và production provider cho email/object storage.

Không có lỗi Critical/Important đã biết về authorization hoặc double booking sau review Phase 11. Hai advisory moderate chưa phân loại là việc hardening tiếp theo, không được che giấu như kết quả audit sạch.

## 8. Learning notes

Thứ tự đọc từ Phase 00 đến Phase 12 được duy trì tại [mục lục tài liệu](../README.md#thứ-tự-learning-notes). Mỗi note giải thích phần đã xây, lựa chọn thiết kế, request/data flow, file quan trọng, cách chạy/test, lỗi thường gặp, bảo mật và câu hỏi tự kiểm tra.
