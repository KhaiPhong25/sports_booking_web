# Thông tin cá nhân — hồ sơ, ảnh đại diện và mật khẩu

## Mục tiêu

Tính năng này bổ sung trang `/profile` theo cùng design system của public, customer, owner và admin. Người đã đăng nhập có thể sửa tên hiển thị/số điện thoại, quản lý ảnh đại diện và đổi mật khẩu. Toàn bộ hạ tầng chạy local bằng PostgreSQL, MinIO, NestJS, Prisma và Argon2; không cần dịch vụ trả phí.

## Những gì đã xây

- Profile response an toàn dùng chung cho register, login, refresh và `/me`.
- `PATCH /me` cập nhật tên hiển thị và số điện thoại; email và vai trò chỉ đọc.
- `POST /me/avatar`, `DELETE /me/avatar` và public `GET /users/:userId/avatar` quản lý ảnh JPEG/PNG/WebP tối đa 2 MiB.
- `PATCH /me/password` xác minh mật khẩu hiện tại, thay hash, tăng `securityVersion`, revoke toàn bộ refresh session và xóa refresh cookie.
- Trang `/profile` responsive có preview ảnh, fallback initials, validation phía client, trạng thái loading/error/success và đồng bộ header ngay sau khi lưu.
- Acceptance test đi xuyên HTTP, Prisma, PostgreSQL và MinIO thật để kiểm tra dữ liệu bền vững và session cũ bị vô hiệu.

## Vì sao metadata nằm ở PostgreSQL còn binary nằm ở MinIO?

PostgreSQL giữ quan hệ và trạng thái nhỏ: `avatar_object_key` cho biết object nào thuộc user, còn `avatar_updated_at` tạo query version trong `avatarUrl`. MinIO giữ byte ảnh và content type. Cách tách này tránh làm row/database backup phình to, vẫn cho phép database quyết định quyền sở hữu và giúp thay backend S3-compatible mà không đổi nghiệp vụ.

Client không được gửi hoặc chọn object key. Server luôn tạo key ổn định `user-avatars/<userId>/avatar` từ principal đã xác thực. Response chỉ công bố URL API tương đối, không lộ bucket, credential hay internal object key.

`avatarUrl` có dạng `/api/v1/users/<userId>/avatar?v=<timestamp>`. Khi ảnh thay đổi, timestamp mới làm browser tải lại thay vì tiếp tục dùng bản cache cũ.

## Luồng request và dữ liệu

### Cập nhật hồ sơ

1. Route guard yêu cầu bearer access token và tải principal hiện hành.
2. Validation pipe chỉ nhận `displayName` và `phone`; field lạ bị từ chối.
3. Service chuẩn hóa số điện thoại rồi Prisma cập nhật user.
4. `toPublicUser` tạo response allowlist gồm `id`, `email`, `phone`, `displayName`, `roles`, `avatarUrl`.
5. Web thay user trong session memory/local storage và render lại account summary ở header.

### Tải, đọc và xóa avatar

1. Multer nhận đúng multipart field `avatar` với giới hạn 2 MiB.
2. Policy kiểm tra MIME và magic bytes: JPEG bắt đầu bằng `FF D8 FF`, PNG bằng signature 8 byte, WebP phải có cả `RIFF` và `WEBP`.
3. Server sinh object key từ authenticated user ID rồi ghi byte vào MinIO.
4. Prisma lưu key và thời điểm cập nhật; response nhận URL có cache version.
5. Public image endpoint tra metadata theo user ID rồi stream byte/content type từ MinIO với header cache và `nosniff`.
6. Delete xóa object và đặt hai cột metadata về `null`; gọi lại vẫn trả `204`.

Chỉ kiểm tra extension hoặc MIME do browser gửi là không đủ: attacker có thể đặt tên `avatar.png` và khai `image/png` cho dữ liệu khác. Magic-byte validation chặn dạng giả mạo phổ biến ngay tại ranh giới upload.

### Đổi mật khẩu

1. Access-token guard xác thực request; rate limiter hạn chế thử mật khẩu lặp lại.
2. Argon2 verify `currentPassword` với hash hiện có.
3. Repository thực hiện transaction: lưu hash Argon2 mới, tăng `securityVersion` và revoke mọi refresh session chưa revoke.
4. Endpoint xóa refresh cookie; frontend xóa access token/user local và chuyển tới trang đăng nhập.
5. Mỗi access token chứa security version tại lúc phát hành. Guard luôn so version trong token với user hiện tại, nên token cũ bị `401` ngay sau transaction dù chữ ký JWT vẫn còn hạn.

