# Phase 11 — Kiểm thử, bảo mật và hardening

## Mục tiêu phase

Phase 11 không mở rộng nghiệp vụ. Mục tiêu là chứng minh các luồng đã xây chịu được input xấu, truy cập sai quyền, tranh chấp đồng thời và môi trường khởi động sạch; đồng thời làm rõ phần nào đã được kiểm tra tự động và phần nào còn là giới hạn.

## Những gì đã xây

- Thêm E2E ma trận quyền tại HTTP boundary cho public, customer, owner và admin.
- Tăng booking race từ vài request lên 20 request tranh 2 physical court; chỉ 2 request được phép thành công.
- Thêm regression test cho refresh cookie, Helmet headers, forged registration role, query lạ, UUID/enum sai.
- Mở rộng browser E2E mobile để phát hiện horizontal overflow thật trên customer, owner và admin pages.
- Lập checklist nối đủ 25 acceptance criteria với test cụ thể.
- Build toàn bộ Docker stack từ trạng thái không có project image/build cache, chạy migration, seed và smoke các service; sau đó chỉ xóa artifact có thể tái tạo của project, giữ named volumes.
- Clean-start phát hiện API runtime image thiếu `tsconfig.base.json`, khiến lệnh seed trong README lỗi dù API vẫn chạy. Dockerfile đã được sửa và seed được chạy lại thành công.

## Kiến thức nền và lựa chọn thiết kế

Unit test trả lời một policy/hàm nhỏ có đúng không. Integration test trả lời nhiều lớp cùng PostgreSQL thật có giữ invariant không. E2E trả lời request HTTP hoặc hành trình browser có hoạt động như người dùng nhìn thấy không. Ba lớp bổ sung nhau; tăng số unit test không thay thế được exclusion constraint hoặc browser test.

Phân quyền được kiểm tra bằng ma trận vai trò trên route đại diện, sau đó kiểm tra ownership riêng bằng hai owner khác nhau. Điều này bắt được cả lỗi “đúng role nhưng sai tài nguyên”. Test chỉ ẩn button ở UI sẽ không đủ vì attacker có thể gọi API trực tiếp.

Stress test không cố chứng minh hệ thống chịu tải production. Nó tạo race có chủ ý để kiểm tra invariant: số booking thành công không vượt physical capacity và mỗi booking dùng court khác nhau. Chốt cuối vẫn là PostgreSQL transaction, row lock và exclusion constraint.

## Luồng request và dữ liệu

1. HTTP request đi qua Helmet, cookie parser, global validation và error filter.
2. Access-token guard xác thực chữ ký, tải lại user hiện hành và kiểm tra lock/security version.
3. Roles guard loại vai trò không hợp lệ; service tiếp tục so principal ID với owner/customer ID của resource.
4. Booking service validate interval, schedule/closure/pricing, lock candidate courts và tạo booking/snapshot/idempotency record trong transaction.
5. PostgreSQL exclusion constraint từ chối overlap nếu race lọt qua lớp chọn court.
6. Notification và outbox được ghi cùng transaction nghiệp vụ; worker xử lý theo stable event/job ID để retry không nhân đôi side effect.
7. Browser render trạng thái loading/empty/error, dùng semantic labels/live regions và được chạy lại ở desktop lẫn mobile.

## Các file quan trọng

- `apps/api/test/authorization-matrix.e2e-spec.ts`: ma trận role và resource ownership.
- `apps/api/test/booking-concurrency.integration-spec.ts`: stress capacity, overlap, boundary, snapshot và expiration.
- `apps/api/test/auth.e2e-spec.ts`: cookie, origin, duplicate/lock và unknown-field validation.
- `apps/api/test/health.e2e-spec.ts`: health, OpenAPI và Helmet headers.
- `apps/api/test/admin-api.integration-spec.ts`: admin role, safe response, validation, moderation race và audit.
- `apps/web/e2e/{customer,owner,admin}.spec.js`: critical flows, keyboard/mobile và overflow.
- `docs/quality/phase-11-hardening-checklist.md`: bản đồ từ acceptance criteria tới evidence.
- `docker-compose.yml`: dependency health, migration gate và healthcheck cho app services.

## Cách chạy và kiểm thử

Quality gate không cần external service:

```bash
npm run verify
npm audit --offline
```

Test với PostgreSQL test và browser:

```bash
docker compose up -d postgres redis
TEST_DATABASE_URL=postgresql://sports:sports_local_password@localhost:5432/sports_booking_test?schema=public npm run test:integration -w @sports-booking/api
TEST_DATABASE_URL=postgresql://sports:sports_local_password@localhost:5432/sports_booking_test?schema=public npm run test:e2e -w @sports-booking/api
npm run test:e2e -w @sports-booking/web
```

Clean-start toàn stack:

```bash
docker compose down
docker builder prune
docker compose up -d --build
docker compose exec api npm run db:seed -w @sports-booking/api
docker compose ps
```

Sau smoke có thể `docker compose down`, xóa đúng project images vừa build và `docker builder prune`. Không dùng `-v`; ba volume PostgreSQL, Redis và MinIO chứa dữ liệu cần giữ.

## Lỗi thường gặp và lưu ý bảo mật

- Dùng `DATABASE_URL` development trong test có thể xóa dữ liệu thật. Fixture và AppModule phải cùng đọc `TEST_DATABASE_URL`.
- Test concurrency bằng repository giả không chứng minh transaction/constraint của PostgreSQL.
- `whitelist: true` một mình có thể âm thầm bỏ field lạ; cần `forbidNonWhitelisted: true` để client biết request không hợp lệ.
- Cookie `HttpOnly` ngăn JavaScript đọc token nhưng không tự giải quyết CSRF; SameSite và origin policy vẫn cần thiết.
- Không log access/refresh token, password, secret hoặc toàn request body trong test output.
- `npm audit --offline` phụ thuộc advisory cache và báo 0 ở host, trong khi `npm ci` online khi build Docker báo 2 advisory mức moderate cho toàn dependency tree. Không dùng `audit fix --force` mù quáng; CI có network được kiểm soát cần xác định package/impact và nâng dependency trong thay đổi riêng.
- `docker system prune -a --volumes` vượt phạm vi dự án và có thể xóa image/data của dự án khác.
- Một viewport mobile xanh không chứng minh toàn bộ WCAG; vẫn cần keyboard, screen reader và contrast review.

## Câu hỏi tự kiểm tra

1. Vì sao role guard không thay thế được resource ownership check?
2. Exclusion constraint bảo vệ điều gì mà button disabled hoặc transaction đơn thuần chưa chắc bảo vệ?
3. Vì sao refresh token nên dùng HttpOnly cookie còn access token chỉ giữ trong memory?
4. Điểm khác nhau giữa unit, integration, HTTP E2E và browser E2E là gì?
5. Vì sao không dùng `docker compose down -v` trong quy trình dọn dung lượng này?
