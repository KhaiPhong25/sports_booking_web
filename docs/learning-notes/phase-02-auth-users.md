# Phase 02 — Authentication và users

## Mục tiêu

Phase này tạo database schema nền và luồng định danh hoàn chỉnh: đăng ký, đăng nhập, xoay refresh token, đăng xuất, profile nhiều role và khóa tài khoản.

## Những gì đã xây

- Prisma schema/migration cho user, role, refresh session và các bảng nền của MVP.
- Seed lặp lại an toàn với ba môn thể thao, dữ liệu TP.HCM, tài khoản demo, venue/court, lịch và giá mẫu.
- Mật khẩu và refresh token được hash bằng Argon2id; database không giữ plaintext.
- Access token sống ngắn; refresh token bảy ngày nằm trong cookie `HttpOnly`, `SameSite=Strict` và được rotation sau mỗi lần dùng.
- Mỗi refresh family bị thu hồi toàn bộ nếu token cũ bị dùng lại.
- Guard luôn đọc lại user từ nguồn dữ liệu, nên account vừa bị khóa hoặc tăng `securityVersion` bị chặn ngay cả với access token cũ.
- `GET/PATCH /me` và admin lock/unlock; thao tác lock thu hồi session và tạo audit record.
- Error envelope chung có `code`, `message`, `details`, `requestId`.
- Auth endpoints có fixed-window rate limit theo IP và route; khi scale nhiều API instance nên chuyển counter sang Redis.
- Form đăng ký/đăng nhập semantic, có label, trạng thái live và không lưu refresh token trong JavaScript.

## Vì sao chọn thiết kế này

Access token giúp API xác thực nhanh, còn refresh session trong PostgreSQL cho phép logout, rotation và thu hồi có kiểm soát. Hash token giảm thiệt hại nếu database bị lộ. Multi-role dùng bảng nối thay vì một cột role, vì cùng tài khoản có thể vừa là customer vừa là owner.

## Luồng request/data

1. Controller validate DTO và gọi `AuthService`.
2. Service chuẩn hóa email/điện thoại, gọi Argon2 và repository.
3. Repository ghi user cùng role `CUSTOMER`, hoặc ghi/rotation refresh session trong transaction.
4. Controller chỉ trả access token trong JSON; refresh token được đặt vào cookie bảo vệ.
5. Với protected request, guard kiểm tra chữ ký JWT rồi đọc user hiện tại để kiểm tra lock, security version và roles.

## File quan trọng

- `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/`, `apps/api/prisma/seed.ts`
- `apps/api/src/auth/auth.service.ts`, `token.service.ts`, `prisma-identity.repository.ts`
- `apps/api/src/common/auth/`, `apps/api/src/users/`
- `apps/web/src/pages/auth.js`, `apps/web/src/services/auth-api.js`

## Chạy và kiểm thử

```bash
npm run db:generate -w @sports-booking/api
npm run db:migrate -w @sports-booking/api
npm run db:seed -w @sports-booking/api
npm test -w @sports-booking/api
npm run test:e2e -w @sports-booking/api -- --runTestsByPath test/auth.e2e-spec.ts
```

Integration test PostgreSQL dùng `TEST_DATABASE_URL`. Nếu Docker/PostgreSQL chưa chạy, test này được báo skip có điều kiện; không nên hiểu đó là bằng chứng migration đã chạy trên database thật.

## Lỗi thường gặp và an toàn

- Không lưu access token lâu dài trong `localStorage`; phiên bản hiện tại giữ trong memory.
- Không gửi refresh token trong JSON hoặc log.
- Không chỉ tin role/lock nằm trong JWT cũ; guard phải đối chiếu trạng thái hiện tại.
- Nên dùng secret ngẫu nhiên mạnh và HTTPS trong production.
- Cookie-authenticated endpoint phải có SameSite/Origin policy để giảm CSRF.

## Câu hỏi tự kiểm tra

1. Vì sao refresh token vẫn phải hash dù bản thân nó đã có chữ ký?
2. `securityVersion` giúp vô hiệu token cũ như thế nào?
3. Tại sao role là quan hệ nhiều-nhiều thay vì enum trực tiếp trên user?
