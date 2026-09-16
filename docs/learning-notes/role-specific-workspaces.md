# Workspace riêng theo role

## Đã xây dựng

Frontend Sports Center hiện chia trải nghiệm thành ba workspace trong cùng một ứng dụng web:

- Customer vào `/`, tìm sân, quản lý booking, thông báo và đăng ký trở thành Owner.
- Owner vào `/owner`, quản lý lịch booking, booking, địa điểm, sân con, lịch hoạt động và giá.
- Admin vào `/admin`, quản lý người dùng, hồ sơ Owner, kiểm duyệt địa điểm và audit log.

Owner và Admin không còn nhìn thấy navigation Customer. Một URL thuộc role khác cũng không được render tạm thời: frontend chuyển người dùng về dashboard đúng role trước khi mount trang và gọi API nghiệp vụ.

Menu tài khoản vẫn dùng chung cho cả ba role. Hai action “Thông tin cá nhân” và “Đăng xuất” có cùng chiều rộng, icon/nhãn và căn trái bằng `justify-content: flex-start`.

## Lý do thiết kế

Một user trong database có thể có nhiều role. Seed Admin có `CUSTOMER + ADMIN`; seed Owner có `CUSTOMER + OWNER`. Vì vậy kiểm tra đơn giản như `roles.includes("OWNER")` cho từng menu sẽ làm nhiều navigation xuất hiện cùng lúc.

Frontend giải quyết bằng một **role hiệu lực** với thứ tự cố định:

1. `ADMIN`
2. `OWNER`
3. `CUSTOMER`

`effectiveRole()` và `workspaceHome()` là các hàm thuần dùng chung. Admin luôn có ngữ cảnh quản trị, Owner có ngữ cảnh vận hành, còn tài khoản chỉ có Customer dùng ngữ cảnh đặt sân. MVP chưa có role switcher để tránh trộn quyền và làm giao diện khó hiểu.

Policy route nằm tập trung trong `route-access.js` thay vì rải điều kiện ở trang đăng nhập, bootstrap và shell. Khi thêm route mới, lập trình viên có một nơi rõ ràng để khai báo workspace sở hữu route đó.

## Luồng điều hướng

### Mở một URL

1. `main.js` gọi `POST /api/v1/auth/refresh` qua `authApi.ensureSession()` để khôi phục access token và user.
2. `redirectForRoute()` nhận pathname, query string và user hiện tại.
3. Nếu route cần đăng nhập nhưng chưa có session, helper tạo `/login?returnTo=...`.
4. Nếu đã đăng nhập nhưng route không thuộc role hiệu lực, helper trả dashboard của role đó.
5. Chỉ khi helper trả `null`, ứng dụng mới render shell và mount page.

Ví dụ: Admin có roles `CUSTOMER + ADMIN` mở `/bookings`. Role hiệu lực là `ADMIN`, `/bookings` không thuộc workspace Admin, nên browser chuyển sang `/admin` trước khi `mountCustomerBookings()` có thể chạy.

### Đăng nhập

1. Form gọi `POST /api/v1/auth/login`.
2. Response trả `user.roles` cùng access token.
3. `loginReturnPath()` kiểm tra `returnTo` có cùng origin và có thuộc role hiệu lực không.
4. `returnTo` hợp lệ được giữ lại; ngược lại dùng `/admin`, `/owner` hoặc `/`.

Kiểm tra origin ngăn open redirect như `returnTo=https://evil.example`. Kiểm tra role ngăn Owner đăng nhập rồi bị đưa vào một URL Admin cũ.

### Render shell

`renderShell()` tính role hiệu lực một lần và chỉ sinh đúng một navigation:

- `.primary-nav` cho anonymous/Customer;
- `.owner-nav` cho Owner;
- `.admin-nav` cho Admin.

Logo Sports Center cũng dẫn về workspace home tương ứng. `/profile` và account dropdown là phần dùng chung, không phải navigation của một role cụ thể.

## Files quan trọng

- `apps/web/src/services/route-access.js`: role priority, workspace home, route matrix và redirect decision.
- `apps/web/src/main.js`: khôi phục session và áp dụng redirect trước render/mount.
- `apps/web/src/pages/auth.js`: chọn trang đến sau đăng nhập và kiểm tra `returnTo`.
- `apps/web/src/shell.js`: chọn navigation và brand destination theo role hiệu lực.
- `apps/web/src/styles/main.css`: layout account dropdown và căn trái action.
- `apps/web/src/services/route-access.test.js`: unit test cho ma trận role/route.
- `apps/web/src/shell.test.js`: unit test navigation loại trừ lẫn nhau và account menu.
- `apps/web/e2e/customer.spec.js`, `owner.spec.js`, `admin.spec.js`: kiểm thử trình duyệt cho từng workspace và truy cập chéo.

## Chạy và kiểm thử

Chạy frontend khi phát triển:

```bash
npm run dev -w @sports-booking/web
```

Chạy các quality gate của frontend:

```bash
npm run lint -w @sports-booking/web
npm run typecheck -w @sports-booking/web
npm test -w @sports-booking/web
npm run build -w @sports-booking/web
npm run test:e2e -w @sports-booking/web
```

Playwright cần được phép mở port `4173`. Nếu môi trường sandbox báo `listen EPERM`, chạy command bên ngoài sandbox hoặc cấp quyền cho command E2E; không sửa application code để né lỗi môi trường này.

## Lỗi thường gặp và bảo mật

- **Chỉ ẩn menu là chưa đủ.** Người dùng vẫn có thể nhập URL hoặc gọi API thủ công. Frontend route guard cải thiện UX; NestJS `AccessTokenGuard`, `RolesGuard` và ownership check mới là lớp bảo mật thật.
- **Kiểm tra từng role độc lập bằng `includes()`.** User nhiều role sẽ thấy nhiều workspace. Luôn dùng `effectiveRole()` khi quyết định shell hoặc landing page.
- **Tin mọi `returnTo`.** Điều này tạo open redirect hoặc đưa user sang workspace sai role. Phải kiểm tra origin và `canAccessRoute()`.
- **Redirect sau khi đã mount trang.** Page có thể gọi API sai role hoặc lóe nội dung không phù hợp. Quyết định redirect phải xảy ra trước `renderShell()` và mọi hàm `mount...()`.
- **Dùng `text-align: left` nhưng quên flex alignment.** Button có thể vẫn căn giữa do `justify-content`. Dropdown hiện đặt cả `text-align: left` và `justify-content: flex-start`.
- **Nới backend guard vì frontend đã chặn.** Không được làm vậy. JavaScript phía browser có thể bị thay đổi hoặc bỏ qua hoàn toàn.

## Câu hỏi tự kiểm tra

1. Vì sao Admin có role `CUSTOMER` nhưng không được hiển thị navigation Customer?
2. `workspaceHome()` khác `canAccessRoute()` ở trách nhiệm nào?
3. Vì sao redirect frontend không thể thay thế `RolesGuard` của NestJS?
4. Điều gì xảy ra khi Owner mở trực tiếp `/admin/users`?
5. Tại sao `/profile` được xem là route dùng chung thay vì route Customer?
6. Khi thêm một trang Admin mới, những unit/E2E test nào cần được cập nhật?
