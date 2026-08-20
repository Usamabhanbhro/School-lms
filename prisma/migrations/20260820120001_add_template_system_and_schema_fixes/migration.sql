-- Migration: Add template system and reconcile schema drift
-- Reconciles differences between the init migration (20260818110428) and the
-- current Prisma schema. Covers: isActive on ClassTeacherAssignment, column
-- rename on Certificate/FeeChallan, DocumentTemplate tables, and missing indexes.

-- ─── 1. ClassTeacherAssignment: add isActive safely ──────────────
-- Strategy: add the column (all rows get false), then mark only the
-- most-recently-created row per classSectionId as active. This is safe
-- regardless of how many historical rows exist per class section.

ALTER TABLE "ClassTeacherAssignment" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT false;

-- Mark the most recent assignment per class section as active
UPDATE "ClassTeacherAssignment" SET "isActive" = true
WHERE "id" IN (
  SELECT "id" FROM (
    SELECT "id",
           ROW_NUMBER() OVER (
             PARTITION BY "classSectionId"
             ORDER BY "createdAt" DESC
           ) AS rn
    FROM "ClassTeacherAssignment"
  ) ranked
  WHERE rn = 1
);

-- ─── 2. ClassTeacherAssignment: fix unique index ─────────────────
-- The init migration created a UNIQUE INDEX (not a constraint):
--   CREATE UNIQUE INDEX "ClassTeacherAssignment_classSectionId_key"
--   ON "ClassTeacherAssignment"("classSectionId");
-- Prisma's @@unique([classSectionId, isActive]) expects a UNIQUE INDEX:
--   CREATE UNIQUE INDEX "ClassTeacherAssignment_classSectionId_isActive_key"
--   ON "ClassTeacherAssignment"("classSectionId", "isActive");

DROP INDEX "ClassTeacherAssignment_classSectionId_key";
CREATE UNIQUE INDEX "ClassTeacherAssignment_classSectionId_isActive_key"
  ON "ClassTeacherAssignment"("classSectionId", "isActive");

-- ─── 3. Rename generatedByAdminId → generatedByUserId ────────────
-- Data-safe: RENAME COLUMN preserves all existing data.

-- Certificate
ALTER TABLE "Certificate" RENAME COLUMN "generatedByAdminId" TO "generatedByUserId";
ALTER TABLE "Certificate" DROP CONSTRAINT "Certificate_generatedByAdminId_fkey";
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_generatedByUserId_fkey"
  FOREIGN KEY ("generatedByUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- FeeChallan
ALTER TABLE "FeeChallan" RENAME COLUMN "generatedByAdminId" TO "generatedByUserId";
ALTER TABLE "FeeChallan" DROP CONSTRAINT "FeeChallan_generatedByAdminId_fkey";
ALTER TABLE "FeeChallan" ADD CONSTRAINT "FeeChallan_generatedByUserId_fkey"
  FOREIGN KEY ("generatedByUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── 4. Create DocumentTemplateType enum ─────────────────────────
CREATE TYPE "DocumentTemplateType" AS ENUM ('LEAVING_CERTIFICATE', 'CHARACTER_CERTIFICATE', 'REPORT_CARD', 'FEE_CHALLAN');

-- ─── 5. Create DocumentTemplate ──────────────────────────────────
CREATE TABLE "DocumentTemplate" (
    "id" TEXT NOT NULL,
    "type" "DocumentTemplateType" NOT NULL,
    "originalFileUrl" TEXT NOT NULL,
    "backgroundImageUrl" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

-- ─── 6. Create TemplateField ─────────────────────────────────────
CREATE TABLE "TemplateField" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "xPercent" DOUBLE PRECISION NOT NULL,
    "yPercent" DOUBLE PRECISION NOT NULL,
    "fontSize" INTEGER NOT NULL,
    "textAlign" TEXT NOT NULL DEFAULT 'left',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateField_pkey" PRIMARY KEY ("id")
);

-- ─── 7. Create TemplateTableRegion ───────────────────────────────
CREATE TABLE "TemplateTableRegion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "anchorXPercent" DOUBLE PRECISION NOT NULL,
    "anchorYPercent" DOUBLE PRECISION NOT NULL,
    "rowHeightPercent" DOUBLE PRECISION NOT NULL,
    "columns" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateTableRegion_pkey" PRIMARY KEY ("id")
);

-- ─── 8. Add templateId FK columns ────────────────────────────────
-- Certificate
ALTER TABLE "Certificate" ADD COLUMN "templateId" TEXT;
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ReportCard
ALTER TABLE "ReportCard" ADD COLUMN "templateId" TEXT;
ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- FeeChallan
ALTER TABLE "FeeChallan" ADD COLUMN "templateId" TEXT;
ALTER TABLE "FeeChallan" ADD CONSTRAINT "FeeChallan_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── 9. Add indexes ─────────────────────────────────────────────
CREATE INDEX "DocumentTemplate_type_isActive_idx"
  ON "DocumentTemplate"("type", "isActive");
CREATE INDEX "TemplateField_templateId_idx"
  ON "TemplateField"("templateId");
CREATE INDEX "TemplateTableRegion_templateId_idx"
  ON "TemplateTableRegion"("templateId");

-- ─── 10. Add foreign keys for template relationships ─────────────
ALTER TABLE "TemplateField" ADD CONSTRAINT "TemplateField_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TemplateTableRegion" ADD CONSTRAINT "TemplateTableRegion_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

