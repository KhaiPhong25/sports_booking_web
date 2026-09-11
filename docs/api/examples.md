# API examples — MVP

Prefix là `http://localhost:3000/api/v1`. Swagger tương tác ở `http://localhost:3000/docs`.

Tạo interval một giờ, sau ba ngày và bắt đầu lúc 10:00 `Asia/Ho_Chi_Minh` (03:00 UTC), khớp operating/pricing windows của seed:

```bash
START_AT=$(node -e 'const d=new Date();d.setUTCDate(d.getUTCDate()+3);d.setUTCHours(3,0,0,0);process.stdout.write(d.toISOString())')
END_AT=$(node -e 'const d=new Date(process.argv[1]);process.stdout.write(new Date(d.getTime()+3600000).toISOString())' "$START_AT")
```

```bash
curl -i -c cookies.txt -H 'Content-Type: application/json' \
  -d '{"email":"learner@example.com","password":"StrongPass123!","phone":"0901234567","displayName":"Người học"}' \
  http://localhost:3000/api/v1/auth/register

curl -i -b cookies.txt -c cookies.txt -X POST \
  -H 'Origin: http://localhost:5173' \
  http://localhost:3000/api/v1/auth/refresh

curl 'http://localhost:3000/api/v1/venues?page=1&pageSize=20'
curl http://localhost:3000/api/v1/catalog
```

Với protected endpoint, lấy `accessToken` từ register/login rồi gửi `Authorization: Bearer <token>`. Không gửi `ownerId` khi tạo venue; API lấy owner từ token.

```bash
# Public search/availability/quote không cần đăng nhập
curl --get 'http://localhost:3000/api/v1/venues' \
  --data-urlencode 'sportId=<sport-uuid>' \
  --data-urlencode "startAt=$START_AT" \
  --data-urlencode "endAt=$END_AT"

curl -X POST -H 'Content-Type: application/json' \
  -d "{\"startAt\":\"$START_AT\",\"endAt\":\"$END_AT\"}" \
  'http://localhost:3000/api/v1/offerings/<offering-uuid>/quotes'

# Create booking cần access token; server không nhận price hoặc courtId.
curl -X POST -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <access-token>' \
  -H 'Idempotency-Key: booking-demo-0001' \
  -d "{\"offeringId\":\"<offering-uuid>\",\"startAt\":\"$START_AT\",\"endAt\":\"$END_AT\"}" \
  http://localhost:3000/api/v1/bookings

# Đọc notification của chính customer; unread là boolean query string.
curl -H 'Authorization: Bearer <access-token>' \
  'http://localhost:3000/api/v1/notifications?unread=true&page=1&pageSize=20'

curl -X POST -H 'Authorization: Bearer <access-token>' \
  'http://localhost:3000/api/v1/notifications/<notification-uuid>/read'
```

Create/transition booking trả kết quả ngay sau khi PostgreSQL commit. Email được worker gửi bất đồng bộ; mở `http://localhost:8025` để kiểm tra trong MailHog. Nếu SMTP tạm lỗi, booking vẫn giữ nguyên và BullMQ tự retry.

Owner và admin dùng cùng bearer token nhưng server vẫn kiểm tra role và ownership:

```bash
# Owner chỉ thấy venue thuộc tài khoản trong token.
curl -H 'Authorization: Bearer <owner-access-token>' \
  'http://localhost:3000/api/v1/owner/venues?page=1&pageSize=20'

# Owner xác nhận một booking pending của venue mình sở hữu.
curl -X POST -H 'Authorization: Bearer <owner-access-token>' \
  'http://localhost:3000/api/v1/owner/bookings/<booking-uuid>/confirm'

# Admin lọc hồ sơ chờ duyệt và duyệt một hồ sơ.
curl -H 'Authorization: Bearer <admin-access-token>' \
  'http://localhost:3000/api/v1/admin/owner-applications?status=PENDING'

curl -X POST -H 'Authorization: Bearer <admin-access-token>' \
  'http://localhost:3000/api/v1/admin/owner-applications/<application-uuid>/approve'

# Audit history là read-only và chỉ dành cho ADMIN.
curl -H 'Authorization: Bearer <admin-access-token>' \
  'http://localhost:3000/api/v1/admin/audit-logs?sort=newest&page=1&pageSize=20'
```

Không đặt access/refresh token thật vào file script hoặc commit. Các ví dụ dùng UUID/token placeholder có chủ ý.
