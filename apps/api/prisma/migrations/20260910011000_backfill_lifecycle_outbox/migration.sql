INSERT INTO "outbox_events"
  ("id", "aggregate_type", "aggregate_id", "event_type", "payload", "available_at")
SELECT
  gen_random_uuid(),
  'Booking',
  booking."id",
  CASE
    WHEN booking."status" = 'PENDING' THEN 'BOOKING_EXPIRATION_REQUESTED'
    ELSE 'BOOKING_COMPLETION_REQUESTED'
  END,
  jsonb_build_object('bookingId', booking."id"),
  CASE
    WHEN booking."status" = 'PENDING' THEN booking."expires_at"
    ELSE booking."end_at"
  END
FROM "bookings" booking
WHERE (
    (
      booking."status" = 'PENDING'
      AND booking."expires_at" IS NOT NULL
    )
    OR booking."status" = 'CONFIRMED'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "outbox_events" existing
    WHERE existing."aggregate_type" = 'Booking'
      AND existing."aggregate_id" = booking."id"
      AND existing."event_type" = CASE
        WHEN booking."status" = 'PENDING' THEN 'BOOKING_EXPIRATION_REQUESTED'
        ELSE 'BOOKING_COMPLETION_REQUESTED'
      END
  )
ON CONFLICT DO NOTHING;
