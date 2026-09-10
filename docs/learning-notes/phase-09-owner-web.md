# Phase 9 — Trải nghiệm web cho owner

## Đã xây dựng những gì

Phase này hoàn thiện khu vực vận hành dành cho chủ sân bằng HTML, CSS và JavaScript ES modules:

- `/owner` hiển thị số địa điểm, địa điểm đã duyệt, booking chờ duyệt và booking đã xác nhận.
- `/owner/calendar` hiển thị lịch booking theo tuần, cho đổi tuần và lọc theo địa điểm.
- `/owner/bookings` có filter theo địa điểm, trạng thái, khoảng ngày và thứ tự; mỗi booking liên kết tới trang chi tiết.
- `/owner/bookings/:id` hiển thị customer contact, sân vật lý, giá chốt và đúng nhóm thao tác theo trạng thái: confirm, reject, cancel hoặc reassign.
- `/owner/venues` hỗ trợ tạo/sửa/lưu trữ venue, cập nhật ảnh/tiện ích, tạo/sửa offering, thêm/đổi tên/bật-tắt court.
- `/owner/schedule` hiển thị và thay thế toàn bộ operating hours, đồng thời tạo/sửa/xóa closure và pricing rule.
- Navigation owner, trạng thái loading/empty/success/error, live region, keyboard focus và bố cục mobile được hoàn thiện.
- API owner booking detail được mở rộng có kiểm soát với `displayName`, `email`, `phone` của customer.

## Vì sao chọn thiết kế này

Các màn owner được tách khỏi trang public/customer thành `owner-dashboard.js`, `owner-calendar.js`, `owner-bookings.js` và `owner-venues.js`. Mỗi module giữ hai lớp rõ ràng: hàm `render...` chỉ sinh markup để unit test nhanh, còn hàm `mount...` chịu trách nhiệm gọi API và xử lý event.

Dashboard là điểm vào ngắn gọn thay vì đặt mọi biểu mẫu trên một trang. Calendar dùng tuần từ thứ hai và khoảng nửa mở `[startAt,endAt)`, phù hợp với quy ước booking của server. List và detail tách riêng để owner có thể lọc nhanh nhưng vẫn xem đủ dữ liệu trước khi thay đổi trạng thái.

Web chỉ hỗ trợ thao tác; API vẫn là nguồn quyết định cuối cùng. Browser không gửi `ownerId`, không tự tính giá và không thể ép chuyển sang court tùy ý. Khi reassign, UI chỉ liệt kê court active cùng offering, nhưng server vẫn kiểm tra ownership, offering, trạng thái và overlap.

## Luồng request và dữ liệu

1. `/owner` gọi song song `GET /owner/venues` và `GET /owner/bookings` để tạo số liệu tổng quan.
2. Calendar đổi ngày tham chiếu thành thứ hai đầu tuần, gửi `from` lúc `00:00 +07:00` và `to` là thứ hai tuần kế tiếp. Booking được nhóm theo ngày tại `Asia/Ho_Chi_Minh`.
3. Booking list chỉ đưa các filter được phép vào query. Helper tải đủ các page API (mỗi page tối đa 100 item) để list, calendar và dashboard không bỏ sót booking vận hành. Detail gọi `GET /owner/bookings/:id`, sau đó lấy owner venue để xây danh sách court thay thế cùng offering.
4. Confirm gửi body rỗng; reject/cancel gửi `{reason}`; reassign gửi `{courtId}`. Khi một action đang chờ, toàn bộ nhóm action bị khóa để tránh hai response chạy đua; sau mutation, UI render response mới nhất từ server.
5. Venue page tải catalog và owner venues. Mọi mutation thành công đều tải lại danh sách để trạng thái kiểm duyệt, offering và court luôn phản ánh server.
6. Schedule page tải operating hours, closures và pricing rules của từng venue/offering. PUT operating hours luôn gửi toàn bộ các window được giữ hoặc thêm, tránh vô tình xóa ngày khác.
7. Closure dùng ISO UTC ở API nhưng trường `datetime-local` hiển thị giờ Thành phố Hồ Chí Minh. Tiền VND gửi dưới dạng số nguyên.

