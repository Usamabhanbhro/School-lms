-- AlterTable: Add dimension columns to TemplateField
-- Nullable for backward compatibility — null means auto-size to content.
ALTER TABLE "TemplateField" ADD COLUMN "widthPercent" DOUBLE PRECISION;
ALTER TABLE "TemplateField" ADD COLUMN "heightPercent" DOUBLE PRECISION;
