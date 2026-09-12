# Báo cáo Testing Acceptance Criteria — Section XIV

**Ngày chạy:** 2026-09-12

**Baseline:** `854ada2 docs(phase-12): complete final handoff`

**Database test:** `sports_booking_test`

## Kết luận

25/25 tiêu chí trong Section XIV của `prompt.md` có bằng chứng tự động hoặc smoke evidence tương ứng. Lượt chạy này thực thi lại toàn bộ unit, integration, API E2E, worker external-service và browser E2E; không skip test critical trong các suite service-backed. Docker clean-build được thử lại nhưng dependency registry ngừng phản hồi trong BuildKit, vì vậy tiêu chí 25 dùng clean-start thành công của Phase 11 và re-smoke Phase 12 làm bằng chứng gần nhất; thay đổi hôm nay không chạm production runtime hay Dockerfile.

## Ma trận 25 tiêu chí

|   # | Tiêu chí                                      | Bằng chứng đã kiểm tra                                                                     |           Kết quả           |
| --: | --------------------------------------------- | ------------------------------------------------------------------------------------------ | :-------------------------: |
|   1 | Register, login, refresh, logout              | `auth.e2e-spec.ts` chạy HTTP thật qua NestJS                                               |             Đạt             |
|   2 | Duplicate email bị từ chối                    | `auth.service.spec.ts`, `auth.e2e-spec.ts`                                                 |             Đạt             |
|   3 | Password không lưu plaintext                  | `auth.service.spec.ts` kiểm tra giá trị băm được persist                                   |             Đạt             |
|   4 | Locked user bị chặn                           | `auth.service.spec.ts`, `auth.e2e-spec.ts`, `admin-api.integration-spec.ts`                |             Đạt             |
|   5 | Chỉ approved owner quản lý venue              | `phases-2-4.database.e2e-spec.ts`, `authorization-matrix.e2e-spec.ts`                      |             Đạt             |
|   6 | Venue chưa duyệt không public                 | `venues.service.spec.ts`, `venues.e2e-spec.ts`                                             |             Đạt             |
|   7 | Owner không sửa resource owner khác           | `venues.service.spec.ts`, scheduling integration và authorization matrix                   |             Đạt             |
|   8 | Search chỉ trả capacity trống toàn interval   | scheduling integration và booking concurrency integration                                  |             Đạt             |
|   9 | Interval sai/ngoài operating hours bị từ chối | booking time policy, pricing engine và scheduling integration                              |             Đạt             |
|  10 | Booking quá sớm/quá xa bị từ chối             | `booking-time-policy.spec.ts`                                                              |             Đạt             |
|  11 | Closure/maintenance ngăn booking              | pricing engine, scheduling integration và court-deactivation race                          |             Đạt             |
|  12 | Pricing rule phủ toàn interval                | `pricing-engine.spec.ts` từ chối slot thiếu giá                                            |             Đạt             |
|  13 | Client không ép price/courtId                 | scheduling integration gửi field không được phép và kiểm tra server authority              |             Đạt             |
|  14 | Không double-book một court                   | concurrency integration và PostgreSQL exclusion constraint                                 |             Đạt             |
|  15 | Concurrent success đúng tổng capacity         | 20 request tranh 2 court: đúng 2 success, 18 `BOOKING_NO_CAPACITY`                         |             Đạt             |
|  16 | Interval chạm biên được phép                  | adjacent half-open interval integration                                                    |             Đạt             |
|  17 | Pending expiration giải phóng capacity        | booking concurrency và PostgreSQL job-store integration                                    |             Đạt             |
|  18 | Expiration job lặp vẫn an toàn                | PostgreSQL job-store integration kiểm tra notification đúng một lần                        |             Đạt             |
|  19 | Transition chỉ từ state hợp lệ                | centralized state-policy unit và scheduling integration                                    |             Đạt             |
|  20 | Court reassignment không overlap              | booking concurrency integration                                                            |             Đạt             |
|  21 | Price snapshot không đổi                      | booking concurrency integration sửa pricing rule sau booking                               |             Đạt             |
|  22 | Email lỗi không rollback và được retry        | transactional notification publisher và email processor retry/terminal receipt             |             Đạt             |
|  23 | Anonymous search được, booking nhận 401       | scheduling integration, authorization matrix và customer browser flow                      |             Đạt             |
|  24 | Customer, owner, admin critical E2E           | Playwright Chromium: 7/7                                                                   |             Đạt             |
|  25 | Docker clean-start theo README                | Phase 11 clean-build + Phase 12 re-smoke: migrate, seed, health/readiness và service smoke | Đạt với bằng chứng gần nhất |