## Các file quan trọng

- `apps/api/src/auth/public-user.ts`: projection allowlist duy nhất cho user công khai.
- `apps/api/src/auth/identity.repository.ts`: contract lưu avatar và đổi mật khẩu/revoke session atomic.
- `apps/api/src/auth/prisma-identity.repository.ts`: implementation transaction trên PostgreSQL.
- `apps/api/src/storage/user-avatar-policy.ts`: size, MIME, signature và server-owned key.
- `apps/api/src/users/user-avatars.controller.ts`: upload/delete/read binary.
- `apps/api/src/users/users.controller.ts`: `/me` và đổi mật khẩu.
- `apps/web/src/services/profile-api.js`: HTTP client và đồng bộ session.
- `apps/web/src/pages/profile.js`: markup, validation, preview và interactions.
- `apps/api/test/profile.integration-spec.ts`: acceptance test với PostgreSQL/MinIO thật.
- `apps/web/src/pages/profile.test.js`: behavior test của trang profile.

## Cách chạy và kiểm thử

Khởi động hạ tầng miễn phí local và migrate database:

```bash
docker compose up -d postgres minio
npm run db:migrate -w @sports-booking/api
```

Chạy các test tập trung:

```bash
npm test -w @sports-booking/api -- --runTestsByPath src/auth/public-user.spec.ts src/storage/user-avatar-policy.spec.ts src/users/user-avatars.controller.spec.ts src/auth/auth.service.spec.ts
npm test -w @sports-booking/web -- src/pages/profile.test.js
TEST_DATABASE_URL=postgresql://sports:sports_local_password@localhost:5432/sports_booking_test?schema=public TEST_OBJECT_STORAGE=true npm run test:integration -w @sports-booking/api -- --runTestsByPath test/profile.integration-spec.ts
```

Chạy web/API trên host theo `docs/guides/local-development.md`, đăng nhập rồi mở `http://localhost:5173/profile`. MinIO console ở `http://localhost:9001`; username/password nằm trong `.env`. Bucket/object trong console chỉ để quan sát và debug — không chỉnh key thủ công rồi kỳ vọng metadata PostgreSQL tự đồng bộ.

## Lỗi thường gặp và lưu ý bảo mật

- Không tin object key, user ID, MIME hay filename do client gửi; key phải do server sinh từ principal.
- Không trả `passwordHash`, `securityVersion`, refresh session hoặc `avatarObjectKey` trong profile response. Projection allowlist an toàn hơn xóa field theo blacklist.
- Chỉ revoke refresh token mà không tăng `securityVersion` sẽ để access token cũ hoạt động tới khi hết hạn.
- Giới hạn multipart phải nằm trước khi giữ file lớn trong memory; validation frontend chỉ hỗ trợ UX, backend vẫn là chốt bảo mật.
- File signature giúp xác thực định dạng cơ bản nhưng không phải antivirus hoặc image decoder sandbox. Production có thể cần re-encode và malware scan tùy threat model.
- Không log password, hash, JWT, cookie hoặc byte ảnh trong error/test output.
- Xóa/chỉnh object trực tiếp trong MinIO có thể làm metadata PostgreSQL bị lệch. Mọi thay đổi avatar nên đi qua API.
- MinIO local dùng tài nguyên máy và hoàn toàn miễn phí; AWS S3 thật có mô hình tính phí riêng và không được dùng trong luồng học tập này.

## Câu hỏi tự kiểm tra

1. Vì sao database chỉ lưu object key/timestamp thay vì toàn bộ byte ảnh?
2. Vì sao MIME và extension không đủ để xác nhận một file PNG?
3. `securityVersion` làm access token đã phát hành mất hiệu lực như thế nào?
4. Vì sao đổi mật khẩu phải revoke refresh session trong cùng transaction với đổi hash?
5. Vì sao public profile response nên được dựng bằng allowlist?
6. Nếu object đã ghi vào MinIO nhưng transaction metadata thất bại, hệ thống cần chiến lược cleanup nào?
7. Vì sao avatar URL có query version thay vì URL cố định hoàn toàn?
