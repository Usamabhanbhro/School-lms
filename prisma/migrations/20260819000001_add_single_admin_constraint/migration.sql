-- Create a partial unique index to enforce single admin at database level
-- Only one user with role = ADMIN can exist
CREATE UNIQUE INDEX IF NOT EXISTS "User_single_admin_idx" ON "User" ("role") WHERE "role" = 'ADMIN';
