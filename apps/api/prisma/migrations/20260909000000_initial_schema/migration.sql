-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RoleName" AS ENUM ('CUSTOMER', 'OWNER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "VenueStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'HIDDEN', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ConfirmationMode" AS ENUM ('INSTANT', 'OWNER_APPROVAL');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('USER', 'SYSTEM');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "security_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "name" "RoleName" NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "refresh_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "user_agent" TEXT,
    "family_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owner_applications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "business_name" TEXT NOT NULL,
    "experience" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "review_reason" TEXT,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "owner_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "areas" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "parent_id" UUID,

    CONSTRAINT "areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venues" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "area_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "status" "VenueStatus" NOT NULL DEFAULT 'DRAFT',
    "moderation_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "venues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venue_images" (
    "id" UUID NOT NULL,
    "venue_id" UUID NOT NULL,
    "object_key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alt_text" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "venue_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "amenities" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "amenities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venue_amenities" (
    "venue_id" UUID NOT NULL,
    "amenity_id" UUID NOT NULL,

    CONSTRAINT "venue_amenities_pkey" PRIMARY KEY ("venue_id","amenity_id")
);

-- CreateTable
CREATE TABLE "sports" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "sports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venue_sport_offerings" (
    "id" UUID NOT NULL,
    "venue_id" UUID NOT NULL,
    "sport_id" UUID NOT NULL,
    "confirmation_mode" "ConfirmationMode" NOT NULL DEFAULT 'INSTANT',
    "advance_booking_days" INTEGER NOT NULL DEFAULT 14,
    "cancellation_notice_minutes" INTEGER NOT NULL DEFAULT 120,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "venue_sport_offerings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courts" (
    "id" UUID NOT NULL,
    "offering_id" UUID NOT NULL,
    "internal_name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "courts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operating_hours" (
    "id" UUID NOT NULL,
    "venue_id" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "start_minute" INTEGER NOT NULL,
    "end_minute" INTEGER NOT NULL,

    CONSTRAINT "operating_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venue_closures" (
    "id" UUID NOT NULL,
    "venue_id" UUID NOT NULL,
    "court_id" UUID,
    "start_at" TIMESTAMPTZ(3) NOT NULL,
    "end_at" TIMESTAMPTZ(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "venue_closures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_rules" (
    "id" UUID NOT NULL,
    "offering_id" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "start_minute" INTEGER NOT NULL,
    "end_minute" INTEGER NOT NULL,
    "price_per_slot" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pricing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "offering_id" UUID NOT NULL,
    "court_id" UUID NOT NULL,
    "start_at" TIMESTAMPTZ(3) NOT NULL,
    "end_at" TIMESTAMPTZ(3) NOT NULL,
    "status" "BookingStatus" NOT NULL,
    "expires_at" TIMESTAMPTZ(3),
    "occupies_court" BOOLEAN NOT NULL,
    "price_amount" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "slot_minutes" INTEGER NOT NULL DEFAULT 30,
    "cancellation_notice_minutes" INTEGER NOT NULL,
    "confirmation_mode_snapshot" "ConfirmationMode" NOT NULL,
    "pricing_breakdown" JSONB NOT NULL,
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_status_history" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "from_status" "BookingStatus",
    "to_status" "BookingStatus" NOT NULL,
    "actor_type" "ActorType" NOT NULL,
    "actor_id" UUID,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "resource_id" UUID,
    "response_status" INTEGER,
    "response_body" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "available_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatched_at" TIMESTAMPTZ(3),
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_events" (
    "event_id" UUID NOT NULL,
    "processor_name" TEXT NOT NULL,
    "processed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_events_pkey" PRIMARY KEY ("event_id","processor_name")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" UUID NOT NULL,
    "before_data" JSONB,
    "after_data" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");

-- CreateIndex
CREATE INDEX "refresh_sessions_user_id_family_id_idx" ON "refresh_sessions"("user_id", "family_id");

-- CreateIndex
CREATE INDEX "owner_applications_user_id_status_idx" ON "owner_applications"("user_id", "status");

-- CreateIndex
CREATE INDEX "owner_applications_status_created_at_idx" ON "owner_applications"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "areas_code_key" ON "areas"("code");

-- CreateIndex
CREATE INDEX "areas_parent_id_idx" ON "areas"("parent_id");

-- CreateIndex
CREATE INDEX "venues_owner_id_status_idx" ON "venues"("owner_id", "status");

-- CreateIndex
CREATE INDEX "venues_area_id_status_idx" ON "venues"("area_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "venue_images_venue_id_object_key_key" ON "venue_images"("venue_id", "object_key");

-- CreateIndex
CREATE UNIQUE INDEX "amenities_code_key" ON "amenities"("code");

-- CreateIndex
CREATE INDEX "venue_amenities_amenity_id_idx" ON "venue_amenities"("amenity_id");

-- CreateIndex
CREATE UNIQUE INDEX "sports_code_key" ON "sports"("code");

-- CreateIndex
CREATE INDEX "venue_sport_offerings_sport_id_is_active_idx" ON "venue_sport_offerings"("sport_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "venue_sport_offerings_venue_id_sport_id_key" ON "venue_sport_offerings"("venue_id", "sport_id");

-- CreateIndex
CREATE UNIQUE INDEX "courts_offering_id_internal_name_key" ON "courts"("offering_id", "internal_name");

-- CreateIndex
CREATE UNIQUE INDEX "courts_id_offering_id_key" ON "courts"("id", "offering_id");

-- CreateIndex
CREATE INDEX "operating_hours_venue_id_weekday_idx" ON "operating_hours"("venue_id", "weekday");

-- CreateIndex
CREATE INDEX "venue_closures_venue_id_start_at_end_at_idx" ON "venue_closures"("venue_id", "start_at", "end_at");

-- CreateIndex
CREATE INDEX "venue_closures_court_id_start_at_end_at_idx" ON "venue_closures"("court_id", "start_at", "end_at");

-- CreateIndex
CREATE INDEX "pricing_rules_offering_id_weekday_idx" ON "pricing_rules"("offering_id", "weekday");

-- CreateIndex
CREATE INDEX "bookings_customer_id_start_at_idx" ON "bookings"("customer_id", "start_at");

-- CreateIndex
CREATE INDEX "bookings_offering_id_start_at_end_at_idx" ON "bookings"("offering_id", "start_at", "end_at");

-- CreateIndex
CREATE INDEX "bookings_court_id_start_at_end_at_idx" ON "bookings"("court_id", "start_at", "end_at");

-- CreateIndex
CREATE INDEX "bookings_status_expires_at_idx" ON "bookings"("status", "expires_at");

-- CreateIndex
CREATE INDEX "booking_status_history_booking_id_created_at_idx" ON "booking_status_history"("booking_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_actor_id_scope_key_key" ON "idempotency_records"("actor_id", "scope", "key");

-- CreateIndex
CREATE INDEX "outbox_events_dispatched_at_available_at_idx" ON "outbox_events"("dispatched_at", "available_at");

-- CreateIndex
CREATE INDEX "audit_logs_resource_type_resource_id_created_at_idx" ON "audit_logs"("resource_type", "resource_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_sessions" ADD CONSTRAINT "refresh_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owner_applications" ADD CONSTRAINT "owner_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owner_applications" ADD CONSTRAINT "owner_applications_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "areas" ADD CONSTRAINT "areas_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venues" ADD CONSTRAINT "venues_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venues" ADD CONSTRAINT "venues_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_images" ADD CONSTRAINT "venue_images_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_amenities" ADD CONSTRAINT "venue_amenities_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_amenities" ADD CONSTRAINT "venue_amenities_amenity_id_fkey" FOREIGN KEY ("amenity_id") REFERENCES "amenities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_sport_offerings" ADD CONSTRAINT "venue_sport_offerings_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_sport_offerings" ADD CONSTRAINT "venue_sport_offerings_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "sports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courts" ADD CONSTRAINT "courts_offering_id_fkey" FOREIGN KEY ("offering_id") REFERENCES "venue_sport_offerings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operating_hours" ADD CONSTRAINT "operating_hours_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_closures" ADD CONSTRAINT "venue_closures_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_closures" ADD CONSTRAINT "venue_closures_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "courts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_offering_id_fkey" FOREIGN KEY ("offering_id") REFERENCES "venue_sport_offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_offering_id_fkey" FOREIGN KEY ("offering_id") REFERENCES "venue_sport_offerings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_court_id_offering_id_fkey" FOREIGN KEY ("court_id", "offering_id") REFERENCES "courts"("id", "offering_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_status_history" ADD CONSTRAINT "booking_status_history_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_status_history" ADD CONSTRAINT "booking_status_history_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- PostgreSQL invariants not representable in Prisma schema
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "venue_sport_offerings"
  ADD CONSTRAINT "offerings_advance_days_check"
    CHECK ("advance_booking_days" BETWEEN 1 AND 365),
  ADD CONSTRAINT "offerings_cancellation_notice_check"
    CHECK ("cancellation_notice_minutes" BETWEEN 0 AND 10080);

ALTER TABLE "operating_hours"
  ADD CONSTRAINT "operating_hours_weekday_check" CHECK ("weekday" BETWEEN 1 AND 7),
  ADD CONSTRAINT "operating_hours_minutes_check"
    CHECK ("start_minute" >= 0 AND "end_minute" <= 1440 AND "start_minute" < "end_minute"),
  ADD CONSTRAINT "operating_hours_no_overlap"
    EXCLUDE USING gist (
      "venue_id" WITH =,
      "weekday" WITH =,
      int4range("start_minute", "end_minute", '[)') WITH &&
    );

ALTER TABLE "pricing_rules"
  ADD CONSTRAINT "pricing_rules_weekday_check" CHECK ("weekday" BETWEEN 1 AND 7),
  ADD CONSTRAINT "pricing_rules_minutes_check"
    CHECK ("start_minute" >= 0 AND "end_minute" <= 1440 AND "start_minute" < "end_minute"),
  ADD CONSTRAINT "pricing_rules_positive_price_check" CHECK ("price_per_slot" > 0),
  ADD CONSTRAINT "pricing_rules_no_overlap"
    EXCLUDE USING gist (
      "offering_id" WITH =,
      "weekday" WITH =,
      int4range("start_minute", "end_minute", '[)') WITH &&
    );

ALTER TABLE "venue_closures"
  ADD CONSTRAINT "venue_closures_interval_check" CHECK ("start_at" < "end_at");

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_interval_check" CHECK ("start_at" < "end_at"),
  ADD CONSTRAINT "bookings_price_check" CHECK ("price_amount" >= 0),
  ADD CONSTRAINT "bookings_slot_minutes_check" CHECK ("slot_minutes" = 30);

ALTER TABLE "booking_status_history"
  ADD CONSTRAINT "booking_history_actor_check"
    CHECK (
      ("actor_type" = 'SYSTEM' AND "actor_id" IS NULL)
      OR ("actor_type" = 'USER' AND "actor_id" IS NOT NULL)
    );

CREATE UNIQUE INDEX "owner_applications_one_pending_per_user"
  ON "owner_applications" ("user_id")
  WHERE "status" = 'PENDING';
