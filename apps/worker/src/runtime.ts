import { OutboxJobData } from "@sports-booking/shared";
import { Job, Queue, Worker } from "bullmq";
import { Pool } from "pg";
import { NodemailerEmailAdapter } from "./adapters/email.adapter";
import { BullMqOutboxPublisher } from "./outbox/bullmq-outbox-publisher";
import { OutboxRelay } from "./outbox/outbox-relay";
import { PostgresOutboxStore } from "./outbox/postgres-outbox-store";
import { BookingLifecycleProcessor } from "./processors/booking-lifecycle.processor";
import { EmailNotificationProcessor } from "./processors/email-notification.processor";
import { QUEUE_NAMES } from "./queue-names";
import { PostgresJobStore } from "./store/postgres-job-store";

export interface WorkerHandle {
  waitUntilReady(): Promise<unknown>;
  on(
    event: "error" | "ready",
    listener: ((error: Error) => void) | (() => void),
  ): unknown;
  close(): Promise<void>;
}

export type WorkerFactory = (queueName: string) => WorkerHandle;

export interface WorkerRuntime {
  queueNames(): string[];
  waitUntilReady(): Promise<void>;
  isReady(): boolean;
  close(): Promise<void>;
}

export function readPositiveInteger(
  value: string | undefined,
  name: string,
  fallback: number,
  minimum: number,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(
      `${name} must be an integer greater than or equal to ${minimum}`,
    );
  }
  return parsed;
}

export function createWorkerRuntime(
  factory: WorkerFactory,
  closeAuxiliary: () => Promise<void> = async () => undefined,
): WorkerRuntime {
  const queueNames = Object.values(QUEUE_NAMES);
  const handles = queueNames.map(factory);
  const readyHandles = new Set<WorkerHandle>();
  for (const handle of handles) {
    handle.on("error", () => {
      readyHandles.delete(handle);
    });
    handle.on("ready", () => {
      readyHandles.add(handle);
    });
  }
  return {
    queueNames: () => [...queueNames],
    waitUntilReady: async () => {
      await Promise.all(handles.map((handle) => handle.waitUntilReady()));
      handles.forEach((handle) => readyHandles.add(handle));
    },
    isReady: () => readyHandles.size === handles.length,
    close: async () => {
      readyHandles.clear();
      await Promise.all(handles.map((handle) => handle.close()));
      await closeAuxiliary();
    },
  };
}

export function createBullMqRuntime(): WorkerRuntime {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const connection = {
    host: process.env.REDIS_HOST ?? "redis",
    port: readPositiveInteger(
      process.env.REDIS_PORT,
      "REDIS_PORT",
      6379,
      1,
      65535,
    ),
    maxRetriesPerRequest: null,
  };
  const relayIntervalMs = readPositiveInteger(
    process.env.OUTBOX_POLL_INTERVAL_MS,
    "OUTBOX_POLL_INTERVAL_MS",
    500,
    50,
    60_000,
  );
  const replayAfterSeconds = readPositiveInteger(
    process.env.OUTBOX_REPLAY_AFTER_SECONDS,
    "OUTBOX_REPLAY_AFTER_SECONDS",
    60,
    1,
    86_400,
  );
  const pool = new Pool({ connectionString: databaseUrl });
  const store = new PostgresJobStore(pool);
  const emailProcessor = new EmailNotificationProcessor(
    store,
    NodemailerEmailAdapter.fromEnvironment(),
  );
  const lifecycleProcessor = new BookingLifecycleProcessor(store);
  const notificationQueue = new Queue<OutboxJobData>(
    QUEUE_NAMES.notifications,
    { connection },
  );
  const lifecycleQueue = new Queue<OutboxJobData>(
    QUEUE_NAMES.bookingLifecycle,
    { connection },
  );
  const publisher = new BullMqOutboxPublisher({
    notifications: notificationQueue,
    bookingLifecycle: lifecycleQueue,
  });
  const relay = new OutboxRelay(
    new PostgresOutboxStore(pool, 5, replayAfterSeconds),
    publisher,
  );
  let relayRunning = false;
  let closed = false;
  const relayOnce = async (): Promise<void> => {
    if (relayRunning || closed) return;
    relayRunning = true;
    try {
      await relay.relayBatch();
    } catch (error) {
      process.stderr.write(
        `Outbox relay failed: ${error instanceof Error ? error.message : "unknown error"}\n`,
      );
    } finally {
      relayRunning = false;
    }
  };
  const timer = setInterval(() => void relayOnce(), relayIntervalMs);

  const baseRuntime = createWorkerRuntime(
    (queueName) => {
      const processor = (job: Job<OutboxJobData>) => {
        if (queueName === QUEUE_NAMES.notifications) {
          return emailProcessor.process(job.data, {
            currentAttempt: job.attemptsMade + 1,
            maxAttempts: job.opts.attempts ?? 1,
          });
        }
        return lifecycleProcessor.process(job.data);
      };
      return new Worker<OutboxJobData>(queueName, processor, { connection });
    },
    async () => {
      closed = true;
      clearInterval(timer);
      while (relayRunning) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      await publisher.close();
      await pool.end();
    },
  );

  return {
    ...baseRuntime,
    waitUntilReady: async () => {
      await Promise.all([baseRuntime.waitUntilReady(), pool.query("SELECT 1")]);
      await relayOnce();
    },
  };
}
