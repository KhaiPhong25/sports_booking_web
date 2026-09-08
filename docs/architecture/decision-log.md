# Decision log

| ID | Quyết định | Lý do |
|---|---|---|
| ADR-001 | Modular monolith + worker | Transaction booking đơn giản, vận hành local nhẹ, vẫn tách background work. |
| ADR-002 | Prisma + raw SQL | Prisma tăng tốc CRUD; raw SQL cần cho `btree_gist`, exclusion constraint và locking. |
| ADR-003 | `occupiesCourt` làm predicate constraint | Không thể dùng `now()` trong immutable partial-index predicate; transition/expiration cập nhật flag trong transaction. |
| ADR-004 | Public browsing, authenticated booking | Giảm friction khi khám phá nhưng bảo vệ write operation. |
| ADR-005 | Không OTP trong MVP | Tránh dependency/chi phí ngoài; vẫn chuẩn hóa E.164. |
| ADR-006 | Khu vực là dữ liệu phân cấp | Không khóa schema vào cấu trúc hành chính có thể thay đổi. |
| ADR-007 | Cookie refresh + bearer access token | Hạn chế lộ refresh token cho JavaScript và hỗ trợ rotation. |
| ADR-008 | Transactional outbox | Không mất email/event nếu process chết sau database commit nhưng trước Redis enqueue. |
| ADR-009 | Resource locking protocol | Booking và mutation lịch/giá/closure/moderation khóa venue → offering → court rồi revalidate. |
| ADR-010 | Không hỗ trợ lịch qua nửa đêm | Giữ pricing và weekday rõ ràng trong MVP; owner tách thành hai ngày. |
| ADR-011 | Edit venue phải duyệt lại | Tránh public nội dung chưa được admin xem; venue tạm ẩn trong lúc chờ. |
