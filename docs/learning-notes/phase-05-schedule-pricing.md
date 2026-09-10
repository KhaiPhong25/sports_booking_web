# Phase 05 — Lịch hoạt động và định giá

## Mục tiêu và những gì đã xây

- Owner quản lý nhiều khung giờ hoạt động theo tuần cho từng venue.
- Owner tạo, sửa, xóa thời gian đóng toàn venue hoặc riêng một physical court.
- Owner CRUD pricing rule theo offering, thứ trong tuần và khoảng phút trong ngày.
- Public gọi quote; server chia interval thành slot 30 phút, yêu cầu coverage đầy đủ và trả tổng VND cùng breakdown.
- PostgreSQL exclusion constraint và service validation cùng ngăn operating/pricing windows overlap.
- UI vanilla JS `/owner/schedule` có form giờ mở cửa, closure và giá.

## Vì sao thiết kế như vậy

`weekday + startMinute + endMinute` biểu diễn quy tắc lặp theo giờ Việt Nam rõ hơn việc lưu timestamp giả. Timestamp closure và booking vẫn lưu UTC. Pricing engine là hàm thuần nên có thể kiểm thử mọi boundary mà không cần database.

MVP không cho một window đi qua nửa đêm. Owner tách thành hai window ở hai ngày; cách này tránh việc một rule thuộc hai weekday. Khoảng thời gian luôn nửa mở `[start,end)`, nên hai rule chạm biên không overlap.

## Luồng request và dữ liệu

1. DTO chỉ nhận weekday 1–7, minute 0–1440 theo bước 30 và giá VND integer dương.
2. Service xác minh role lẫn `venue.ownerId`.
3. Schedule policy kiểm tra interval và overlap trước khi ghi; database constraint là lớp cuối và lỗi constraint được đổi thành conflict domain ổn định.
4. Tạo closure lock venue và kiểm tra booking đang chiếm sân trong cùng transaction.
5. Quote đổi UTC sang `Asia/Ho_Chi_Minh`, kiểm tra cùng business date, giờ mở cửa, closure toàn venue và đúng một pricing rule cho từng slot.

## File quan trọng

- `apps/api/src/scheduling/business-time.ts`, `schedule-policy.ts`
- `apps/api/src/scheduling/scheduling.service.ts`, `prisma-scheduling.repository.ts`
- `apps/api/src/pricing/pricing-engine.ts`, `pricing.service.ts`
- `apps/web/src/pages/schedule-pricing.js`
- `apps/api/src/pricing/pricing-engine.spec.ts`

## Chạy và test

```bash
npm test -w @sports-booking/api -- --runInBand src/scheduling src/pricing
TEST_DATABASE_URL='postgresql://...' npm run test:integration -w @sports-booking/api
npm test -w @sports-booking/web -- src/pages/schedule-pricing.test.js
```

## Lỗi thường gặp và bảo mật

- Dùng weekday UTC thay cho weekday TP.HCM sẽ tính sai giá gần 00:00.
- Chỉ kiểm tra overlap ở JavaScript tạo race; constraint PostgreSQL vẫn bắt buộc.
- Không nhận tổng giá từ browser. Browser chỉ gửi offering và interval.
- Thay schedule khi có booking tương lai bị chặn có chủ đích; owner phải xử lý booking trước.
- Quote không phải giữ chỗ. Capacity chỉ được cam kết khi transaction create-booking thành công.

## Câu hỏi tự kiểm tra

1. Vì sao giá lưu theo slot 30 phút nhưng booking có thể dài nhiều giờ?
2. Vì sao cần cả service validation lẫn exclusion constraint?
3. `Asia/Ho_Chi_Minh` ảnh hưởng weekday của timestamp UTC như thế nào?
