import { Worker } from "bullmq";
import { QUEUE_NAMES } from "./queue-names";

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

export function createWorkerRuntime(factory: WorkerFactory): WorkerRuntime {
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
    },
  };
}

export function createBullMqRuntime(): WorkerRuntime {
  const connection = {
    host: process.env.REDIS_HOST ?? "redis",
    port: Number(process.env.REDIS_PORT ?? 6379),
    maxRetriesPerRequest: null,
  };
  return createWorkerRuntime(
    (queueName) =>
      new Worker(
        queueName,
        async (job) => {
          throw new Error(`No processor registered for job ${job.name}`);
        },
        { connection },
      ),
  );
}
