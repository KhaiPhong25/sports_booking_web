import {
  createWorkerRuntime,
  readPositiveInteger,
  WorkerHandle,
} from "./runtime";

class FakeWorker implements WorkerHandle {
  closed = false;
  private errorListener: ((error: Error) => void) | undefined;
  private readyListener: (() => void) | undefined;
  constructor(readonly queueName: string) {}
  async waitUntilReady(): Promise<void> {}
  on(
    event: "error" | "ready",
    listener: ((error: Error) => void) | (() => void),
  ): void {
    if (event === "error")
      this.errorListener = listener as (error: Error) => void;
    if (event === "ready") this.readyListener = listener as () => void;
  }
  emitError(): void {
    this.errorListener?.(new Error("redis disconnected"));
  }
  emitReady(): void {
    this.readyListener?.();
  }
  async close(): Promise<void> {
    this.closed = true;
  }
}

describe("worker runtime", () => {
  it("fails fast for unsafe numeric worker configuration", () => {
    expect(() => readPositiveInteger("NaN", "POLL", 500, 50)).toThrow(
      "POLL must be an integer greater than or equal to 50",
    );
    expect(() => readPositiveInteger("0", "POLL", 500, 50)).toThrow(
      "POLL must be an integer greater than or equal to 50",
    );
    expect(readPositiveInteger(undefined, "POLL", 500, 50)).toBe(500);
  });

  it("starts one long-running handle for each application queue", () => {
    const runtime = createWorkerRuntime(
      (queueName) => new FakeWorker(queueName),
    );
    expect(runtime.queueNames()).toEqual([
      "notifications",
      "booking-lifecycle",
    ]);
  });

  it("closes every worker during graceful shutdown", async () => {
    const handles: FakeWorker[] = [];
    const runtime = createWorkerRuntime((queueName) => {
      const handle = new FakeWorker(queueName);
      handles.push(handle);
      return handle;
    });

    await runtime.close();
    expect(handles.every((handle) => handle.closed)).toBe(true);
  });

  it("closes auxiliary resources during graceful shutdown", async () => {
    const closeAuxiliary = jest.fn().mockResolvedValue(undefined);
    const runtime = createWorkerRuntime(
      (queueName) => new FakeWorker(queueName),
      closeAuxiliary,
    );

    await runtime.close();
    expect(closeAuxiliary).toHaveBeenCalledTimes(1);
  });

  it("reports ready only after all BullMQ workers connect", async () => {
    const runtime = createWorkerRuntime(
      (queueName) => new FakeWorker(queueName),
    );
    await expect(runtime.waitUntilReady()).resolves.toBeUndefined();
    expect(runtime.isReady()).toBe(true);
  });

  it("becomes unhealthy when a worker emits a Redis error", async () => {
    const handles: FakeWorker[] = [];
    const runtime = createWorkerRuntime((queueName) => {
      const handle = new FakeWorker(queueName);
      handles.push(handle);
      return handle;
    });
    await runtime.waitUntilReady();
    handles[0]!.emitError();
    expect(runtime.isReady()).toBe(false);

    handles[0]!.emitReady();
    expect(runtime.isReady()).toBe(true);
  });
});
