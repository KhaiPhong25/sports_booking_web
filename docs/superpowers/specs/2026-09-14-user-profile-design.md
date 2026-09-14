# Thiết kế trang thông tin cá nhân

## Mục tiêu

Xây dựng một trang `/profile` thống nhất với design system Urban Performance để người dùng đã đăng nhập có thể xem và chỉnh sửa thông tin cá nhân, quản lý ảnh đại diện và đổi mật khẩu. Toàn bộ luồng phải chạy local bằng thành phần miễn phí, không phụ thuộc CDN, dịch vụ lưu trữ ảnh, dịch vụ xác thực hoặc API thương mại.

## Phạm vi

### Trong phạm vi

- Hiển thị họ tên, email, số điện thoại, vai trò và ảnh đại diện hiện tại.
- Cập nhật họ tên và số điện thoại; email và vai trò chỉ đọc.
- Upload, thay thế và xóa ảnh đại diện.
- Đổi mật khẩu sau khi xác minh mật khẩu hiện tại.
- Thu hồi mọi phiên đăng nhập sau khi đổi mật khẩu và yêu cầu đăng nhập lại.
- Thêm liên kết hồ sơ vào khối tài khoản trên header.
- Hỗ trợ responsive, thao tác bàn phím, trạng thái loading/error/success và mô tả ảnh phù hợp.

### Ngoài phạm vi

- Đổi email hoặc xác minh email/số điện thoại.
- Cắt ảnh trong trình duyệt, bộ lọc ảnh hoặc ảnh bìa.
- Khôi phục mật khẩu qua email.
- OAuth/social login.
- CDN, AWS S3 có tính phí hoặc dịch vụ xử lý ảnh bên thứ ba.

## Kiến trúc và lựa chọn công nghệ

Frontend tiếp tục dùng Vite, HTML, CSS và JavaScript ES modules. API tiếp tục dùng NestJS và Prisma. Ảnh được gửi dạng `multipart/form-data` qua API rồi lưu trong MinIO chạy bằng Docker Compose; PostgreSQL chỉ lưu object key và thời điểm ảnh được cập nhật.

Không lưu binary/base64 trong PostgreSQL vì làm phình database và backup. Không dùng presigned upload trong MVP vì cần thêm CORS, trạng thái upload và cơ chế dọn file mồ côi nhưng không mang lại lợi ích đáng kể cho ảnh tối đa 2 MB chạy local.

Các thành phần đều miễn phí hoặc mã nguồn mở trong cấu hình local hiện tại:

- PostgreSQL lưu metadata người dùng.
- MinIO lưu object ảnh.
- NestJS nhận, kiểm tra và phân phối ảnh.
- Argon2 băm mật khẩu.
- Vitest/Jest/Supertest/Playwright phục vụ kiểm thử.

## Mô hình dữ liệu

Thêm hai trường nullable vào `User`:

- `avatarObjectKey`: object key do server tạo, không nhận từ client.
- `avatarUpdatedAt`: thời điểm ảnh thay đổi để tạo cache-busting URL.

Không lưu URL tuyệt đối vì host có thể khác giữa local và môi trường triển khai. API sinh `avatarUrl` dạng `/api/v1/users/:id/avatar?v=<timestamp>` khi trả user công khai. Khi chưa có ảnh, `avatarUrl` là `null` và frontend hiển thị chữ cái đầu của tên.

Object key ổn định theo user, ví dụ `user-avatars/<userId>/avatar`. Việc thay ảnh ghi đè cùng object, tránh tích lũy file cũ. Khi xóa ảnh, API xóa object và đặt hai trường avatar về `null`.

## API contract

### Hồ sơ

- `GET /api/v1/me`: trả `id`, `email`, `phone`, `displayName`, `roles`, `avatarUrl`.
- `PATCH /api/v1/me`: nhận `displayName` và/hoặc `phone`, trả hồ sơ đã cập nhật.

