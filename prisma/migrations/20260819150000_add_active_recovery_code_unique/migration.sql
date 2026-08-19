-- Partial unique index: at most one active recovery code per user.
-- A code is "active" when consumedAt IS NULL AND replacedAt IS NULL.
-- This prevents concurrent requests from creating multiple usable codes.
CREATE UNIQUE INDEX "AdminRecoveryCode_active_per_user_idx"
ON "AdminRecoveryCode"("userId")
WHERE "consumedAt" IS NULL AND "replacedAt" IS NULL;
