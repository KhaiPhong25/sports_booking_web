export type BookingStatusValue =
  "PENDING" | "CONFIRMED" | "REJECTED" | "CANCELLED" | "EXPIRED" | "COMPLETED";

export class BookingTransitionError extends Error {}

const transitions = new Map<string, ReadonlySet<BookingStatusValue>>([
  ["NEW", new Set(["PENDING", "CONFIRMED"])],
  ["PENDING", new Set(["CONFIRMED", "REJECTED", "CANCELLED", "EXPIRED"])],
  ["CONFIRMED", new Set(["CANCELLED", "COMPLETED"])],
]);

export class BookingStatePolicy {
  assertTransition(from: BookingStatusValue | null, to: BookingStatusValue) {
    if (!transitions.get(from ?? "NEW")?.has(to)) {
      throw new BookingTransitionError(
        `Booking cannot transition from ${from ?? "NEW"} to ${to}`,
      );
    }
  }

  occupiesCourt(status: BookingStatusValue) {
    return status === "PENDING" || status === "CONFIRMED";
  }
}
