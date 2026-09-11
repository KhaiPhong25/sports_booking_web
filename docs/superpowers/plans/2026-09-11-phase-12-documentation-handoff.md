# Kế hoạch Phase 12 — Documentation và final handoff

**Mục tiêu:** Biến trạng thái implementation đã kiểm chứng thành bộ tài liệu đủ để người mới chạy, học, demo và tiếp tục phát triển mà không phụ thuộc lịch sử chat.

## 1. Audit và điều hướng tài liệu

- Đối chiếu README, architecture, ERD, API contract, `.env.example`, Compose, scripts và seed với source hiện tại.
- Thêm index tài liệu và thứ tự đọc learning notes.
- Sửa link, lệnh hoặc mô tả đã drift; không mở rộng phạm vi MVP.

## 2. Hướng dẫn vận hành local

- Viết hướng dẫn setup cho Docker-first và host development.
- Ghi rõ migration, seed, test database, full verification, backup/giữ volume và cleanup artifact an toàn.
- Bổ sung troubleshooting cho port, database URL, health/readiness, Redis, MailHog, MinIO, Node/npm và Docker disk.

## 3. Demo và phạm vi sản phẩm

- Viết demo guide theo ba vai trò và luồng public chưa đăng nhập.
- Ghi known limitations rõ ràng, phân biệt giới hạn MVP với lỗi.
- Viết roadmap sau MVP theo ưu tiên nhưng không tạo placeholder implementation.

## 4. Handoff và kiểm chứng cuối

- Cập nhật README thành cổng vào cho setup, kiến trúc, API, QA, demo và learning notes.
- Viết learning note Phase 12 và final verification report có command/kết quả thật.
- Chạy format/link check, `npm run verify`, review diff và commit riêng `docs(phase-12): complete final handoff`.
