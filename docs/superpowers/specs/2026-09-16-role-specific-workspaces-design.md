# Thiết kế workspace theo role

**Ngày:** 2026-09-16  
**Phạm vi:** Frontend Vite + vanilla JavaScript  
**Trạng thái:** Chờ người dùng duyệt trước khi lập kế hoạch triển khai

## 1. Mục tiêu

Sau khi đăng nhập, mỗi tài khoản được đưa vào đúng workspace và chỉ nhìn thấy điều hướng phù hợp với role hiệu lực:

- `ADMIN` vào dashboard quản trị tại `/admin`;
- `OWNER` vào dashboard vận hành tại `/owner`;
- `CUSTOMER` vào trang tìm sân tại `/`;
- mọi tài khoản đã đăng nhập vẫn dùng được `/profile` và menu tài khoản để cập nhật hồ sơ, đổi mật khẩu, avatar hoặc đăng xuất.

Không tạo frontend hoặc port riêng cho từng role. Các workspace vẫn chạy trong cùng ứng dụng web tại port `5173`, nhưng dùng route, shell và access policy riêng.

## 2. Nguyên nhân hiện trạng

`renderShell()` hiện luôn render `primary-nav` của Customer, sau đó mới nối thêm `ownerNavigation` hoặc `adminNavigation`. Vì tài khoản seed của Admin có `CUSTOMER + ADMIN` và Owner có `CUSTOMER + OWNER`, họ thấy đồng thời các tab Customer lẫn workspace đặc quyền.

Frontend hiện chỉ dùng `requiresSession()` để phân biệt public/protected. Nó chưa xác định role nào được phép mở route. `mountAuthPage()` cũng luôn chuyển đăng nhập trực tiếp về `/` nếu không có `returnTo`. Backend đã có `RolesGuard`, nhưng việc chỉ dựa vào phản hồi `403` không tạo ra trải nghiệm điều hướng đúng và có thể render nhầm shell trước khi request API thất bại.

## 3. Role hiệu lực và trang mặc định

Một tài khoản có thể giữ nhiều role trong dữ liệu. Frontend chọn một role hiệu lực theo thứ tự đã được duyệt:

1. `ADMIN`
2. `OWNER`
3. `CUSTOMER`

| Roles trong session | Role hiệu lực | Trang mặc định |
|---|---|---|
| `CUSTOMER, ADMIN` | `ADMIN` | `/admin` |
| `CUSTOMER, OWNER` | `OWNER` | `/owner` |
| `CUSTOMER` | `CUSTOMER` | `/` |

Không thêm role switcher trong thay đổi này. Đây là lựa chọn có chủ đích để mỗi phiên chỉ có một ngữ cảnh làm việc rõ ràng, đúng yêu cầu “không thừa, không thiếu”.

## 4. Ma trận route phía frontend

| Nhóm route | Anonymous | Customer | Owner | Admin |
|---|---:|---:|---:|---:|
| `/`, `/venues/:id` | Cho phép | Cho phép | Chuyển về `/owner` | Chuyển về `/admin` |
| `/login`, `/register` | Cho phép | Chuyển về `/` | Chuyển về `/owner` | Chuyển về `/admin` |
| `/bookings`, `/bookings/:id`, `/notifications`, `/owner/apply` | Yêu cầu đăng nhập | Cho phép | Chuyển về `/owner` | Chuyển về `/admin` |
| `/owner`, `/owner/*` trừ `/owner/apply` | Yêu cầu đăng nhập | Chuyển về `/` | Cho phép | Chuyển về `/admin` |
| `/admin`, `/admin/*` | Yêu cầu đăng nhập | Chuyển về `/` | Chuyển về `/owner` | Cho phép |
| `/profile` | Yêu cầu đăng nhập | Cho phép | Cho phép | Cho phép |

Khi người dùng chưa đăng nhập mở route protected, hệ thống giữ hành vi chuyển tới `/login?returnTo=...`. Sau khi đăng nhập, `returnTo` chỉ được dùng nếu role hiệu lực được phép truy cập route đó; nếu không, hệ thống dùng dashboard mặc định. Điều này vừa tránh open redirect vừa tránh đưa tài khoản vào workspace sai role.

Frontend guard chỉ phục vụ trải nghiệm. NestJS role guard và ownership check tiếp tục là lớp bảo mật có thẩm quyền; không thay đổi hoặc nới lỏng backend.

## 5. Application shell và điều hướng

`renderShell()` sẽ chọn đúng một navigation theo role hiệu lực:

- Anonymous và Customer: `Tìm sân`, `Booking của tôi`, `Thông báo`, `Trở thành chủ sân` theo trạng thái hiện có.
- Owner: `Tổng quan`, `Lịch booking`, `Quản lý booking`, `Quản lý sân`, `Lịch & giá`.
- Admin: `Tổng quan`, `Người dùng`, `Hồ sơ owner`, `Kiểm duyệt sân`, `Audit`.

