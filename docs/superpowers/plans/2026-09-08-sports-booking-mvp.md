# Sports Booking MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng MVP đặt sân thể thao chạy local, có API, worker, web UI, database, kiểm thử và tài liệu học tập.

**Architecture:** npm-workspaces modular monolith gồm NestJS API, BullMQ worker và Vite vanilla web. PostgreSQL giữ dữ liệu và bảo vệ double booking bằng exclusion constraint; Redis chỉ vận chuyển job.

**Tech Stack:** Node.js, TypeScript, NestJS/Express, Prisma/PostgreSQL, Redis/BullMQ, Vite/vanilla JS, Jest/Supertest, Playwright, Docker Compose.

**Spec:** `docs/architecture/design-spec.md`

## Global Constraints

- REST prefix chính xác `/api/v1`; UI tiếng Việt; identifiers tiếng Anh.
- Thời gian database là UTC, business timezone `Asia/Ho_Chi_Minh`, interval nửa mở `[startAt,endAt)`.
- VND là integer; thời gian theo bước 30 phút, duration 60 phút đến 4 giờ, lead time 60 phút.
- Không tin `price`, `courtId`, `ownerId` từ browser; mọi owner write phải kiểm tra ownership.
- Không React/Vue/Angular/Next.js, microservices, payment hoặc chức năng ngoài MVP.
- Mỗi task dùng chu trình red → green → refactor và chỉ commit file thuộc task.
- Chỉ checkpoint commit khi Git an toàn; không stage `AGENTS.md`, `prompt.md`, context/blueprint hoặc thay đổi người dùng không thuộc task.

---

### Task 1: Repository foundation và health checks

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `.gitignore`, `.env.example`, `docker-compose.yml`
- Create: `apps/api/**`, `apps/worker/**`, `apps/web/**`, `packages/shared/**`
- Test: `apps/api/test/health.e2e-spec.ts`, `apps/worker/src/worker.spec.ts`, `apps/web/src/main.test.js`

**Interfaces:**
- Produces: `GET /api/v1/health`, `GET /api/v1/ready`, Swagger `/docs` và `/docs-json`; workspace scripts `lint`, `typecheck`, `test`, `build`.

- [ ] Scaffold package manifests và Vitest/Jest harness tối thiểu để test commands thực sự chạy.
- [ ] Viết health E2E yêu cầu `{ status: "ok" }`, OpenAPI contract yêu cầu `/api/v1/health`, worker unit test yêu cầu queue name `notifications`, và web DOM test yêu cầu shell có navigation.
- [ ] Chạy test cụ thể ở ba workspace; xác nhận fail do health/controller/worker/shell chưa có.
- [ ] Implement ba apps, shared package, Swagger, environment validation, Docker services PostgreSQL/Redis/MailHog/MinIO và health endpoints.
- [ ] Chạy `npm run lint && npm run typecheck && npm test && npm run build`; tất cả exit code 0.
- [ ] Ghi `docs/learning-notes/phase-01-foundation.md` và commit `feat: establish monorepo foundation`.

### Task 2: Prisma schema, migrations và seed

**Files:**
- Create: `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/**/migration.sql`, `apps/api/prisma/seed.ts`
- Create: `apps/api/src/database/prisma.service.ts`, `apps/api/src/database/database.module.ts`
- Test: `apps/api/test/database-schema.integration-spec.ts`

**Interfaces:**
- Produces: `PrismaService`; enums `RoleName`, `BookingStatus`, `ConfirmationMode`, `VenueStatus` và models trong ERD.

- [ ] Viết integration assertions cho unique email, role relation, composite court/offering key và structural checks; booking exclusion chưa được tạo ở task này.
- [ ] Chạy test database; xác nhận thất bại vì schema/migration chưa tồn tại.
- [ ] Tạo schema/table nền, non-booking checks và seed ba sport, admin, hai owner, venues, courts, schedules, prices, sample bookings; booking exclusion thuộc Task 7.
- [ ] Chạy `npm run db:migrate && npm run db:seed && npm run test:integration -w @sports-booking/api`.
- [ ] Ghi `docs/learning-notes/phase-01-database.md` và commit `feat: add database schema and demo seed`.

