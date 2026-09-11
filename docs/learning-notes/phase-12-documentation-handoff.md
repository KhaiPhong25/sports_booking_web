# Phase 12 — Documentation và final handoff

## Mục tiêu phase

Hoàn thiện “đường vào” cho người mới: có thể clone, chạy, seed, test, demo, hiểu kiến trúc, xử lý lỗi thường gặp và biết ranh giới MVP mà không cần đọc lịch sử chat.

## Những gì đã xây

- README được cập nhật trạng thái hoàn thành MVP và liên kết đến tài liệu chuyên sâu.
- `docs/README.md` cung cấp mục lục cùng thứ tự learning notes.
- Hướng dẫn local tách Docker-first, host development, migration/seed, test database, backup/reset, cleanup và troubleshooting.
- Demo guide mô tả hành trình public, customer, owner và admin dựa trên seed thật.
- Known limitations phân biệt phần ngoài phạm vi với bug; roadmap chia P0/P1/P2.
- Final verification report lưu kiến trúc, command, số test, Docker smoke, assumption, giới hạn audit và trạng thái cleanup.
- API examples được mở rộng tới owner/admin và nhắc không lưu token vào script/commit.
- API/worker development và Prisma scripts dùng Node `--env-file-if-exists` để nạp đúng `.env` ở repository root khi npm đổi working directory sang workspace.

## Vì sao chọn cấu trúc này

README nên ngắn đủ để khởi động và đóng vai trò cổng vào. Nếu nhồi toàn bộ troubleshooting, kiến trúc và roadmap vào README, người mới khó tìm thông tin còn người duy trì dễ để tài liệu drift. Mỗi tài liệu có một trách nhiệm và được nối bằng relative link để đọc được ngay trong repository.

Verification report chỉ ghi command đã chạy cùng kết quả quan sát được. Known limitation không được viết như lời hứa ngầm hoặc module placeholder; roadmap cần discovery riêng trước khi code.

## Luồng sử dụng tài liệu

1. Người mới đọc README, kiểm tra runtime và chạy Docker-first.
2. Nếu lỗi, đi thẳng tới local development/troubleshooting thay vì đoán từ source.
3. Khi demo, dùng seed accounts và kịch bản theo role.
4. Khi học, đọc design spec/ERD/API contract rồi learning notes theo phase.
5. Khi thay đổi nghiệp vụ, cập nhật source, test, OpenAPI/contract, note liên quan và verification evidence trong cùng phase.
6. Khi chuẩn bị production, đọc known limitations/P0 roadmap; không dùng credential hoặc giả định local.

## Các file quan trọng

- `README.md`: cổng vào repository.
- `docs/README.md`: index và learning path.
- `docs/guides/local-development.md`: setup/run/test/troubleshooting/cleanup.
- `docs/guides/demo-guide.md`: hành trình demo và tài khoản seed.
- `docs/product/known-limitations-and-roadmap.md`: ranh giới và hướng tiếp theo.
- `docs/quality/final-verification.md`: evidence bàn giao cuối.
- `docs/architecture/` và `docs/api/`: thiết kế/contract/ví dụ.
- `apps/api/package.json` và `apps/worker/package.json`: host commands nạp root environment một cách tường minh.

## Cách kiểm tra tài liệu

```bash
npm exec prettier -- --check README.md docs
git diff --check
npm run verify
```

Ngoài format, cần kiểm tra relative link trỏ tới file tồn tại, command khớp `package.json`/Compose, port/credentials demo khớp `.env.example`/seed và test count khớp log verification.

## Lỗi thường gặp và lưu ý bảo mật

- Copy password local vào hướng dẫn production hoặc commit `.env` thật.
- Ghi một test “pass” dù thực tế bị skip vì thiếu service flag.
- Hướng dẫn `docker compose down -v` như cleanup thông thường, làm mất dữ liệu người học.
- Dùng `docker system prune -a --volumes` cho cleanup một project, ảnh hưởng repository khác.
- Để API example chứa access token thật hoặc UUID/resource lấy từ production.
- Gọi một mục ngoài phạm vi là “sắp có” mà chưa có plan/acceptance criteria.
- Cập nhật code/API nhưng quên contract, demo guide và learning note tương ứng.

## Câu hỏi tự kiểm tra

1. Vì sao README nên dẫn link thay vì chứa mọi chi tiết?
2. Sự khác nhau giữa known limitation, bug và roadmap item là gì?
3. Vì sao verification report phải phân biệt test pass với test skip?
4. Lệnh Docker cleanup nào giữ volume, lệnh nào xóa dữ liệu?
5. Khi thêm endpoint mới, những tài liệu nào tối thiểu phải được rà lại?