### Ảnh đại diện

- `POST /api/v1/me/avatar`: bearer token + multipart field `avatar`; trả hồ sơ đã cập nhật.
- `DELETE /api/v1/me/avatar`: bearer token; trả `204`.
- `GET /api/v1/users/:id/avatar`: trả binary ảnh hoặc `404` nếu không có.

Ảnh đại diện được xem như dữ liệu hiển thị công khai tương tự tên hiển thị. Endpoint đọc ảnh không yêu cầu bearer token để thẻ `<img>` có thể dùng trực tiếp; UUID khiến URL không dễ đoán nhưng không được coi là cơ chế bảo mật. Response đặt `X-Content-Type-Options: nosniff` và cache header phù hợp với query version.

Upload chỉ chấp nhận JPEG, PNG hoặc WebP tối đa 2 MB. API kiểm tra cả MIME khai báo và chữ ký file, không chỉ tin `Content-Type` do trình duyệt gửi. Object key luôn được tạo từ `userId` trong access token.

### Đổi mật khẩu

- `PATCH /api/v1/me/password`: nhận `{ currentPassword, newPassword }`, trả `204` khi thành công và xóa refresh cookie.

Backend xác minh mật khẩu hiện tại bằng Argon2, yêu cầu mật khẩu mới dài 12–128 ký tự và từ chối khi mật khẩu mới giống mật khẩu hiện tại. Cập nhật password hash, tăng `securityVersion` và thu hồi mọi refresh session trong cùng transaction. Access token cũ mất hiệu lực do guard đối chiếu `securityVersion`; frontend xóa session trong bộ nhớ và chuyển tới `/login?reason=password-changed`.

Thông báo sai mật khẩu không tiết lộ password hash hay chi tiết nội bộ. Endpoint được bảo vệ bởi access token và rate limit để hạn chế thử mật khẩu liên tục.

## Giao diện và trải nghiệm

Trang `/profile` dùng bố cục hai cột trên desktop và một cột trên mobile:

- Cột tóm tắt: avatar lớn, tên, email, badge vai trò và hành động chọn/xóa ảnh.
- Cột nội dung: card “Thông tin cá nhân” và card “Bảo mật tài khoản”.

Ảnh được preview tại client trước khi upload. Nút lưu có trạng thái đang xử lý và không gửi lặp. Mỗi form có vùng `role="status"`/`aria-live`; lỗi validation được gắn với trường tương ứng. Trường chọn file có label rõ ràng và thông báo định dạng/dung lượng. Form đổi mật khẩu có nút hiện/ẩn mật khẩu và trường xác nhận chỉ để validation phía client; API chỉ nhận mật khẩu hiện tại và mật khẩu mới.

Khối tài khoản trên header trở thành liên kết tới `/profile`, dùng ảnh thật nếu có và fallback bằng chữ cái đầu. `/profile` là protected route; khách chưa đăng nhập được chuyển về login rồi quay lại profile sau khi xác thực.

## Luồng dữ liệu

### Mở và cập nhật hồ sơ

1. `authApi.ensureSession()` khôi phục access token và user từ refresh cookie.
2. Trang gọi `GET /me` để lấy dữ liệu mới nhất.
3. Người dùng sửa tên/số điện thoại và gửi `PATCH /me`.
4. API chuẩn hóa số điện thoại, cập nhật database và trả profile mới.
5. Frontend đồng bộ user trong `authApi`, cập nhật form và header mà không reload toàn trang.

### Thay ảnh

1. Frontend kiểm tra sơ bộ loại và kích thước, rồi hiển thị preview.
2. API xác thực user, kiểm tra file và ghi object vào MinIO.
3. Sau khi ghi thành công, API cập nhật metadata avatar trong PostgreSQL.
4. Response trả URL có version mới; browser tải lại ảnh thay vì dùng cache cũ.
5. Nếu cập nhật database thất bại, object ổn định có thể được ghi lại ở lần upload sau; profile không trỏ tới object khi metadata chưa thành công.

