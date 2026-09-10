# Phase 04 — Venue và court inventory

## Mục tiêu và kết quả

- Public, không cần đăng nhập, xem danh sách phân trang và chi tiết venue đã duyệt.
- Owner đã có role quản lý venue của mình, tiện ích, ảnh MinIO, sport offering và physical court.
- Court có thể bật/tắt để biểu diễn bảo trì hoặc sự cố.
- Admin xem venue chờ duyệt, approve/reject/hide và tạo audit.
- Venue mới có trạng thái `PENDING_APPROVAL`; sửa nội dung venue đang public đưa nó về hàng chờ duyệt.
- Public response không lộ `ownerId`, lý do moderation hoặc tên physical court nội bộ.

## Vì sao chọn mô hình Venue → Offering → Court

Customer chọn môn/loại sân (`VenueSportOffering`), còn booking sau này để server chọn `Court`. Điều này cho phép một venue có nhiều sân cầu lông tương đương mà không bắt khách hiểu mã nội bộ. `confirmationMode`, số ngày đặt trước và chính sách hủy nằm trên offering vì đó là hành vi chung của loại sân.

Ảnh được lưu trong bucket MinIO private; PostgreSQL chỉ giữ object key, URL API, alt text và thứ tự. Public đọc ảnh qua API sau khi kiểm tra venue đã `APPROVED`, thay vì mở wildcard public-read cho cả bucket. Ownership được kiểm tra trong service trước mọi ghi, không nhận `ownerId` từ request body.

## Luồng request/data

1. Public `GET /venues` chỉ query status `APPROVED` và offering/court active.
2. Owner request phải qua access + role guard, sau đó service so sánh `venue.ownerId` với principal.
3. Upload kiểm tra ownership trước, sau đó validate MIME/5 MB, sinh object key phía server, ghi MinIO và lưu metadata.
4. Admin moderation cập nhật status và audit trong một transaction.
5. UI public, owner inventory và admin moderation gọi cùng REST API qua ES modules.

## File quan trọng

- `apps/api/src/venues/venues.service.ts`, `venue.repository.ts`
- `apps/api/src/venues/prisma-venue.repository.ts`, các controller trong module
- `apps/api/src/storage/`
- `apps/web/src/pages/venues.js`
- `apps/api/test/venues.e2e-spec.ts`, `apps/api/src/venues/venues.service.spec.ts`

## Chạy và test

```bash
npm test -w @sports-booking/api -- --runTestsByPath src/venues/venues.service.spec.ts src/storage/object-key.spec.ts
npm run test:e2e -w @sports-booking/api -- --runTestsByPath test/venues.e2e-spec.ts
npm test -w @sports-booking/web -- --run src/pages/venues.test.js
npm run build
```

## Lỗi thường gặp và an toàn

- Chỉ kiểm tra role `OWNER` là chưa đủ; luôn kiểm tra ownership từng resource.
- Không public venue `PENDING_APPROVAL`, `REJECTED`, `HIDDEN` hoặc `ARCHIVED`.
- Không dùng tên file do client gửi làm object key; sinh UUID server-side.
- MIME header chưa đủ cho production public upload; Phase hardening nên bổ sung kiểm tra magic bytes và quét file.
- Archive venue và disable court lock resource trong transaction, rồi từ chối nếu có booking hiện tại/tương lai. Cùng protocol lock với create-booking loại bỏ race check-then-update.

## Câu hỏi tự kiểm tra

1. Vì sao public response không chứa danh sách physical court?
2. Tại sao sửa venue đã duyệt phải quay lại `PENDING_APPROVAL`?
3. Role guard và ownership check giải quyết hai rủi ro khác nhau nào?
