-- AlterTable: Make expiresAt nullable on AdminRecoveryCode
-- Recovery codes no longer expire after 24 hours. They remain valid until
-- consumed (successful password reset) or manually regenerated (from admin panel).
ALTER TABLE "AdminRecoveryCode" ALTER COLUMN "expiresAt" DROP NOT NULL;
