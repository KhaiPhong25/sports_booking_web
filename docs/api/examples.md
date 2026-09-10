# API examples — Phase 2 đến Phase 6

Prefix là `http://localhost:3000/api/v1`. Swagger tương tác ở `http://localhost:3000/docs`.

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
  --data-urlencode 'startAt=2026-09-14T01:00:00.000Z' \
  --data-urlencode 'endAt=2026-09-14T02:00:00.000Z'

curl -X POST -H 'Content-Type: application/json' \
  -d '{"startAt":"2026-09-14T01:00:00.000Z","endAt":"2026-09-14T02:00:00.000Z"}' \
  'http://localhost:3000/api/v1/offerings/<offering-uuid>/quotes'

# Create booking cần access token; server không nhận price hoặc courtId.
curl -X POST -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <access-token>' \
  -H 'Idempotency-Key: booking-demo-0001' \
  -d '{"offeringId":"<offering-uuid>","startAt":"2026-09-14T01:00:00.000Z","endAt":"2026-09-14T02:00:00.000Z"}' \
  http://localhost:3000/api/v1/bookings
```
