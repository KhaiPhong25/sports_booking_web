# Phase 0 — Discovery và thiết kế

## Mục tiêu

Chuyển yêu cầu sản phẩm đã khóa thành kiến trúc, mô hình dữ liệu, API, phân quyền, chiến lược chống double booking và kế hoạch triển khai có thể kiểm thử.

## Những gì đã xây

- Design spec và decision log.
- ERD Mermaid và booking state machine.
- API contract, error contract và authorization matrix.
- Kế hoạch 13 task tương ứng Phase 1–12.

## Kiến thức nền

Modular monolith giữ module nghiệp vụ tách biệt trong code nhưng deploy đơn giản hơn microservices. Exclusion constraint của PostgreSQL là lớp bảo vệ cuối cùng khi nhiều request cùng cố đặt một court. Redis/BullMQ xử lý công việc không cần chặn HTTP như gửi email và hết hạn hold.

## Luồng request/data quan trọng

Browser gửi interval và offering → controller validate DTO → transaction khóa/revalidate lịch và giá, chọn court → PostgreSQL constraint kiểm tra overlap → booking, notification và outbox event commit cùng nhau → relay enqueue BullMQ sau commit → response trả về browser.

## File quan trọng

- `docs/architecture/design-spec.md`
- `docs/architecture/erd.md`
- `docs/architecture/api-contract.md`
- `docs/architecture/authorization-matrix.md`
- `docs/architecture/decision-log.md`
- `docs/superpowers/plans/2026-09-08-sports-booking-mvp.md`

## Cách tự kiểm tra

Đọc state machine và kiểm tra không có transition tùy ý. Đọc mục chống double booking và xác nhận constraint không dùng `now()` trong partial predicate. Đối chiếu API owner với authorization matrix để mọi write đều yêu cầu ownership.

Phase 0 chỉ có static review cho Markdown/Mermaid và kiểm tra tính nhất quán; chưa có executable application test. Bằng chứng runtime bắt đầu từ Phase 1.

## Lỗi thường gặp

- Dựa vào availability check ở browser rồi insert mà không có database constraint.
- Xem mọi `PENDING` là còn hạn mà không xử lý `expiresAt`.
- Cấu hình role guard nhưng quên ownership guard.
- Dùng số thực cho VND hoặc tính giá ở client.

## Câu hỏi tự kiểm tra

1. Vì sao Redis lock không đủ để chống double booking?
2. Vì sao interval `[startAt,endAt)` cho phép hai booking chạm biên?
3. `occupiesCourt` giải quyết hạn chế nào của PostgreSQL partial index?
4. Khác biệt giữa role authorization và resource ownership là gì?
