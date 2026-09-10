import { SLOT_MINUTES } from "./business-time";

export interface WeeklyWindow {
  weekday: number;
  startMinute: number;
  endMinute: number;
}

export class ScheduleValidationError extends Error {}

export class SchedulePolicy {
  validateWeeklyWindows(windows: WeeklyWindow[]) {
    for (const window of windows) {
      if (
        !Number.isInteger(window.weekday) ||
        window.weekday < 1 ||
        window.weekday > 7 ||
        !Number.isInteger(window.startMinute) ||
        !Number.isInteger(window.endMinute) ||
        window.startMinute < 0 ||
        window.endMinute > 1440 ||
        window.startMinute >= window.endMinute ||
        window.startMinute % SLOT_MINUTES !== 0 ||
        window.endMinute % SLOT_MINUTES !== 0
      ) {
        throw new ScheduleValidationError("Invalid operating-hours window");
      }
    }
    const sorted = [...windows].sort(
      (left, right) =>
        left.weekday - right.weekday || left.startMinute - right.startMinute,
    );
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const current = sorted[index];
      if (!previous || !current) continue;
      if (
        previous.weekday === current.weekday &&
        current.startMinute < previous.endMinute
      ) {
        throw new ScheduleValidationError("Operating-hours windows overlap");
      }
    }
  }
}
