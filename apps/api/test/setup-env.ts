process.env.NODE_ENV ??= "test";
process.env.PORT ??= "3000";
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://sports:sports_local_password@127.0.0.1:5432/sports_booking";
process.env.REDIS_HOST ??= "127.0.0.1";
process.env.REDIS_PORT ??= "6379";
process.env.JWT_ACCESS_SECRET ??= "test-access-secret-with-32-characters";
process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret-with-32-characters";
process.env.WEB_ORIGIN ??= "http://localhost:5173";
process.env.MAIL_HOST ??= "127.0.0.1";
process.env.MAIL_PORT ??= "1025";
process.env.MINIO_ENDPOINT ??= "127.0.0.1";
process.env.MINIO_PORT ??= "9000";
process.env.MINIO_ACCESS_KEY ??= "sports-local";
process.env.MINIO_SECRET_KEY ??= "replace-local-minio-secret-long";
process.env.MINIO_BUCKET ??= "venue-images";
