import { randomUUID } from "node:crypto";
import { overlaps } from "../business-time";
import { WeeklyWindow } from "../schedule-policy";
import {
  ClosureInput,
  ClosureRecord,
  OperatingHourRecord,
  SchedulingRepository,
} from "../scheduling.repository";

export class InMemorySchedulingRepository implements SchedulingRepository {
  readonly venues = new Map<string, string>();
  readonly courts = new Map<string, string>();
  readonly hours = new Map<string, OperatingHourRecord[]>();
  readonly closures = new Map<string, ClosureRecord>();
  readonly bookingIntervals: Array<{
    venueId: string;
    courtId: string;
    startAt: Date;
    endAt: Date;
  }> = [];

  async venueOwner(venueId: string) {
    return this.venues.get(venueId) ?? null;
  }
  async courtVenue(courtId: string) {
    return this.courts.get(courtId) ?? null;
  }
  async listHours(venueId: string) {
    return structuredClone(this.hours.get(venueId) ?? []);
  }
  async replaceHours(venueId: string, windows: WeeklyWindow[]) {
    const records = windows.map((window) => ({
      id: randomUUID(),
      venueId,
      ...window,
    }));
    this.hours.set(venueId, records);
    return structuredClone(records);
  }
  async replaceHoursIfNoBookings(
    venueId: string,
    windows: WeeklyWindow[],
    now: Date,
  ) {
    if (
      this.bookingIntervals.some(
        (booking) => booking.venueId === venueId && booking.endAt > now,
      )
    )
      return null;
    return this.replaceHours(venueId, windows);
  }
  async listClosures(venueId: string) {
    return structuredClone(
      [...this.closures.values()].filter((item) => item.venueId === venueId),
    );
  }
  async findClosure(id: string) {
    const closure = this.closures.get(id);
    const ownerId = closure ? this.venues.get(closure.venueId) : null;
    return closure && ownerId ? { ...structuredClone(closure), ownerId } : null;
  }
  async createClosure(venueId: string, input: ClosureInput) {
    const record = {
      id: randomUUID(),
      venueId,
      courtId: input.courtId ?? null,
      startAt: input.startAt,
      endAt: input.endAt,
      reason: input.reason,
    };
    this.closures.set(record.id, record);
    return structuredClone(record);
  }
  async createClosureIfNoBookings(venueId: string, input: ClosureInput) {
    if (
      await this.hasOccupyingBooking(
        venueId,
        input.courtId ?? null,
        input.startAt,
        input.endAt,
      )
    )
      return null;
    return this.createClosure(venueId, input);
  }
  async updateClosure(id: string, input: ClosureInput) {
    const current = this.closures.get(id);
    if (!current) throw new Error("Closure not found");
    Object.assign(current, input, { courtId: input.courtId ?? null });
    return structuredClone(current);
  }
  async updateClosureIfNoBookings(
    id: string,
    venueId: string,
    input: ClosureInput,
  ) {
    if (
      await this.hasOccupyingBooking(
        venueId,
        input.courtId ?? null,
        input.startAt,
        input.endAt,
      )
    )
      return null;
    return this.updateClosure(id, input);
  }
  async deleteClosure(id: string) {
    this.closures.delete(id);
  }
  async hasOccupyingBooking(
    venueId: string,
    courtId: string | null,
    startAt: Date,
    endAt: Date,
  ) {
    return this.bookingIntervals.some(
      (booking) =>
        booking.venueId === venueId &&
        (!courtId || booking.courtId === courtId) &&
        overlaps(startAt, endAt, booking.startAt, booking.endAt),
    );
  }
}
