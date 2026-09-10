import {
  PricingEngine,
  PricingNotCoveredError,
  QuoteIntervalError,
} from "./pricing-engine";

const mondayHours = [{ weekday: 1, startMinute: 480, endMinute: 1320 }];

describe("PricingEngine", () => {
  const engine = new PricingEngine();

  it("sums authoritative prices for each covered 30-minute segment", () => {
    const quote = engine.quote({
      startAt: new Date("2026-09-14T01:00:00.000Z"),
      endAt: new Date("2026-09-14T03:00:00.000Z"),
      operatingHours: mondayHours,
      closures: [],
      pricingRules: [
        {
          id: "morning",
          weekday: 1,
          startMinute: 480,
          endMinute: 540,
          pricePerSlot: 50_000,
        },
        {
          id: "peak",
          weekday: 1,
          startMinute: 540,
          endMinute: 600,
          pricePerSlot: 70_000,
        },
      ],
    });

    expect(quote).toEqual({
      amount: 240_000,
      currency: "VND",
      slotMinutes: 30,
      breakdown: [
        {
          ruleId: "morning",
          startAt: "2026-09-14T01:00:00.000Z",
          endAt: "2026-09-14T01:30:00.000Z",
          amount: 50_000,
        },
        {
          ruleId: "morning",
          startAt: "2026-09-14T01:30:00.000Z",
          endAt: "2026-09-14T02:00:00.000Z",
          amount: 50_000,
        },
        {
          ruleId: "peak",
          startAt: "2026-09-14T02:00:00.000Z",
          endAt: "2026-09-14T02:30:00.000Z",
          amount: 70_000,
        },
        {
          ruleId: "peak",
          startAt: "2026-09-14T02:30:00.000Z",
          endAt: "2026-09-14T03:00:00.000Z",
          amount: 70_000,
        },
      ],
    });
  });

  it("uses Asia/Ho_Chi_Minh weekday at the UTC day boundary", () => {
    const quote = engine.quote({
      startAt: new Date("2026-09-13T17:00:00.000Z"),
      endAt: new Date("2026-09-13T18:00:00.000Z"),
      operatingHours: [{ weekday: 1, startMinute: 0, endMinute: 120 }],
      closures: [],
      pricingRules: [
        {
          id: "monday",
          weekday: 1,
          startMinute: 0,
          endMinute: 120,
          pricePerSlot: 40_000,
        },
      ],
    });

    expect(quote.amount).toBe(80_000);
  });

  it("rejects an interval when even one slot has no price", () => {
    expect(() =>
      engine.quote({
        startAt: new Date("2026-09-14T01:00:00.000Z"),
        endAt: new Date("2026-09-14T02:30:00.000Z"),
        operatingHours: mondayHours,
        closures: [],
        pricingRules: [
          {
            id: "short",
            weekday: 1,
            startMinute: 480,
            endMinute: 540,
            pricePerSlot: 50_000,
          },
        ],
      }),
    ).toThrow(PricingNotCoveredError);
  });

  it("rejects intervals outside opening hours, overlapping closures, or crossing a business date", () => {
    const common = {
      pricingRules: [
        {
          id: "all-day",
          weekday: 1,
          startMinute: 0,
          endMinute: 1440,
          pricePerSlot: 50_000,
        },
      ],
      closures: [],
    };
    expect(() =>
      engine.quote({
        ...common,
        startAt: new Date("2026-09-14T00:00:00.000Z"),
        endAt: new Date("2026-09-14T01:00:00.000Z"),
        operatingHours: [{ weekday: 1, startMinute: 480, endMinute: 1320 }],
      }),
    ).toThrow(QuoteIntervalError);
    expect(() =>
      engine.quote({
        ...common,
        startAt: new Date("2026-09-14T01:00:00.000Z"),
        endAt: new Date("2026-09-14T02:00:00.000Z"),
        operatingHours: mondayHours,
        closures: [
          {
            startAt: new Date("2026-09-14T01:30:00.000Z"),
            endAt: new Date("2026-09-14T02:30:00.000Z"),
          },
        ],
      }),
    ).toThrow(QuoteIntervalError);
    expect(() =>
      engine.quote({
        ...common,
        startAt: new Date("2026-09-14T16:00:00.000Z"),
        endAt: new Date("2026-09-14T18:00:00.000Z"),
        operatingHours: [{ weekday: 1, startMinute: 0, endMinute: 1440 }],
      }),
    ).toThrow(QuoteIntervalError);
  });
});