## Kết quả lệnh 2026-09-12

### Quality gate

```bash
npm run verify
```

- Format, ESLint và typecheck: đạt.
- API unit: 19 suites, 67 tests đạt.
- Web unit: 18 files, 47 tests đạt.
- Worker unit-only: 6 suites/17 tests đạt; 3 suite external-service được skip đúng thiết kế của lệnh unit.
- API, web, worker và shared production build: đạt; Vite build 32 modules.

### Service-backed suites

```bash
TEST_OBJECT_STORAGE=true TEST_DATABASE_URL=postgresql://sports:***@localhost:5432/sports_booking_test?schema=public npm run test:integration -w @sports-booking/api
TEST_DATABASE_URL=postgresql://sports:***@localhost:5432/sports_booking_test?schema=public npm run test:e2e -w @sports-booking/api
TEST_MAILHOG=true TEST_DATABASE_URL=postgresql://sports:***@localhost:5432/sports_booking_test?schema=public npm test -w @sports-booking/worker
npm run test:e2e -w @sports-booking/web
```

- API PostgreSQL + MinIO integration: 5 suites/16 tests đạt, không skip.
- API E2E: 8 suites/19 tests đạt, không skip.
- Worker PostgreSQL + MailHog: 9 suites/23 tests đạt, không skip.
- Playwright Chromium: 7/7 đạt; customer, owner, admin, mobile và keyboard flow đều chạy.

## Lỗi được phát hiện và sửa

1. MinIO integration RED với `SignatureDoesNotMatch`. Root cause là test harness dùng `test-minio-secret` trong khi Compose và `.env.example` dùng `replace-local-minio-secret-long`. Đã đồng bộ test harness và chạy lại 16/16 integration tests thành công.
2. Admin Playwright RED do assertion chờ `aria-busy` có thể đạt trước khi moderation refresh bắt đầu, làm textarea cũ bị render lại sau khi nhập. Test hiện chờ trạng thái nghiệp vụ `Đã duyệt` rồi mới thao tác card mới; regression riêng 1/1 và full browser suite 7/7 đều đạt.

## Docker clean-build 2026-09-12

`docker compose up -d --build` và một lần thử riêng `docker build --network=host` đều tải được base image nhưng `npm ci` trong BuildKit ngừng phản hồi nhiều phút ở dependency installation. Hai lượt được dừng có kiểm soát; không có compile/test/runtime error từ source và không có container dở dang.

Sau khi dừng, `docker builder prune -a -f` thu hồi `93.18MB` cache có thể xóa. Docker Desktop vẫn đánh dấu `1.992GB` BuildKit cache là active/non-reclaimable dù không còn project container hoặc project image; không xóa named volumes và không restart Docker daemon chỉ để cưỡng ép giải phóng phần này.

Bằng chứng criterion 25 gần nhất vẫn là clean-start Phase 11 và API/migrate re-smoke Phase 12 trên commit hiện hành trước thay đổi test-only hôm nay. Khi registry ổn định, chạy lại:

```bash
docker compose up -d --build
docker compose exec api npm run db:seed -w @sports-booking/api
docker compose ps
```

Không dùng `docker compose down -v`; named volumes chứa dữ liệu local phải được giữ.

## Lưu ý môi trường

Host mặc định đang dùng Node `26.8.1`, ngoài engine `>=22.12 <25`, nên các lệnh acceptance dùng Node `24.11.1` có sẵn. npm 12 cảnh báo phiên bản này thấp hơn `24.15.0`, nhưng mọi quality/test/build command phía host đều hoàn tất với exit code 0. Đây là cảnh báo toolchain, không được ghi nhận như test failure.
