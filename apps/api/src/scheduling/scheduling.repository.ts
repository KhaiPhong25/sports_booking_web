import { WeeklyWindow } from "./schedule-policy";

export const SCHEDULING_REPOSITORY = Symbol("SCHEDULING_REPOSITORY");

export interface OperatingHourRecord extends WeeklyWindow {
  id: string;
  venueId: string;
}

export interface ClosureRecord {
  id: string;
  venueId: string;
  courtId: string | null;
  startAt: Date;
  endAt: Date;
  reason: string;
}

export interface ClosureInput {
  courtId?: string | null;
  startAt: Date;
  endAt: Date;
  reason: string;
}

export interface SchedulingRepository {
  venueOwner(venueId: string): Promise<string | null>;
  courtVenue(courtId: string): Promise<string | null>;
  listHours(venueId: string): Promise<OperatingHourRecord[]>;
  replaceHours(
    venueId: string,
    windows: WeeklyWindow[],
  ): Promise<OperatingHourRecord[]>;
  replaceHoursIfNoBookings(
    venueId: string,
    windows: WeeklyWindow[],
    now: Date,
  ): Promise<OperatingHourRecord[] | null>;
  listClosures(venueId: string): Promise<ClosureRecord[]>;
  findClosure(
    id: string,
  ): Promise<(ClosureRecord & { ownerId: string }) | null>;
  createClosure(venueId: string, input: ClosureInput): Promise<ClosureRecord>;
  createClosureIfNoBookings(
    venueId: string,
    input: ClosureInput,
  ): Promise<ClosureRecord | null>;
  updateClosure(id: string, input: ClosureInput): Promise<ClosureRecord>;
  updateClosureIfNoBookings(
    id: string,
    venueId: string,
    input: ClosureInput,
  ): Promise<ClosureRecord | null>;
  deleteClosure(id: string): Promise<void>;
  hasOccupyingBooking(
    venueId: string,
    courtId: string | null,
    startAt: Date,
    endAt: Date,
  ): Promise<boolean>;
}
