ALTER TABLE "users"
  ADD COLUMN "avatar_object_key" TEXT,
  ADD COLUMN "avatar_updated_at" TIMESTAMPTZ(3);
