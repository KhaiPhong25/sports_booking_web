# Checklist hardening Phase 11

Tài liệu này nối từng yêu cầu QA trong `prompt.md` với bằng chứng tự động. PostgreSQL integration dùng `sports_booking_test`; browser E2E giả lập API tại ranh giới HTTP, còn Docker smoke kiểm tra stack thật.

## Acceptance criteria

|   # | Yêu cầu                                   | Bằng chứng chính                                                                                                                           |
| --: | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
|   1 | Register, login, refresh, logout          | `apps/api/test/auth.e2e-spec.ts`                                                                                                           |
|   2 | Từ chối email trùng                       | `auth.service.spec.ts`, `auth.e2e-spec.ts`                                                                                                 |
|   3 | Không lưu password plaintext              | `auth.service.spec.ts`                                                                                                                     |
|   4 | Chặn locked user                          | `auth.service.spec.ts`, `auth.e2e-spec.ts`, `admin-api.integration-spec.ts`                                                                |
|   5 | Chỉ approved owner quản lý venue          | `phases-2-4.database.e2e-spec.ts`, `authorization-matrix.e2e-spec.ts`                                                                      |
|   6 | Venue chưa duyệt không public             | `venues.service.spec.ts`, `venues.e2e-spec.ts`                                                                                             |
|   7 | Owner không sửa resource của owner khác   | `venues.service.spec.ts`, `scheduling-booking-api.integration-spec.ts`, `authorization-matrix.e2e-spec.ts`                                 |
|   8 | Search tính capacity trên toàn interval   | `scheduling-booking-api.integration-spec.ts`, `booking-concurrency.integration-spec.ts`                                                    |
|   9 | Từ chối interval sai/ngoài giờ            | `booking-time-policy.spec.ts`, `pricing-engine.spec.ts`                                                                                    |
|  10 | Từ chối quá sớm/quá xa                    | `booking-time-policy.spec.ts`                                                                                                              |
|  11 | Closure/maintenance ngăn booking          | `pricing-engine.spec.ts`, `scheduling-booking-api.integration-spec.ts`                                                                     |
|  12 | Giá phủ toàn interval                     | `pricing-engine.spec.ts`                                                                                                                   |
|  13 | Client không ép price/courtId             | `scheduling-booking-api.integration-spec.ts`                                                                                               |
|  14 | Không double-book một court               | `booking-concurrency.integration-spec.ts`, PostgreSQL exclusion constraint                                                                 |
|  15 | Race chỉ thành công tới đúng capacity     | stress 20 request/2 court trong `booking-concurrency.integration-spec.ts`                                                                  |
|  16 | Cho phép interval chạm biên               | `booking-concurrency.integration-spec.ts`                                                                                                  |
|  17 | Expiration giải phóng capacity            | `booking-concurrency.integration-spec.ts`, `postgres-job-store.integration-spec.ts`                                                        |
|  18 | Expiration lặp vẫn idempotent             | `postgres-job-store.integration-spec.ts`                                                                                                   |
|  19 | Transition chỉ từ state hợp lệ            | `booking-state-policy.spec.ts`, `scheduling-booking-api.integration-spec.ts`                                                               |
|  20 | Reassignment không overlap                | `booking-concurrency.integration-spec.ts`                                                                                                  |
|  21 | Price snapshot không đổi                  | `booking-concurrency.integration-spec.ts`                                                                                                  |
|  22 | Email lỗi không rollback và được retry    | `email-notification.processor.spec.ts`, `notification-publisher.spec.ts`                                                                   |
|  23 | Public search được nhưng booking nhận 401 | `scheduling-booking-api.integration-spec.ts`, `customer.spec.js`                                                                           |
|  24 | Customer/owner/admin critical flows       | `apps/web/e2e/customer.spec.js`, `owner.spec.js`, `admin.spec.js`                                                                          |
|  25 | Docker khởi động sạch                     | [Báo cáo Section XIV](testing-acceptance-report.md): clean-start Phase 11, re-smoke Phase 12 và giới hạn registry của lượt chạy 2026-09-12 |

## Security và validation

- `helmet()` đặt security headers; E2E kiểm tra CSP, `X-Content-Type-Options` và `X-Frame-Options`.
- Refresh token chỉ nằm trong cookie `HttpOnly`, `SameSite=Strict`, path `/api/v1/auth`; `Secure` bật khi production. Refresh/logout kiểm tra `Origin` nếu header hiện diện.
- Global `ValidationPipe` bật `transform`, `whitelist` và `forbidNonWhitelisted`. Regression tests từ chối role giả trong register, field query lạ, UUID sai, enum/status sai và server-authoritative `price`/`courtId`.
- Access token được kiểm tra lại user, lock state và `securityVersion`; ẩn nút trong web không được xem là lớp bảo mật.
- Controller không chứa quyết định ownership; service/repository kiểm tra principal với resource lấy từ database.
- Error filter trả envelope ổn định và request ID; không trả stack trace hoặc lỗi Prisma thô.
- Dữ liệu admin được project an toàn; password hash, refresh session và security version không xuất hiện trong response.
- `npm audit --offline` trên host báo `0 vulnerabilities`, nhưng advisory cache local có thể cũ. `npm ci` có truy cập registry trong Docker clean-build báo `2 moderate vulnerabilities` cho toàn dependency tree; build output không chỉ rõ package và môi trường không cho chạy truy vấn audit online riêng để gửi dependency metadata. Không dùng `npm audit fix --force` vì có thể tạo breaking change; CI có network được kiểm soát cần phân loại và nâng dependency ở một thay đổi riêng. Không có phát hiện Critical/High từ dữ liệu hiện có.
- Acceptance run 2026-09-12 đồng bộ `MINIO_SECRET_KEY` mặc định của test harness với Docker Compose/`.env.example`; không giữ một bộ credentials local thứ hai trong test setup.

## Accessibility và responsive

- Các trang critical có `main`, navigation có accessible name, form có label và vùng thông báo dùng `role=status`/live region.
- Playwright kiểm tra skip link, keyboard focus, control labels và ba viewport mobile customer/owner/admin.
- Mobile regression kiểm tra trực tiếp `documentElement.scrollWidth <= innerWidth`, tránh horizontal overflow bị che khuất.
- Đây chưa phải chứng nhận WCAG đầy đủ; CI tương lai nên bổ sung axe-core và kiểm thử screen reader thủ công.

## Lệnh tái kiểm tra

```bash
npm run verify
TEST_DATABASE_URL=postgresql://sports:sports_local_password@localhost:5432/sports_booking_test?schema=public npm run test:integration -w @sports-booking/api
TEST_DATABASE_URL=postgresql://sports:sports_local_password@localhost:5432/sports_booking_test?schema=public npm run test:e2e -w @sports-booking/api
npm run test:e2e -w @sports-booking/web
npm audit --offline
docker compose up -d --build
docker compose exec api npm run db:seed -w @sports-booking/api
```

Không dùng database development cho integration test. Khi dọn Docker sau smoke, không dùng `docker compose down -v` vì lệnh đó xóa dữ liệu local trong named volumes.
