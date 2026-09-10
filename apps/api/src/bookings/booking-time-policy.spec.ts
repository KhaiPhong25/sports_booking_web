import {
  BookingTimePolicy,
  BookingTimePolicyError,
} from "./booking-time-policy";

describe("BookingTimePolicy", () => {
  const policy = new BookingTimePolicy();
  const now = new Date("2026-09-10T00:00:00.000Z");

  it("accepts 1-4 hour aligned intervals inside the advance horizon", () => {
    expect(() =>
      policy.validate(
        new Date("2026-09-10T01:00:00.000Z"),
        new Date("2026-09-10T05:00:00.000Z"),
        now,
        14,
      ),
    ).not.toThrow();
  });

  it.each([
    ["too soon", "2026-09-10T00:30:00.000Z", "2026-09-10T01:30:00.000Z", 14],
    ["too short", "2026-09-10T01:00:00.000Z", "2026-09-10T01:30:00.000Z", 14],
    ["too long", "2026-09-10T01:00:00.000Z", "2026-09-10T05:30:00.000Z", 14],
    ["off grid", "2026-09-10T01:15:00.000Z", "2026-09-10T02:15:00.000Z", 14],
    ["too far", "2026-09-25T01:00:00.000Z", "2026-09-25T02:00:00.000Z", 14],
  ])("rejects %s", (_name, startAt, endAt, days) => {
    expect(() =>
      policy.validate(new Date(startAt), new Date(endAt), now, days as number),
    ).toThrow(BookingTimePolicyError);
  });
});
