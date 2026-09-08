import { validateEnvironment } from "./environment";

const validEnvironment = {
  NODE_ENV: "test",
  PORT: "3000",
  DATABASE_URL: "postgresql://sports:password@postgres:5432/sports_booking",
  REDIS_HOST: "redis",
  REDIS_PORT: "6379",
  JWT_ACCESS_SECRET: "a".repeat(32),
  JWT_REFRESH_SECRET: "b".repeat(32),
  MAIL_HOST: "mailhog",
  MAIL_PORT: "1025",
  MINIO_ENDPOINT: "minio",
  MINIO_PORT: "9000",
  MINIO_ACCESS_KEY: "sports-local",
  MINIO_SECRET_KEY: "c".repeat(16),
  MINIO_BUCKET: "venue-images",
};

describe("environment validation", () => {
  it("rejects a missing access-token secret instead of starting insecurely", () => {
    const input: Record<string, unknown> = { ...validEnvironment };
    Reflect.deleteProperty(input, "JWT_ACCESS_SECRET");
    expect(() => validateEnvironment(input)).toThrow("JWT_ACCESS_SECRET");
  });

  it("converts numeric ports after validating the complete contract", () => {
    const result = validateEnvironment(validEnvironment);
    expect(result.PORT).toBe(3000);
    expect(result.REDIS_PORT).toBe(6379);
    expect(result.MAIL_PORT).toBe(1025);
  });
});
