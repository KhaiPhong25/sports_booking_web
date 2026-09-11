# Kế hoạch triển khai Phase 10–11

**Mục tiêu:** Hoàn thiện trải nghiệm quản trị và đợt hardening cuối của MVP, kèm kiểm thử, tài liệu học tập, Docker clean-start và hai checkpoint commit độc lập.

**Phạm vi đã duyệt:** Tuân theo `prompt.md`, `CODEX_PROJECT_CONTEXT.md`, đặc tả thiết kế và API contract hiện tại. Không thêm nghiệp vụ ngoài MVP.

## Phase 10 — Admin experience

### 1. API danh sách người dùng và khóa tài khoản

- Viết test thất bại cho bộ lọc `query`, `role`, `locked`, phân trang, response an toàn và chặn admin tự khóa chính mình.
- Mở rộng identity repository cho truy vấn admin trong cả Prisma và in-memory adapter.
- Thêm DTO query có validation chặt, endpoint `GET /api/v1/admin/users`, và giữ lock/unlock qua service.
- Xác minh lock tăng security version, thu hồi refresh session và ghi audit log như transaction hiện có.

### 2. API kiểm duyệt và audit history

- Viết test thất bại cho lọc owner application theo trạng thái và venue theo trạng thái.
- Mở rộng repository/service/controller hiện có để admin xem cả lịch sử xét duyệt, không chỉ mục pending.
- Tạo module audit logs với `GET /api/v1/admin/audit-logs`; hỗ trợ action, actor, resource, sort và phân trang.
- Chỉ trả metadata cần thiết; mọi endpoint dùng access-token guard, role guard và role `ADMIN`.

### 3. Giao diện admin vanilla JS

- Viết unit/component tests thất bại cho dashboard, user controls, application moderation, venue moderation và audit history.
- Tạo các trang `/admin`, `/admin/users`, `/admin/owner-applications`, `/admin/venues`, `/admin/audit-logs`.
- Bổ sung navigation theo role, trạng thái loading/empty/error, filter, pagination, confirm action và lý do kiểm duyệt.
- Bảo đảm thao tác bàn phím, label, focus, thông báo trạng thái và responsive layout.

### 4. Tài liệu và checkpoint Phase 10

- Cập nhật README/API contract nếu implementation khác contract đã ghi.
- Viết `docs/learning-notes/phase-10-admin-experience.md` theo mẫu học tập bắt buộc.
- Chạy format, lint, typecheck, unit/integration/E2E liên quan và build.
- Review diff, sửa phát hiện rồi commit `feat(phase-10): complete admin experience`.

## Phase 11 — Testing, security, accessibility, hardening

### 5. Ma trận quyền và concurrency

- Thêm test ma trận anonymous/customer/owner/admin cho các route đại diện và resource ownership.
- Nâng bài test booking race thành stress nhiều request hơn capacity; xác nhận số booking thành công đúng số court và không overlap.
- Giữ kiểm thử boundary khoảng `[startAt, endAt)` và database exclusion constraint.

### 6. Security và input validation

- Review auth cookie, origin/CORS, Helmet, error envelope, redaction, DTO whitelist và authoritative server fields.
- Viết regression tests cho phát hiện có giá trị; sửa implementation nếu test đỏ chỉ ra lỗ hổng thật.
- Chạy dependency audit phù hợp và ghi rõ mọi giới hạn môi trường.

### 7. Browser E2E và accessibility

- Thêm hành trình admin quan trọng bằng Playwright: quản lý user, xét owner, kiểm duyệt venue, xem audit.
- Kiểm tra semantic landmark, label, keyboard focus, trạng thái thông báo và viewport mobile cho các trang critical.
- Chạy toàn bộ browser E2E sau production build/preview hoặc stack Docker tương ứng.

### 8. Docker clean-start và checkpoint Phase 11

- Build từ trạng thái sạch, khởi động toàn stack, chờ health/readiness, chạy migration và seed demo.
- Smoke test API, web, PostgreSQL, Redis, worker, MailHog và MinIO ở mức cần thiết.
- Chạy toàn bộ format, lint, typecheck, test, integration/E2E và production build.
- Viết `docs/learning-notes/phase-11-testing-security-hardening.md`, cập nhật README/checklist vận hành.
- Review diff, sửa phát hiện rồi commit `test(phase-11): harden security and critical flows`.
- Sau smoke test, dừng container và xóa lại project images/build cache có thể tái tạo; giữ nguyên named volumes và base images để tiết kiệm dung lượng.

## Điều kiện hoàn thành

- Hai phase có commit riêng, không chứa bốn file context untracked do người dùng sở hữu.
- Không tuyên bố pass nếu chưa chạy command; kết quả và giới hạn được ghi trong bàn giao.
- Không xóa named volume, dữ liệu database hoặc image dùng ngoài Compose project này.
