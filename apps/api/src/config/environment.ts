export interface AppEnvironment {
  nodeEnv: string;
  port: number;
  apiPrefix: string;
}

function requiredString(
  input: Record<string, unknown>,
  key: string,
  minimum = 1,
): string {
  const value = String(input[key] ?? "").trim();
  if (value.length < minimum) {
    throw new Error(`${key} must contain at least ${minimum} characters`);
  }
  return value;
}

function validPort(
  input: Record<string, unknown>,
  key: string,
  fallback?: number,
): number {
  const port = Number(input[key] ?? fallback);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${key} must be an integer between 1 and 65535`);
  }
  return port;
}

export function validateEnvironment(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const port = validPort(input, "PORT", 3000);

  return {
    ...input,
    NODE_ENV: String(input.NODE_ENV ?? "development"),
    PORT: port,
    API_PREFIX: String(input.API_PREFIX ?? "api/v1"),
    DATABASE_URL: requiredString(input, "DATABASE_URL"),
    REDIS_HOST: requiredString(input, "REDIS_HOST"),
    REDIS_PORT: validPort(input, "REDIS_PORT", 6379),
    JWT_ACCESS_SECRET: requiredString(input, "JWT_ACCESS_SECRET", 32),
    JWT_REFRESH_SECRET: requiredString(input, "JWT_REFRESH_SECRET", 32),
    WEB_ORIGIN: String(input.WEB_ORIGIN ?? "http://localhost:5173"),
    MAIL_HOST: requiredString(input, "MAIL_HOST"),
    MAIL_PORT: validPort(input, "MAIL_PORT", 1025),
    MINIO_ENDPOINT: requiredString(input, "MINIO_ENDPOINT"),
    MINIO_PORT: validPort(input, "MINIO_PORT", 9000),
    MINIO_ACCESS_KEY: requiredString(input, "MINIO_ACCESS_KEY"),
    MINIO_SECRET_KEY: requiredString(input, "MINIO_SECRET_KEY", 16),
    MINIO_BUCKET: requiredString(input, "MINIO_BUCKET"),
  };
}
