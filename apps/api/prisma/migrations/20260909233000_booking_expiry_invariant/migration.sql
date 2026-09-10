ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_pending_expiry_check"
    CHECK (
      ("status" = 'PENDING' AND "expires_at" IS NOT NULL)
      OR ("status" <> 'PENDING' AND "expires_at" IS NULL)
    );