### Task 3: Authentication, users và account locking

**Files:**
- Create: `apps/api/src/auth/**`, `apps/api/src/users/**`, `apps/api/src/common/auth/**`
- Test: `apps/api/src/auth/*.spec.ts`, `apps/api/test/auth.e2e-spec.ts`
- Create: `apps/web/src/pages/auth.js`, `apps/web/src/services/auth-api.js`

**Interfaces:**
- Produces: `POST /api/v1/auth/register|login|refresh|logout`, `GET/PATCH /api/v1/me`, `Principal { userId, roles }`.

- [ ] Viết tests cho normalize `0901234567 -> +84901234567`, duplicate email, Argon2 hash, refresh rotation/reuse, cookie/Origin policy và user bị lock sau khi đã nhận access token.
- [ ] Chạy auth tests; xác nhận fail do services chưa có.
- [ ] Implement DTOs, services, guards, cookie refresh session và profile endpoints; tạo form đăng ký/đăng nhập accessible.
- [ ] Chạy auth unit/E2E, lint, typecheck và build.
- [ ] Ghi `docs/learning-notes/phase-02-auth-users.md` và commit `feat: implement secure authentication`.

### Task 4: Owner application và admin approval

**Files:**
- Create: `apps/api/src/owner-applications/**`, `apps/api/src/admin/owner-applications/**`, `apps/api/src/audit-logs/**`
- Test: `apps/api/test/owner-applications.e2e-spec.ts`
- Create: `apps/web/src/pages/owner-application.js`, `apps/web/src/pages/admin-owner-applications.js`

**Interfaces:**
- Produces: `POST/GET /api/v1/owner-applications`, admin approve/reject endpoints; approval atomically grants `OWNER`.

- [ ] Viết E2E cho customer submit, non-admin forbidden, reject reason và approve + audit + role trong một transaction.
- [ ] Chạy test và xác nhận fail tại endpoint chưa tồn tại.
- [ ] Implement state policy, ownership/admin guards, audit repository và hai UI flows.
- [ ] Chạy task tests, lint, typecheck, build.
- [ ] Ghi `docs/learning-notes/phase-03-owner-application.md` và commit `feat: add owner approval workflow`.

### Task 5: Venue catalog, offerings, courts và moderation

**Files:**
- Create: `apps/api/src/venues/**`, `apps/api/src/catalog/**`, `apps/api/src/storage/**`, `apps/api/src/admin/venues/**`
- Test: `apps/api/test/venues.e2e-spec.ts`, `apps/api/test/venue-ownership.e2e-spec.ts`
- Create: `apps/web/src/pages/venue-*.js`, `apps/web/src/components/venue-*.js`

**Interfaces:**
- Produces: public venue/sport/area endpoints; owner CRUD; admin approve/reject/hide; MinIO upload adapter.

- [ ] Viết tests cho approved-owner requirement, cross-owner denial, venue status transitions, approved edit phải duyệt lại, hide vẫn giữ booking cũ, maintenance/closure bị chặn khi có booking tương lai và upload validation.
- [ ] Chạy tests và xác nhận fail do catalog chưa được implement.
- [ ] Implement modules, ownership policy, moderation transaction, object-key generation và responsive forms/list/detail.
- [ ] Chạy task tests, lint, typecheck, build.
- [ ] Ghi `docs/learning-notes/phase-04-venues-courts.md` và commit `feat: implement venue and court catalog`.

### Task 6: Operating schedule, closures và pricing

**Files:**
- Create: `apps/api/src/scheduling/**`, `apps/api/src/pricing/**`
- Test: `apps/api/src/pricing/pricing-engine.spec.ts`, `apps/api/test/scheduling-pricing.e2e-spec.ts`
- Create: `apps/web/src/pages/owner-schedule.js`, `apps/web/src/pages/owner-pricing.js`

**Interfaces:**
- Produces: `PricingEngine.quote(offeringId,startAt,endAt): PriceQuote`; owner schedule/closure/pricing CRUD; public quote endpoint.

