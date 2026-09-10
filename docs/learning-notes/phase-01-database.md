# Phase 01 — Database foundation

## Mục tiêu và những gì đã xây

- Thêm Prisma cho PostgreSQL và `PrismaService` dùng chung trong NestJS.
- Mô hình hóa user/role, owner application, venue/offering/court, lịch, giá, booking, history, notification và audit theo ERD đã duyệt.
- Dùng UUID cho resource, `timestamptz` cho mốc thời gian và `bigint` cho tiền VND.
- Tạo migration có thể chạy lặp bằng `prisma migrate deploy` và seed demo TP.HCM có ba môn thể thao, tài khoản nhiều role, hai venue, physical courts, lịch, giá và booking mẫu.
- Thêm integration test chạy trên PostgreSQL thật để kiểm tra unique key, quan hệ và database constraints.

## Vì sao chọn thiết kế này

PostgreSQL là nguồn dữ liệu bền vững duy nhất của booking. Prisma giúp code TypeScript có type rõ ràng, còn raw SQL migration được giữ cho các constraint đặc thù PostgreSQL mà schema Prisma không biểu diễn đủ. Court là tài nguyên vật lý riêng với offering để server có thể tự phân sân mà customer không cần biết tên nội bộ.

## Luồng dữ liệu

1. Module nghiệp vụ gọi `PrismaService` hoặc repository dùng Prisma.
2. Prisma chuyển object TypeScript thành câu lệnh PostgreSQL trong transaction phù hợp.
3. Database kiểm tra khóa ngoại, unique/check/exclusion constraint trước khi commit.
4. API serialize `bigint` VND thành JSON number sau khi xác nhận còn trong giới hạn safe integer.

## File quan trọng

- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/20260909000000_initial_schema/migration.sql`
- `apps/api/prisma/seed.ts`
- `apps/api/src/database/prisma.service.ts`
- `apps/api/test/database-schema.integration-spec.ts`

## Chạy và kiểm thử

```bash
npm run db:generate -w @sports-booking/api
DATABASE_URL='postgresql://...' npm run db:validate -w @sports-booking/api
DATABASE_URL='postgresql://...' npm run db:migrate -w @sports-booking/api
DATABASE_URL='postgresql://...' npm run db:seed -w @sports-booking/api
TEST_DATABASE_URL='postgresql://...' npm run test:integration -w @sports-booking/api
```

Seed là idempotent ở mức dữ liệu demo: chạy lại sẽ cập nhật các record có ID/code cố định thay vì tạo bản sao. Mốc booking mẫu luôn được đặt lúc 10:00 giờ Việt Nam trong tương lai để nằm trong lịch và giá seed.

## Lỗi thường gặp và bảo mật

- Không dùng `prisma db push` thay migration cho môi trường được chia sẻ; lịch sử schema phải được review.
- Không lưu tiền bằng floating point hoặc timestamp địa phương không có timezone.
- Không sửa dữ liệu production bằng seed demo.
- File `.env` thật và password database không được commit; chỉ `.env.example` chứa placeholder local.
- Validation ở service giúp báo lỗi dễ hiểu nhưng database constraint vẫn là lớp bảo vệ cuối trước race condition.

## Câu hỏi tự kiểm tra

1. Vì sao booking cần cả `offeringId` và `courtId`?
2. Vì sao VND dùng integer/`bigint` thay vì số thực?
3. Migration khác gì với `prisma db push`?
4. Tại sao constraint ở database vẫn cần thiết khi DTO và service đã validate?
