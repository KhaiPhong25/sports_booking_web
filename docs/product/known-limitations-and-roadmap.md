# Known limitations và roadmap sau MVP

## Giới hạn đã biết

Đây là giới hạn phạm vi, không phải chức năng được triển khai dở:

- Chỉ có dữ liệu demo tại Thành phố Hồ Chí Minh cho bóng đá, bóng rổ và cầu lông; chưa có import dữ liệu hành chính/venue thực.
- Đăng ký chưa có OTP, email/phone verification, quên mật khẩu, MFA hoặc social login.
- Không có thanh toán/refund, ticket, QR check-in, chat, promotion, review, settlement hay ứng dụng mobile native.
- Operating/pricing window không qua nửa đêm; booking không được cắt qua business date.
- Email theo at-least-once; crash đúng lúc SMTP accept nhưng trước durable receipt có thể tạo thư trùng.
- Map phụ thuộc tile OpenStreetMap mặc định và kết nối Internet của browser; chưa có geocoding/routing/offline tile.
- MinIO/MailHog và secret mặc định chỉ phù hợp local; chưa có production object-storage policy, virus scan hoặc email provider integration.
- Accessibility đã có semantic/keyboard/mobile regression nhưng chưa được chứng nhận WCAG hoặc kiểm tra đầy đủ bằng screen reader/axe/contrast audit.
- Chưa có CI/CD, deployment manifest, TLS/reverse proxy production, centralized log/metrics/tracing, alerting, backup/restore automation hoặc disaster-recovery drill.
- Audit log chưa có retention/export/tamper-evident storage; admin chưa có break-glass/multi-approval flow.
- Dependency scan online độc lập bị giới hạn trong môi trường thực hiện. Docker `npm ci` báo hai advisory moderate trong toàn tree; cần phân loại lại ở CI có network được kiểm soát.
- MVP tối ưu correctness và khả năng học hơn benchmark tải lớn; chưa có load test, capacity planning hay horizontal scaling validation.

## Roadmap đề xuất

### P0 — Chuẩn bị production

1. Thêm CI chạy format, lint, typecheck, unit, PostgreSQL integration, browser E2E và online dependency/container scan.
2. Dùng secret manager, TLS, production reverse proxy, origin/CSRF policy hoàn chỉnh, security headers/CSP điều chỉnh cho map và upload.
3. Bổ sung email/phone verification, password reset, MFA cho admin và quy trình break-glass.
4. Thiết lập structured logs, metrics, tracing, alerting, queue dashboard, backup/restore và audit retention.
5. Chạy load/concurrency test ở quy mô dự kiến và xác minh PostgreSQL/Redis connection limits.

### P1 — Nghiệp vụ thương mại

1. Payment intent, webhook idempotency, refund/cancellation ledger và owner settlement.
2. Promotion/coupon có snapshot, review sau booking hoàn tất và chống abuse.
3. Search theo khoảng cách, geocoding, ảnh production/CDN và quản lý nội dung tốt hơn.
4. Owner reporting, utilization/revenue export và admin operational dashboard.

### P2 — Trải nghiệm và quy mô

1. PWA/push notification, calendar sync và accessibility audit chuyên sâu.
2. Waitlist, recurring booking và multi-slot/cart nếu product validation cho thấy cần.
3. Tách read model/search index hoặc service chỉ khi số liệu tải chứng minh modular monolith không còn phù hợp.

Roadmap không phải cam kết triển khai. Mọi mục mới cần discovery, threat model, data migration và acceptance criteria riêng trước khi code.
