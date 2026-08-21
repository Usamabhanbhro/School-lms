-- AlterTable: Add rich formatting columns to TemplateField
-- These columns are nullable for backward compatibility with existing templates.
ALTER TABLE "TemplateField" ADD COLUMN "fontFamily" TEXT;
ALTER TABLE "TemplateField" ADD COLUMN "fontColor" TEXT;
ALTER TABLE "TemplateField" ADD COLUMN "fontWeight" TEXT;
ALTER TABLE "TemplateField" ADD COLUMN "fontStyle" TEXT;
ALTER TABLE "TemplateField" ADD COLUMN "textDecoration" TEXT;
