-- Add append-only payments linked to immutable FeeChallan snapshots.
-- Status and balance remain derived at read time from payment totals.
CREATE TABLE "FeeChallanPayment" (
    "id" TEXT NOT NULL,
    "feeChallanId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paidAt" DATE NOT NULL,
    "recordedByUserId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FeeChallanPayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FeeChallanPayment_feeChallanId_paidAt_idx"
  ON "FeeChallanPayment"("feeChallanId", "paidAt");

ALTER TABLE "FeeChallanPayment"
  ADD CONSTRAINT "FeeChallanPayment_feeChallanId_fkey"
  FOREIGN KEY ("feeChallanId") REFERENCES "FeeChallan"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FeeChallanPayment"
  ADD CONSTRAINT "FeeChallanPayment_recordedByUserId_fkey"
  FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
