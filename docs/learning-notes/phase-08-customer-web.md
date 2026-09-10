# Phase 8 — Trải nghiệm web cho customer

## Đã xây dựng những gì

Phase này hoàn thiện hành trình chính của customer bằng HTML, CSS và JavaScript ES modules:

- Người chưa đăng nhập có thể tìm sân theo môn, khu vực, ngày và khoảng giờ; xem kết quả còn capacity, chi tiết venue, tiện ích, chế độ xác nhận, báo giá và bản đồ.
- Khi khách chưa đăng nhập bấm đặt sân, web chuyển tới `/login` kèm `returnTo`. Sau khi đăng nhập thành công, khách quay lại đúng venue và tiêu chí tìm kiếm trước đó. `returnTo` chỉ chấp nhận đường dẫn nội bộ để tránh open redirect.
- Customer đã đăng nhập có thể tạo booking, lọc danh sách, xem chi tiết và hủy booking còn hợp lệ.
- Trang `/notifications` hỗ trợ tất cả/chưa đọc/đã đọc, liên kết về booking và đánh dấu đã đọc.
- Giao diện có loading, empty, success và error state; skip link, label, live region, keyboard focus, bố cục mobile và chế độ giảm chuyển động.
- Browser E2E chạy trên Chromium kiểm tra hành trình desktop và accessibility/mobile smoke.

## Vì sao chọn thiết kế này

Web vẫn tuân thủ kiến trúc đã khóa: Vite và JavaScript thuần, không thêm framework UI. Mỗi trang có hai phần rõ ràng: hàm `render...` sinh markup dễ unit test và hàm `mount...` nối event/API vào DOM.

Leaflet nằm sau `map-provider.js`. Trang venue chỉ truyền element và tọa độ, không biết tile URL hay cách tạo marker. Cấu hình OpenStreetMap và attribution nằm riêng trong `config/map.js`; khi đổi nhà cung cấp, phạm vi sửa đổi nhỏ và không chạm nghiệp vụ booking.

Web không giữ giá hoặc court vật lý làm dữ liệu có thẩm quyền. Quote, giá chốt, trạng thái và court assignment đều do server quyết định. Access token chỉ giữ trong bộ nhớ; refresh token tiếp tục nằm trong cookie `HttpOnly` do API quản lý.

## Luồng request và dữ liệu

1. `/` gọi `GET /catalog` và `GET /venues` mà không cần token.
2. Form tìm kiếm đổi ngày/giờ Asia/Ho_Chi_Minh thành ISO UTC, gọi lại `GET /venues` và giữ tiêu chí trên URL.
3. `/venues/:id` gọi `GET /venues/:id`, render offering và mount Leaflet bằng tọa độ venue.
4. Nút báo giá gọi `POST /offerings/:id/quotes`. UI chặn khoảng giờ rỗng hoặc đảo ngược trước khi gửi.
5. Nút đặt sân gọi `ensureSession()`. Nếu chưa đăng nhập, browser đi tới login kèm đường dẫn trở lại; nếu đã đăng nhập, web gửi `POST /bookings`. Form giữ cùng một `Idempotency-Key` cho cùng offering/khoảng giờ khi retry và khóa submit trong lúc request đang chạy.
6. `/bookings` và `/bookings/:id` dùng bearer token để đọc resource của principal; thao tác hủy gọi endpoint cancel của chính booking đó.
7. `/notifications` gọi API theo filter `unread`; thao tác mark-read cập nhật đúng notification rồi phản hồi ngay trên live region.

## Các file quan trọng

- `apps/web/src/pages/venues.js`: search, venue detail, tiêu chí trên URL và map mount.
- `apps/web/src/pages/bookings.js`: quote/create, list/filter, detail/cancel và kiểm tra khoảng giờ.
- `apps/web/src/pages/notifications.js`: notification list/filter/mark-read.
- `apps/web/src/services/map-provider.js`: adapter Leaflet có thể thay thế.
- `apps/web/src/config/map.js`: tile URL, attribution và zoom.
- `apps/web/src/pages/auth.js`: safe `returnTo` sau đăng nhập.
- `apps/web/src/styles/main.css`: responsive, focus và reduced motion.
- `apps/web/e2e/customer.spec.js`: hành trình customer trên Chromium.

## Cách chạy và kiểm thử

```bash
npm run dev:web
npm test -w @sports-booking/web
npm run lint -w @sports-booking/web
npm run typecheck -w @sports-booking/web
npm run build -w @sports-booking/web
npm run test:e2e -w @sports-booking/web
```

Playwright tự khởi động Vite ở port `4173`. Lần đầu cần cài Chromium bằng `npx playwright install chromium`. Browser E2E giả lập response API tại ranh giới HTTP để tập trung kiểm tra routing và DOM; API integration/E2E tiếp tục chạy riêng với PostgreSQL thật.

Với toàn bộ stack local:

```bash
docker compose up --build
```

Sau đó mở `http://localhost:5173`. Tile bản đồ cần kết nối tới OpenStreetMap; nếu tile lỗi, địa chỉ venue vẫn hiển thị và UI có fallback.

## Lỗi thường gặp và lưu ý bảo mật

- Không dùng giờ local như UTC. Web gắn offset `+07:00` rồi chuyển thành ISO; server vẫn là nơi kiểm tra cuối cùng.
- Không tin `price`, `ownerId` hoặc `courtId` từ browser. Form customer không gửi các trường này.
- Không đưa access token vào `localStorage`; XSS có thể đọc dữ liệu đó. Luồng hiện tại giữ access token trong memory.
- Không redirect trực tiếp tới giá trị query tùy ý. `returnTo` phải bắt đầu bằng `/` và sau khi parse vẫn phải cùng origin.
- Không truyền chuỗi do owner nhập thẳng vào `Leaflet.bindPopup`, vì Leaflet có thể hiểu chuỗi đó là HTML. Adapter tạo DOM node và gán `textContent` để tên venue không trở thành stored XSS.
- Không tạo `Idempotency-Key` mới cho mỗi lần double-click/retry cùng ý định. Form tái sử dụng key cho cùng payload và chỉ xoay key khi khoảng giờ thay đổi.
- Không bỏ attribution của nhà cung cấp tile. Adapter luôn truyền attribution khi tạo layer.
- Marker/map không thay thế địa chỉ dạng text; fallback này quan trọng cho accessibility và lúc mạng ngoài lỗi.
- Unit test DOM không thay thế browser E2E, và browser E2E mock API không thay thế database/API E2E. Hai tầng kiểm thử bắt các nhóm lỗi khác nhau.

## Câu hỏi tự kiểm tra

1. Vì sao người chưa đăng nhập vẫn được gọi `GET /venues` và quote nhưng không được gọi `POST /bookings`?
2. `returnTo` có thể tạo lỗ hổng gì nếu chấp nhận URL bên ngoài?
3. Tại sao tile URL nên nằm sau map adapter thay vì viết trực tiếp trong trang venue?
4. Vì sao client vẫn phải gửi `Idempotency-Key` dù server đã có transaction chống double booking?
5. Browser E2E mock API và API E2E với PostgreSQL thật bổ sung cho nhau như thế nào?
