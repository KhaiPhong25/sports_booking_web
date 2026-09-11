# Phase 10 — Trải nghiệm quản trị

## Đã xây dựng những gì

Phase này hoàn thiện khu vực admin từ API tới browser:

- `/admin` tổng hợp số user, hồ sơ owner chờ duyệt, venue chờ duyệt và audit gần đây.
- `/admin/users` tìm theo tên/email/số điện thoại, lọc role/trạng thái và khóa hoặc mở khóa tài khoản.
- `/admin/owner-applications` lọc toàn bộ lịch sử theo `PENDING`, `APPROVED`, `REJECTED`; hồ sơ pending có action duyệt/từ chối.
- `/admin/venues` lọc mọi moderation status; venue pending có thể duyệt/từ chối, venue approved có thể bị ẩn.
- `/admin/audit-logs` lọc theo action, actor/resource ID, resource type, thứ tự thời gian và xem before/after JSON.
- Backend bổ sung danh sách user an toàn, query moderation theo trạng thái và audit module chỉ dành cho `ADMIN`.
- Admin không thể tự khóa chính mình. Lock user tăng `securityVersion`, thu hồi refresh session còn hiệu lực và ghi audit trong cùng transaction.
- Unit, PostgreSQL integration và Chromium E2E bao phủ các luồng mới cùng viewport mobile.

## Vì sao chọn thiết kế này

Trang public và owner trước đây chứa một ít hàm admin thử nghiệm. Phase 10 tách chúng thành `admin-dashboard.js`, `admin-users.js`, `admin-moderation.js` và `admin-audit.js`. Mỗi module vẫn giữ quy ước của web hiện tại: hàm render thuần để unit test nhanh, hàm mount phụ trách HTTP và event.

Filter được gửi lên server thay vì tải toàn bộ dữ liệu rồi lọc ở browser. Cách này giữ đúng phân trang, không làm lộ record ngoài trang cần xem và hoạt động khi dữ liệu lớn hơn. Repository nhận filter đã được DTO whitelist/validate; controller chỉ chuyển input vào service.

Audit history là module read-only riêng dùng Prisma qua service. Response actor chỉ có ID, email và display name. Danh sách user được project lại trong `UsersService`, nên password hash và security version không đi qua HTTP dù repository cần chúng cho authentication.

## Luồng request và dữ liệu

1. Khi mở route `/admin/*`, web khôi phục access session. Mọi API admin tiếp tục kiểm tra access token hiện hành và role `ADMIN` ở server.
2. Form filter tạo query string chỉ từ field có giá trị. API DTO từ chối role/status/sort lạ và giới hạn `pageSize` tối đa 100.
3. User list đi qua `UsersService → IdentityRepository → Prisma`. Prisma lọc case-insensitive cho email/display name, lọc phone, role và `isLocked`; service tạo safe projection.
4. Lock/unlock kiểm tra target tồn tại và chặn self-lock. Prisma update user, tăng security version, revoke session khi lock và insert `AuditLog` trong một transaction.
5. Owner application approval cấp role `OWNER` và audit atomically. Venue moderation cập nhật status/reason và audit atomically.
6. Sau mutation, web tải lại page từ server thay vì tự đoán status. Các nút cùng card bị disable trong lúc request đang chạy; lý do reject/hide cần ít nhất 10 ký tự ở cả UI lẫn API.
7. Audit page escape toàn bộ dữ liệu trước khi đưa vào markup, hiển thị timestamp theo `Asia/Ho_Chi_Minh` và dùng `<details>` để tránh JSON dài lấn át danh sách.

## Các file quan trọng

- `apps/api/src/users/admin-users.controller.ts`: route list/lock/unlock user.
- `apps/api/src/users/users.service.ts`: safe projection và self-lock policy.
- `apps/api/src/auth/prisma-identity.repository.ts`: filter user và transaction lock.
- `apps/api/src/audit-logs/`: DTO, service, controller và module audit history.
- `apps/api/src/owner-applications/` và `apps/api/src/venues/`: admin list theo status.
- `apps/api/test/admin-api.integration-spec.ts`: role, validation, filtering, token invalidation và audit với PostgreSQL thật.
- `apps/web/src/pages/admin-*.js`: dashboard, user controls, moderation, audit và UI helpers.
- `apps/web/e2e/admin.spec.js`: hành trình admin và kiểm tra mobile/keyboard.

## Cách chạy và kiểm thử

Chạy kiểm thử nhanh:

```bash
npm test -w @sports-booking/api
npm test -w @sports-booking/web
npm run lint -w @sports-booking/api
npm run lint -w @sports-booking/web
npm run typecheck -w @sports-booking/api
npm run typecheck -w @sports-booking/web
```

Chạy PostgreSQL integration và browser E2E:

```bash
docker compose up -d postgres redis
docker compose exec postgres createdb -U sports sports_booking_test
DATABASE_URL=postgresql://sports:sports_local_password@localhost:5432/sports_booking_test?schema=public npm run db:migrate -w @sports-booking/api
TEST_DATABASE_URL=postgresql://sports:sports_local_password@localhost:5432/sports_booking_test?schema=public npm run test:integration -w @sports-booking/api -- admin-api.integration-spec.ts
npm run test:e2e -w @sports-booking/web -- admin.spec.js
```

Lệnh `createdb` chỉ cần chạy lần đầu cho volume mới; nếu database test đã tồn tại thì bỏ qua lệnh này. Không dùng database development cho integration test.

## Lỗi thường gặp và lưu ý bảo mật

- Không trả nguyên `IdentityUser` từ controller vì object đó có `passwordHash` và `securityVersion`.
- Không chỉ ẩn nút admin ở browser. Guard role server là lớp phân quyền thật; customer/owner gọi trực tiếp vẫn nhận `403`.
- Không cho admin tự khóa vì access hiện tại sẽ bị vô hiệu ngay và có thể làm mất đường quản trị duy nhất. Production nhiều admin vẫn cần quy trình break-glass riêng.
- Không tin status hoặc reason do client tự dựng. DTO whitelist và service kiểm tra transition/độ dài trước repository.
- Không ghi audit sau transaction nghiệp vụ bằng một request riêng: nếu request thứ hai lỗi, hệ thống mất khả năng truy vết. Mutation và audit phải commit cùng nhau.
- Audit JSON cũng là dữ liệu không tin cậy khi render. Luôn escape để tránh stored XSS.
- Disable button giúp tránh double-click nhưng không thay thế transaction và optimistic condition ở database.
- Navigation hiện hiển thị theo khu vực chức năng để phục vụ MVP học tập; API không dựa vào việc link có hiển thị hay không.

## Câu hỏi tự kiểm tra

1. Vì sao danh sách user phải dùng safe projection dù endpoint đã có role guard?
2. Tại sao self-lock được chặn ở service thay vì chỉ disable nút trên web?
3. Điều gì có thể xảy ra nếu approval và audit dùng hai transaction khác nhau?
4. Vì sao filter và pagination nên chạy trong database thay vì browser?
5. Khi lock user, vì sao cần vừa tăng security version vừa revoke refresh session?
