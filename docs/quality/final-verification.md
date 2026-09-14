# Báo cáo verification cuối MVP

**Ngày kiểm tra ban đầu:** 2026-09-11

**Acceptance re-run:** 2026-09-12

**Nhánh:** `main`

**Baseline trước acceptance re-run:** `854ada2 docs(phase-12): complete final handoff`

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

## 9. Section XIV acceptance re-run

Ngày 2026-09-12 đã audit lại 25/25 acceptance criteria và chạy mới quality gate, API PostgreSQL/MinIO integration, API E2E, worker PostgreSQL/MailHog và Playwright. Lượt chạy phát hiện rồi sửa drift MinIO credentials trong test harness và race chờ render ở admin browser test. Kết quả, command và giới hạn Docker registry được ghi tại [báo cáo Testing Acceptance Criteria](testing-acceptance-report.md).

## 10. Urban Performance frontend redesign

**Ngày kiểm tra:** 2026-09-14

Toàn bộ frontend public, customer, owner và admin đã được chuyển sang một design system thống nhất mà không đổi API contract hoặc logic backend. Design system dùng navy `#081724`, lime `#b8d93d`, nền trung tính `#f3f5f2`, system font tự host-free, radius 12–24 px, soft shadow, focus ring rõ và reduced-motion fallback.

### Phạm vi đã audit

- Global shell: sticky header, brand mark code-native, primary/role navigation, account summary và chính xác một `aria-current` cho route cụ thể.
- Public: hero thể thao, search dock, sport chips, value strip, venue card media-first, local fallback và venue detail có booking rail cùng bản đồ.
- Anonymous flow: người chưa đăng nhập vẫn tìm sân, xem lịch trống và nhận báo giá; chỉ bước xác nhận booking chuyển đến đăng nhập rồi quay về URL trước đó.
- Customer: auth split layout, owner application explainer, booking workspace/detail và notification activity feed.
- Owner: operations dashboard, weekly calendar, booking action panel, contact card, resource hierarchy, disclosure summary-first, schedule/closure/pricing panels và danger zone.
- Admin: system-control dashboard, identity rows, moderation queues, audit timeline, shared status/filter/pagination/error states.
- Responsive/accessibility: layout tại 375 px, 768 px và 1440 px; skip link, focus ring, semantic label/live region, text status, local image load, no horizontal page overflow và `prefers-reduced-motion`.
- Security/data flow: giữ nguyên escaping cho API text và audit JSON, role-gated navigation, route guard, idempotency key, timezone `Asia/Ho_Chi_Minh` và mutation endpoints.

### Generated asset

- Project asset: `apps/web/public/assets/sports-hero.png`.
- Kích thước nguồn: 1672×941 PNG, khoảng 2.1 MB; Vite production build sao chép thành công đến `dist/assets/sports-hero.png`.
- Chế độ: built-in image generation, photorealistic-natural.
- Prompt cuối: “Cinematic urban multi-sport court in Ho Chi Minh City at blue hour; subtle football, basketball and badminton cues; distant unidentifiable athletes in motion; wide landscape with court leading lines and dark negative space for Vietnamese UI; premium stadium lighting; deep navy, natural court green and restrained lime; realistic photography; no text, logo, watermark, brand signage, recognizable close-up faces or oversaturated neon.”

### Verification evidence

Các lệnh quality gate mới nhất:

```bash
npm test -w @sports-booking/web
npm run typecheck -w @sports-booking/web
npm run lint -w @sports-booking/web
npm run build -w @sports-booking/web
npm run test:e2e -w @sports-booking/web
npm run format:check
git diff --check
```

Kết quả:

- Vitest: 19 files, 53/53 tests đạt.
- TypeScript check và ESLint: đạt, không lỗi.
- Vite production build: đạt, 33 modules transformed; CSS 50.80 kB và application JS 91.72 kB trước gzip.
- Chromium Playwright: 7/7 critical customer/owner/admin/mobile journeys đạt.
- Visual smoke một lần: 14 route đại diện × 3 viewport (375×812, 768×1024, 1440×900), tổng 42 lượt render; không alert ngoài dự kiến và không horizontal page overflow. Đã kiểm tra bằng mắt public hero/card, auth, owner calendar/resources và admin audit. Smoke spec tạm không được giữ trong repository để tránh nhân đôi API fixture; assertion ổn định đã được chuyển vào ba E2E suite chính.
- Prettier và `git diff --check`: đạt.

Không có thay đổi trong `apps/api`, `apps/worker`, Prisma, PostgreSQL, Redis, S3/MinIO hoặc Docker. Venue ảnh chưa có dữ liệu dùng fallback code-native; hero là asset raster nội bộ duy nhất được thêm trong redesign.