- [ ] Viết unit tests cho segmentation 30 phút, full coverage, weekday timezone, midnight/business-date rejection, multiple non-overlap windows và pricing exclusion constraint; E2E cho ownership.
- [ ] Chạy tests và xác nhận fail vì `PricingEngine` chưa tồn tại.
- [ ] Implement pure pricing engine, schedule validator, persistence constraints và owner UI.
- [ ] Chạy task tests, lint, typecheck, build.
- [ ] Ghi `docs/learning-notes/phase-05-schedule-pricing.md` và commit `feat: add schedules and pricing`.

### Task 7: Availability và booking correctness

**Files:**
- Create: `apps/api/src/availability/**`, `apps/api/src/bookings/**`
- Create: `apps/api/prisma/migrations/<timestamp>_booking_constraints/migration.sql`
- Test: `apps/api/src/bookings/booking-state-policy.spec.ts`, `apps/api/test/booking.e2e-spec.ts`, `apps/api/test/booking-concurrency.integration-spec.ts`

**Interfaces:**
- Produces: availability/search, booking create/list/detail/cancel, owner confirm/reject/cancel/reassign; `BookingStatePolicy.transition`.

- [ ] Viết tests cho mọi transition, time policy, closure, price snapshot, idempotency, client-forged fields, capacity, concurrent race, boundary, stale pending và history SYSTEM.
- [ ] Chạy tests; xác nhận failures đến từ booking module chưa có.
- [ ] Implement migration mới cho DB status/occupancy invariant + booking exclusion, resource lock order + authoritative in-transaction revalidation, serializable retry, `FOR UPDATE SKIP LOCKED`, proactive expiration và centralized transitions.
- [ ] Viết integration/concurrency tests cho reassign cùng offering/venue, active/non-overlap, lock old/target theo UUID, và race với create-booking/disable-court.
- [ ] Chạy concurrency suite nhiều lần cùng booking E2E, lint, typecheck, build.
- [ ] Ghi `docs/learning-notes/phase-06-availability-booking.md` và commit `feat: implement concurrency-safe booking`.

### Task 8: Queue, expiration và notifications

**Files:**
- Create: `packages/shared/src/queues.ts`, `apps/api/src/notifications/**`, `apps/worker/src/processors/**`, `apps/worker/src/adapters/email.adapter.ts`
- Test: `apps/worker/src/processors/*.spec.ts`, `apps/api/test/notifications.e2e-spec.ts`

**Interfaces:**
- Produces: transactional `OutboxEvent`, outbox relay, `booking-expiration`, `booking-completion`, `email-notification` jobs; in-app notification endpoints.

- [ ] Viết tests cho outbox crash/retry, idempotent repeated expiration, confirm-vs-expire race, retry/backoff email, email failure isolation và read notification ownership.
- [ ] Chạy tests và xác nhận fail do processors chưa có.
- [ ] Implement transactional outbox relay, queue processors, SMTP adapter, persisted delivery error và notification UI component.
- [ ] Chạy worker/API tests, lint, typecheck, build.
- [ ] Ghi `docs/learning-notes/phase-07-queue-notifications.md` và commit `feat: add booking jobs and notifications`.

### Task 9: Customer web experience

**Files:**
- Create: `apps/web/src/pages/home.js`, `search.js`, `venue-detail.js`, `bookings.js`, `notifications.js`
- Create: `apps/web/src/components/**`, `apps/web/src/services/api.js`, `apps/web/src/services/map-provider.js`, `apps/web/src/config/map.js`, `apps/web/src/styles/**`
- Test: `apps/web/src/**/*.test.js`, `apps/web/e2e/customer.spec.ts`

**Interfaces:**
- Consumes: public/auth/booking/notification APIs.
- Produces: responsive public search, Leaflet detail map qua replaceable tile/geocoding adapter, quote/create/cancel flows.

