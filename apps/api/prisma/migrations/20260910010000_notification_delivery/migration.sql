CREATE TYPE "EmailDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

ALTER TABLE "notifications"
  ADD COLUMN "email_status" "EmailDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "email_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "email_last_error" TEXT,
  ADD COLUMN "email_sent_at" TIMESTAMPTZ(3),
  ADD CONSTRAINT "notifications_email_attempts_nonnegative_check"
    CHECK ("email_attempts" >= 0),
  ADD CONSTRAINT "notifications_email_sent_state_check"
    CHECK (
      ("email_status" = 'SENT' AND "email_sent_at" IS NOT NULL)
      OR ("email_status" <> 'SENT' AND "email_sent_at" IS NULL)
    );
