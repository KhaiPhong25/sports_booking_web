import { ServiceUnavailableException } from "@nestjs/common";
import Redis from "ioredis";
import { Client } from "pg";

export type DependencyName = "postgresql" | "redis";
export type DependencyProbe = (dependency: DependencyName) => Promise<void>;

export const defaultDependencyProbe: DependencyProbe = async (dependency) => {
  if (dependency === "redis") {
    const redis = new Redis({
      host: process.env.REDIS_HOST ?? "redis",
      port: Number(process.env.REDIS_PORT ?? 6379),
      connectTimeout: 1_000,
      lazyConnect: true,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
    });
    try {
      await redis.connect();
      await redis.ping();
    } finally {
      redis.disconnect();
    }
    return;
  }
  const postgres = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 1_000,
  });
  try {
    await postgres.connect();
    await postgres.query("SELECT 1");
  } finally {
    await postgres.end().catch(() => undefined);
  }
};

export class ReadinessService {
  constructor(
    private readonly probe: DependencyProbe = defaultDependencyProbe,
  ) {}

  async assertReady(): Promise<{ status: "ready" }> {
    try {
      await Promise.all([this.probe("postgresql"), this.probe("redis")]);
      return { status: "ready" };
    } catch {
      throw new ServiceUnavailableException({
        code: "DEPENDENCY_UNAVAILABLE",
        message: "Dịch vụ phụ thuộc chưa sẵn sàng.",
      });
    }
  }
}