## Các file quan trọng

- `apps/web/src/pages/owner-dashboard.js`: số liệu và liên kết tác vụ owner.
- `apps/web/src/pages/owner-calendar.js`: tính tuần, filter và lịch bảy ngày.
- `apps/web/src/pages/owner-bookings.js`: list/detail và booking actions.
- `apps/web/src/pages/owner-venues.js`: CRUD venue, offering và court.
- `apps/web/src/pages/schedule-pricing.js`: operating hours, closure và pricing CRUD.
- `apps/web/src/main.js`: owner routes và bảo vệ session.
- `apps/web/src/shell.js`: navigation customer/owner có landmark riêng.
- `apps/web/src/styles/main.css`: dashboard, calendar, form quản lý, focus và responsive.
- `apps/api/src/bookings/bookings.service.ts`: contact projection chỉ dành cho owner view.
- `apps/web/e2e/owner.spec.js`: hành trình vận hành owner trên Chromium.

## Cách chạy và kiểm thử

```bash
npm test -w @sports-booking/web
npm run lint -w @sports-booking/web
npm run typecheck -w @sports-booking/web
npm run build -w @sports-booking/web
npm run test:e2e -w @sports-booking/web
```

Kiểm tra API booking owner với PostgreSQL test đã migrate:

```bash
TEST_DATABASE_URL=postgresql://sports:sports_local_password@localhost:5432/sports_booking_test?schema=public npm run test:integration -w @sports-booking/api
TEST_DATABASE_URL=postgresql://sports:sports_local_password@localhost:5432/sports_booking_test?schema=public npm run test:e2e -w @sports-booking/api
```

Browser E2E mock API tại ranh giới HTTP để kiểm tra routing, form, trạng thái và responsive ổn định. API integration/E2E riêng dùng PostgreSQL thật để kiểm tra ownership và nghiệp vụ.

## Lỗi thường gặp và lưu ý bảo mật

- Không gửi `ownerId`, `price` hoặc customer ID do người dùng tự nhập. Principal luôn lấy từ access token, còn giá do server tính.
- Không coi danh sách court trong `<select>` là lớp bảo mật. Request có thể bị sửa; API vẫn phải kiểm tra court thuộc đúng owner và offering.
- Không hiển thị customer contact trong public/customer projection. Owner chỉ nhận contact của booking thuộc venue mình; resource của owner khác trả `404` để hạn chế dò ID.
- Không gửi riêng một operating window khi endpoint có nghĩa “replace”. Phải gửi toàn bộ window muốn giữ lại.
- Không dùng giờ `datetime-local` như UTC. UI gắn offset `+07:00`, API lưu timestamp UTC và mọi khoảng booking dùng `[startAt,endAt)`.
- Không dùng số thực cho VND. `pricePerSlot` và `priceAmount` là số nguyên.
- Không hiển thị action không hợp lệ với status hiện tại. UI giúp tránh thao tác nhầm, nhưng state machine server vẫn là lớp kiểm tra cuối cùng.
- Không cho submit lặp trong lúc request đang chạy. Nút được disable và màn hình lấy lại response mới nhất sau mutation.
- Không đưa chuỗi từ API vào `innerHTML` mà không escape. Các giá trị venue, customer, reason và court đều đi qua `escapeHtml`.

## Câu hỏi tự kiểm tra

1. Vì sao calendar dùng `to` là đầu tuần kế tiếp thay vì 23:59:59 ngày chủ nhật?
2. Vì sao UI lọc court active cùng offering vẫn chưa đủ để bảo vệ thao tác reassign?
3. Điều gì xảy ra nếu PUT operating hours chỉ gửi một window vừa chỉnh sửa?
4. Tại sao customer contact chỉ nên xuất hiện trong owner booking projection?
5. Vì sao sau mutation nên render response server hoặc tải lại resource thay vì tự đoán trạng thái mới?
