import { ServiceUnavailableException } from "@nestjs/common";
import { ReadinessService } from "./readiness.service";

describe("ReadinessService", () => {
  it("returns ready only after PostgreSQL and Redis accept connections", async () => {
    const service = new ReadinessService(async () => undefined);
    await expect(service.assertReady()).resolves.toEqual({ status: "ready" });
  });

  it("returns service unavailable when a dependency cannot be reached", async () => {
    const service = new ReadinessService(async (dependency) => {
      if (dependency === "redis") throw new Error("connection refused");
    });

    await expect(service.assertReady()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
