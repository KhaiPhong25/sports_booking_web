import { SchedulePolicy, ScheduleValidationError } from "./schedule-policy";

describe("SchedulePolicy", () => {
  const policy = new SchedulePolicy();

  it("accepts separate non-overlapping windows and rejects overlap", () => {
    expect(() =>
      policy.validateWeeklyWindows([
        { weekday: 1, startMinute: 360, endMinute: 720 },
        { weekday: 1, startMinute: 780, endMinute: 1320 },
      ]),
    ).not.toThrow();
    expect(() =>
      policy.validateWeeklyWindows([
        { weekday: 1, startMinute: 360, endMinute: 720 },
        { weekday: 1, startMinute: 690, endMinute: 900 },
      ]),
    ).toThrow(ScheduleValidationError);
  });

  it("rejects invalid weekday, non-grid minutes, and overnight windows", () => {
    expect(() =>
      policy.validateWeeklyWindows([
        { weekday: 0, startMinute: 360, endMinute: 720 },
      ]),
    ).toThrow(ScheduleValidationError);
    expect(() =>
      policy.validateWeeklyWindows([
        { weekday: 1, startMinute: 365, endMinute: 720 },
      ]),
    ).toThrow(ScheduleValidationError);
    expect(() =>
      policy.validateWeeklyWindows([
        { weekday: 1, startMinute: 1320, endMinute: 360 },
      ]),
    ).toThrow(ScheduleValidationError);
  });
});
