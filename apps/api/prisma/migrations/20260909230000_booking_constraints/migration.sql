-- Keep booking state and the exclusion predicate in sync.
UPDATE "bookings"
SET "occupies_court" = ("status" IN ('PENDING', 'CONFIRMED'));

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_occupancy_matches_status_check"
    CHECK (
      "occupies_court" = ("status" IN ('PENDING', 'CONFIRMED'))
    );

-- Half-open intervals allow 10:00-11:00 and 11:00-12:00 on one court,
-- while overlapping active holds/confirmed bookings are rejected atomically.
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_no_active_court_overlap"
    EXCLUDE USING gist (
      "court_id" WITH =,
      tstzrange("start_at", "end_at", '[)') WITH &&
    )
    WHERE ("occupies_court");
