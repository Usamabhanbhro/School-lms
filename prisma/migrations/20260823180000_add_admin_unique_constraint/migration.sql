-- Reconcile the production-applied canonical single-Admin index with repository migration history.
-- Production already contains this index; CREATE IF NOT EXISTS keeps this migration idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS "User_admin_role_unique"
  ON "User" ("role")
  WHERE "role" = 'ADMIN';
