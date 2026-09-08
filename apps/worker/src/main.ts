import { createBullMqRuntime } from "./runtime";
import { startHealthServer } from "./health-server";

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  if (!process.env.REDIS_HOST) throw new Error("REDIS_HOST is required");
  if (!process.env.MAIL_HOST) throw new Error("MAIL_HOST is required");

  const runtime = createBullMqRuntime();
  await runtime.waitUntilReady();
  const healthServer = startHealthServer(
    runtime,
    Number(process.env.WORKER_HEALTH_PORT ?? 3001),
  );
  const shutdown = async (): Promise<void> => {
    healthServer.close();
    await runtime.close();
    process.exit(0);
  };

  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
  process.stdout.write(
    `Worker listening on ${runtime.queueNames().join(", ")}\n`,
  );
}

if (require.main === module) {
  void main();
}
