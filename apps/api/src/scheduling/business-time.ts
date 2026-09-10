export const BUSINESS_TIME_ZONE = "Asia/Ho_Chi_Minh";
export const SLOT_MINUTES = 30;

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const weekdays: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

export interface BusinessDateTime {
  date: string;
  weekday: number;
  minute: number;
  second: number;
}

export function toBusinessDateTime(value: Date): BusinessDateTime {
  if (Number.isNaN(value.getTime())) throw new Error("Invalid timestamp");
  const parts = Object.fromEntries(
    formatter
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const weekdayLabel = parts.weekday;
  if (!weekdayLabel) throw new Error("Invalid business weekday");
  const weekday = weekdays[weekdayLabel];
  if (!weekday) throw new Error("Invalid business weekday");
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    weekday,
    minute: Number(parts.hour) * 60 + Number(parts.minute),
    second: Number(parts.second),
  };
}

export function overlaps(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA < endB && startB < endA;
}
