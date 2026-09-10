# Phase 03 — Owner application

## Mục tiêu và kết quả

Customer có thể gửi và xem hồ sơ xin trở thành chủ sân. Admin có endpoint riêng để xem danh sách phân trang, duyệt hoặc từ chối. Chỉ quyết định `APPROVED` mới cấp role `OWNER`.

## Thiết kế

Database có unique partial index chỉ cho một hồ sơ `PENDING` trên mỗi user. Khi duyệt, cập nhật hồ sơ, upsert role `OWNER` và ghi `AuditLog` diễn ra trong cùng transaction. Nếu bất kỳ bước nào lỗi, toàn bộ quyết định được rollback; không có trạng thái “đã duyệt nhưng chưa có role”. Review dùng conditional update để hai admin không thể cùng quyết định một hồ sơ.

## Luồng request/data

1. `AccessTokenGuard` xác thực user.
2. Customer gọi `POST /owner-applications`; service chặn hồ sơ pending trùng.
3. Admin endpoint chạy thêm `RolesGuard("ADMIN")`.
4. Repository claim hồ sơ còn `PENDING`, cập nhật quyết định, cấp role nếu cần và ghi audit.
5. UI hiển thị form customer và hàng duyệt/từ chối có lý do cho admin.

## File quan trọng

- `apps/api/src/owner-applications/owner-applications.service.ts`
- `apps/api/src/owner-applications/prisma-owner-application.repository.ts`
- `apps/api/src/owner-applications/*controller.ts`
- `apps/web/src/pages/owner-application.js`
- `apps/api/test/owner-applications.e2e-spec.ts`

## Chạy và test

```bash
npm test -w @sports-booking/api -- --runTestsByPath src/owner-applications/owner-applications.service.spec.ts
npm run test:e2e -w @sports-booking/api -- --runTestsByPath test/owner-applications.e2e-spec.ts
npm test -w @sports-booking/web -- --run src/pages/owner-application.test.js
```

## Lỗi thường gặp và an toàn

- Không cấp `OWNER` ngay khi submit.
- Không tách cấp role và audit thành transaction khác.
- Không tin role do browser gửi; role đến từ principal server-side.
- Lý do từ chối cần đủ rõ để người nộp sửa hồ sơ và để audit có ý nghĩa.

## Câu hỏi tự kiểm tra

1. Partial unique index khác unique index thường ở điểm nào?
2. Điều gì xảy ra nếu hai admin duyệt cùng lúc?
3. Vì sao audit phải nằm cùng transaction với quyết định?
