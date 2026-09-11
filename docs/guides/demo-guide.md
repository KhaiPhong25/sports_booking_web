# Hướng dẫn demo MVP

## Chuẩn bị

```bash
docker compose up -d --build
docker compose exec api npm run db:seed -w @sports-booking/api
```

Mở `http://localhost:5173`. Tất cả tài khoản demo dùng mật khẩu `LocalDemo123!` và chỉ dành cho local.

| Vai trò  | Email                   | Dữ liệu nổi bật                                              |
| -------- | ----------------------- | ------------------------------------------------------------ |
| Admin    | `admin@sports.local`    | `CUSTOMER + ADMIN`, moderation và audit                      |
| Owner 1  | `owner1@sports.local`   | `CUSTOMER + OWNER`, Sân Xanh Trung Tâm, instant confirmation |
| Owner 2  | `owner2@sports.local`   | `CUSTOMER + OWNER`, Nhà Thi Đấu Thủ Đức, owner approval      |
| Customer | `customer@sports.local` | booking demo confirmed/pending/cancelled                     |

## 1. Public chưa đăng nhập

1. Mở trang chủ, lọc theo bóng đá/cầu lông, khu vực và một khoảng giờ trong tương lai.
2. Mở chi tiết venue, xem giá, availability và bản đồ.
3. Chọn đặt sân. Web đưa tới login và giữ đường quay lại; API từ chối `POST /bookings` không có token bằng `401`.

Điểm cần quan sát: public không thấy internal court name và không gửi price/court ID.

## 2. Customer

1. Đăng nhập `customer@sports.local`.
2. Chọn khoảng còn trống, lấy quote rồi tạo booking.
3. Mở `/bookings`, lọc status, xem chi tiết và hủy nếu còn trong cancellation window.
4. Mở `/notifications`, lọc unread và đánh dấu một notification là đã đọc.
5. Xem MailHog để thấy email async; email lỗi không rollback booking.

Offering bóng đá demo dùng `INSTANT`; cầu lông dùng `OWNER_APPROVAL`, phù hợp để so sánh `CONFIRMED` và `PENDING`.

## 3. Owner

1. Đăng nhập owner tương ứng và mở `/owner`.
2. Xem lịch tuần, danh sách/detail booking và thông tin liên hệ customer.
3. Với booking pending thuộc venue của mình: confirm/reject/reassign; owner khác không đọc hoặc thao tác được.
4. Mở inventory để tạo/sửa/archive venue, offering/court; thử tắt court có booking tương lai để thấy conflict.
5. Mở schedule để chỉnh operating hours, closure và pricing rule. Interval/rule overlap bị server từ chối.

Venue đã duyệt bị đưa về `PENDING_APPROVAL` khi sửa nội dung public và cần admin duyệt lại.

## 4. Admin

1. Đăng nhập `admin@sports.local` và mở `/admin`.
2. Tìm/lọc user, khóa/mở khóa một tài khoản khác. Admin không thể tự khóa.
3. Lọc owner applications, duyệt/từ chối hồ sơ pending.
4. Lọc venue, approve/reject pending hoặc hide approved venue.
5. Mở `/admin/audit-logs` và kiểm tra actor/action/resource/before-after của thao tác vừa thực hiện.

Admin moderation không đồng nghĩa ownership: admin không CRUD venue thay owner và không xử lý booking mặc định.

## 5. Kết thúc demo

```bash
docker compose down
```

Lệnh này giữ dữ liệu. Chạy seed lại chỉ cập nhật một phần fixture chính và không hoàn tác mọi thay đổi venue/schedule/price đã thực hiện trong demo. Muốn reset tuyệt đối, làm theo mục reset có chủ đích trong hướng dẫn local development; thao tác đó dùng `docker compose down -v` và xóa toàn bộ dữ liệu trong ba named volumes.