### Đổi mật khẩu

1. Frontend kiểm tra xác nhận mật khẩu và gửi current/new password.
2. API xác minh current password.
3. Repository đổi hash, tăng security version và revoke sessions trong transaction.
4. API xóa refresh cookie; frontend xóa access token/user trong memory.
5. Người dùng được chuyển về trang đăng nhập với thông báo đổi mật khẩu thành công.

## Xử lý lỗi

- `400`: DTO không hợp lệ, số điện thoại sai, file sai định dạng/kích thước hoặc mật khẩu mới trùng mật khẩu cũ.
- `401`: thiếu token, token hết hiệu lực hoặc mật khẩu hiện tại không đúng.
- `404`: user/ảnh không tồn tại.
- `429`: vượt rate limit đổi mật khẩu.
- `5xx`: lỗi MinIO/database; frontend giữ dữ liệu cũ, thông báo có thể thử lại và không giả báo thành công.

Upload MinIO hoàn tất trước khi database được cập nhật. Vì dùng object key ổn định, lỗi giữa hai bước không làm database trỏ tới file không tồn tại và không tạo vô hạn object rác.

## Kiểm thử

Thực hiện theo chu trình TDD, mỗi hành vi có test thất bại đúng nguyên nhân trước khi thêm production code.

### Backend

- Profile response có `avatarUrl` đúng hoặc `null` và không lộ object key/password hash.
- Upload hợp lệ lưu đúng key của user và cập nhật metadata.
- File quá 2 MB, MIME sai hoặc chữ ký giả bị từ chối.
- User không thể chọn object key hay ghi avatar cho user khác.
- Xóa avatar xóa metadata và object; xóa khi chưa có ảnh vẫn an toàn/idempotent.
- Đổi mật khẩu sai current password không đổi dữ liệu.
- Đổi thành công tạo hash mới, tăng security version, revoke mọi session và làm token cũ mất hiệu lực.
- Transaction thất bại không để trạng thái mật khẩu/session cập nhật một phần.

### Frontend

- Route `/profile` yêu cầu đăng nhập và link tài khoản trỏ đúng route.
- Trang render đầy đủ profile, role, fallback avatar và ảnh thật.
- Cập nhật thông tin gửi đúng payload và đồng bộ header.
- Upload dùng `FormData`, có preview và xử lý lỗi.
- Xác nhận mật khẩu không khớp không gọi API.
- Đổi mật khẩu thành công xóa session client và chuyển về login.
- Các control quan trọng có accessible name và layout hoạt động ở mobile/desktop.

### Verification cuối

- Format, lint, typecheck và toàn bộ unit test liên quan.
- API integration/E2E cho profile, avatar và invalidated session.
- Build production của API và web.
- Smoke test local với PostgreSQL + MinIO qua Docker Compose.

## Tài liệu cần cập nhật

- `docs/architecture/api-contract.md` cho endpoint và response mới.
- OpenAPI decorators/DTO trong source NestJS.
- Learning note tiếng Việt mô tả profile, avatar, bảo mật và cách test.
- `README.md` nếu thao tác demo hoặc giới hạn file cần được nêu trong hướng dẫn sử dụng.

## Tiêu chí hoàn thành

- Người dùng đã đăng nhập truy cập được `/profile` từ header.
- Họ tên/số điện thoại được sửa và phản ánh ngay trên giao diện.
- Ảnh JPEG/PNG/WebP hợp lệ được lưu hoàn toàn local trong MinIO, có thể thay và xóa.
- Mật khẩu chỉ đổi khi current password đúng; toàn bộ phiên cũ bị thu hồi.
- Không gọi hay yêu cầu tài khoản của bất kỳ dịch vụ trả phí nào.
- Các quality gate liên quan chạy thành công và có bằng chứng cụ thể.