- [ ] Viết DOM tests cho loading/empty/error/success, keyboard labels và unauthenticated booking redirect; Playwright customer journey.
- [ ] Chạy web tests và xác nhận fail vì pages chưa có.
- [ ] Implement router, components, API client, auth state, Leaflet map, provider adapter với local mock geocoder và Vietnamese UI states.
- [ ] Chạy web unit/E2E, accessibility smoke, lint và build.
- [ ] Ghi `docs/learning-notes/phase-08-customer-web.md` và commit `feat: build customer web experience`.

### Task 10: Owner web experience

**Files:**
- Create: `apps/web/src/pages/owner-dashboard.js`, `owner-venues.js`, `owner-bookings.js`, `owner-calendar.js`
- Test: `apps/web/e2e/owner.spec.ts`

**Interfaces:**
- Consumes: owner CRUD và booking action APIs.
- Produces: owner dashboard, calendar/list/detail, inventory/schedule/pricing forms và reassignment.

- [ ] Viết Playwright flow cho CRUD venue/offering/court, schedule/price và confirm/reassign booking.
- [ ] Chạy test và xác nhận fail tại routes owner chưa có.
- [ ] Implement owner pages/components với loading/error/empty states và ownership-safe payloads.
- [ ] Chạy web/API tests, lint, typecheck, build.
- [ ] Ghi `docs/learning-notes/phase-09-owner-web.md` và commit `feat: build owner dashboard`.

### Task 11: Admin web experience

**Files:**
- Create: `apps/web/src/pages/admin-dashboard.js`, `admin-users.js`, `admin-venues.js`, `admin-audit.js`
- Test: `apps/web/e2e/admin.spec.ts`, `apps/api/test/admin-authorization.e2e-spec.ts`

**Interfaces:**
- Consumes: admin users/applications/venues/audit APIs.
- Produces: auditable moderation UI.

- [ ] Viết E2E cho admin-only access, lock/unlock, approve/reject/hide và audit history.
- [ ] Chạy tests và xác nhận fail vì admin pages chưa có.
- [ ] Implement pages, confirmation dialogs, reason validation và paginated audit table.
- [ ] Chạy task tests, lint, typecheck, build.
- [ ] Ghi `docs/learning-notes/phase-10-admin-web.md` và commit `feat: build admin moderation experience`.

### Task 12: Hardening và Docker clean-start

**Files:**
- Create: `apps/api/test/authorization-matrix.e2e-spec.ts`, `apps/api/test/security.e2e-spec.ts`, `apps/web/e2e/accessibility.spec.ts`
- Modify: `docker-compose.yml`, Dockerfiles, CI/test configuration.

**Interfaces:**
- Produces: reproducible clean-start and verification scripts.

- [ ] Viết matrix tests cho roles/ownership, validation, rate limits, secret redaction và critical cross-domain flows.
- [ ] Chạy full suite để thu baseline failure cụ thể.
- [ ] Sửa từng root cause theo systematic-debugging; thêm healthchecks và deterministic test data.
- [ ] Chạy `npm run verify`, Playwright và `docker compose up --build` smoke checks; tất cả required checks pass.
- [ ] Ghi `docs/learning-notes/phase-11-hardening.md` và commit `test: harden mvp workflows`.

### Task 13: Documentation và handoff

**Files:**
- Modify: `README.md`
- Create: `docs/api/examples.md`, `docs/demo-accounts.md`, `docs/known-limitations.md`, `docs/roadmap.md`, `docs/verification-report.md`, `docs/learning-notes/phase-12-handoff.md`

**Interfaces:**
- Produces: clone-to-running setup, port map, troubleshooting, demo credentials and final evidence.

- [ ] Chạy toàn bộ setup từ clean database và ghi chính xác commands/ports/results.
- [ ] Viết README tiếng Việt gồm prerequisites, env, install, migrate, seed, run, tests, Swagger, MailHog, MinIO và troubleshooting.
- [ ] Kiểm tra docs không chứa secret thật hoặc claims không có bằng chứng.
- [ ] Chạy `npm run verify` và Docker smoke lần cuối; lưu kết quả vào verification report.
- [ ] Commit `docs: complete mvp handoff`.
