import { Inject, Injectable, Optional } from "@nestjs/common";

export const AUTH_RATE_LIMIT_CLOCK = Symbol("AUTH_RATE_LIMIT_CLOCK");

interface RateEntry {
  count: number;
  resetsAt: number;
}

@Injectable()
export class AuthRateLimitService {
  private readonly entries = new Map<string, RateEntry>();

  constructor(
    @Optional()
    @Inject(AUTH_RATE_LIMIT_CLOCK)
    private readonly now: () => number = Date.now,
  ) {}

  consume(key: string, limit: number, windowMs: number): boolean {
    const now = this.now();
    const current = this.entries.get(key);
    if (!current || current.resetsAt <= now) {
      this.entries.set(key, { count: 1, resetsAt: now + windowMs });
      this.sweep(now);
      return true;
    }
    current.count += 1;
    return current.count <= limit;
  }

  private sweep(now: number): void {
    if (this.entries.size < 10_000) return;
    for (const [key, entry] of this.entries) {
      if (entry.resetsAt <= now) this.entries.delete(key);
    }
  }
}