Owner/Admin không render `primary-nav` của Customer. Logo Sports Center dẫn về dashboard của role hiệu lực thay vì luôn dẫn về `/`. Menu tài khoản là phần dùng chung và chỉ chứa:

- `Thông tin cá nhân`;
- `Đăng xuất`.

Hai mục trong dropdown dùng cùng cấu trúc flex, cùng chiều rộng và `justify-content: flex-start`. Nhãn `Đăng xuất` vì vậy căn trái giống `Thông tin cá nhân`, không còn nằm giữa khung.

## 6. Luồng dữ liệu

1. Ứng dụng khôi phục session bằng `POST /auth/refresh` khi cần.
2. Từ `user.roles`, helper thuần xác định role hiệu lực và dashboard mặc định.
3. Route policy kiểm tra pathname hiện tại với role hiệu lực.
4. Nếu không hợp lệ, browser được chuyển về dashboard trước khi page mount hoặc gọi API nghiệp vụ.
5. Nếu hợp lệ, shell chỉ render navigation của workspace đó rồi mount page tương ứng.
6. Đăng nhập thành công dùng cùng helper để xét `returnTo` và chọn đích đến.

Các quyết định role/route được tập trung trong `services/route-access.js`, tránh lặp điều kiện giữa `main.js`, `auth.js` và `shell.js`.

## 7. Files dự kiến thay đổi

- `apps/web/src/services/route-access.js`: role priority, dashboard mặc định và route authorization.
- `apps/web/src/services/route-access.test.js`: ma trận route cho anonymous/customer/owner/admin.
- `apps/web/src/pages/auth.js`: điều hướng sau đăng nhập theo role và `returnTo` hợp lệ.
- `apps/web/src/pages/auth.test.js`: kiểm tra landing route và từ chối `returnTo` sai role.
- `apps/web/src/main.js`: áp dụng route decision trước render/mount.
- `apps/web/src/shell.js`: chỉ render navigation của role hiệu lực và đặt brand destination đúng workspace.
- `apps/web/src/shell.test.js`: kiểm tra navigation loại trừ lẫn nhau và menu account dùng chung.
- `apps/web/src/styles/main.css`: căn trái nhất quán hai mục dropdown.
- `apps/web/e2e/customer.spec.js`, `owner.spec.js`, `admin.spec.js`: kiểm tra landing page, menu đúng role và redirect khi truy cập chéo.
- `docs/learning-notes/role-specific-workspaces.md`: giải thích kiến trúc, luồng request, cách test và lưu ý bảo mật.

## 8. Xử lý lỗi và tình huống biên

- Session không có role hợp lệ được xem là không đủ quyền và quay về trang đăng nhập sau khi xóa trạng thái session cục bộ; không tự đoán role.
- `returnTo` ngoài origin, malformed hoặc không được role cho phép sẽ bị bỏ qua.
- Profile dùng chung không làm lộ menu của role khác.
- Người dùng nhập URL chéo không thấy nội dung workspace sai role trong lúc chờ API.
- URL không tồn tại không được biến thành một trang đặc quyền; hành vi 404 hiện hành chỉ thay đổi nếu cần để guard không tạo vòng redirect.

## 9. Chiến lược kiểm thử

Triển khai theo TDD:

1. Viết unit test thất bại cho role priority, dashboard và toàn bộ route matrix.
2. Viết test shell thất bại chứng minh Admin/Owner không còn customer navigation và chỉ có một workspace navigation.
3. Viết test auth thất bại cho redirect sau đăng nhập và `returnTo` sai role.
4. Cài đặt tối thiểu để các test xanh, sau đó refactor helper chung.
5. Bổ sung E2E cho ba role: login/refresh, landing dashboard, menu đúng role, profile dùng chung và URL chéo bị redirect.
6. Chạy format check, lint, typecheck, web unit test, web E2E và production build.

## 10. Tiêu chí chấp nhận

- Admin đăng nhập trực tiếp vào `/admin` và không thấy bất kỳ tab Customer hoặc Owner nào.
- Owner đăng nhập trực tiếp vào `/owner` và không thấy tab Customer hoặc Admin.
- Customer chỉ thấy navigation Customer.
- Mỗi workspace hiển thị đủ các chức năng đã có của role đó.
- Truy cập URL chéo bị chuyển về dashboard đúng role trước khi mount page.
- `/profile` và đăng xuất hoạt động cho cả ba role.
- `Thông tin cá nhân` và `Đăng xuất` đều căn trái trong dropdown ở desktop và mobile.
- Backend authorization hiện có vẫn nguyên vẹn và toàn bộ kiểm thử liên quan đều đạt.
