import { SLOT_MINUTES, toBusinessDateTime } from "../scheduling/business-time";

export class BookingTimePolicyError extends Error {}

export class BookingTimePolicy {
  validate(startAt: Date, endAt: Date, now: Date, advanceBookingDays: number) {
    const durationMinutes = (endAt.getTime() - startAt.getTime()) / 60_000;
    if (
      Number.isNaN(durationMinutes) ||
      durationMinutes < 60 ||
      durationMinutes > 240 ||
      durationMinutes % SLOT_MINUTES !== 0
    ) {
      throw new BookingTimePolicyError(
        "Booking duration must be 60-240 minutes",
      );
    }
    const startLocal = toBusinessDateTime(startAt);
    const endLocal = toBusinessDateTime(endAt);
    if (
      startLocal.date !== endLocal.date ||
      startLocal.second !== 0 ||
      endLocal.second !== 0 ||
      startLocal.minute % SLOT_MINUTES !== 0 ||
      endLocal.minute % SLOT_MINUTES !== 0
    ) {
      throw new BookingTimePolicyError(
        "Booking must use the 30-minute grid within one business date",
      );
    }
    if (startAt.getTime() < now.getTime() + 60 * 60_000) {
      throw new BookingTimePolicyError("Booking requires 60 minutes lead time");
    }
    if (startAt.getTime() > now.getTime() + advanceBookingDays * 86_400_000) {
      throw new BookingTimePolicyError("Booking exceeds the advance horizon");
    }
  }
}
