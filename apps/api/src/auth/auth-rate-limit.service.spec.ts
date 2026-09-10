import { AuthRateLimitService } from "./auth-rate-limit.service";

describe("AuthRateLimitService", () => {
  it("rejects attempts above the limit and opens a new window later", () => {
    let now = 1_000;
    const limiter = new AuthRateLimitService(() => now);
    expect(limiter.consume("login:127.0.0.1", 2, 60_000)).toBe(true);
    expect(limiter.consume("login:127.0.0.1", 2, 60_000)).toBe(true);
    expect(limiter.consume("login:127.0.0.1", 2, 60_000)).toBe(false);
    now += 60_001;
    expect(limiter.consume("login:127.0.0.1", 2, 60_000)).toBe(true);
  });
});
