-- Migration: Add isActive to Student and replace full unique constraints with
-- partial unique indexes scoped to active students only.
--
-- Design decision: Prisma's @unique does not support WHERE clauses, so we drop
-- the Prisma-managed unique constraints and create partial unique indexes via
-- raw SQL. Uniqueness among active students is enforced at the database level;
-- application code validates uniqueness on create/edit (scoped to isActive=true).

-- 1. Add isActive column (default true for existing rows)
ALTER TABLE "Student" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- 2. Drop the existing full unique indexes
DROP INDEX IF EXISTS "Student_studentId_key";
DROP INDEX IF EXISTS "Student_classSectionId_rollNumber_key";

-- 3. Create partial unique indexes scoped to active students only
-- Student ID must be unique among active students (nulls excluded — null studentId is allowed)
CREATE UNIQUE INDEX "Student_studentId_active_unique"
  ON "Student"("studentId")
  WHERE "isActive" = true AND "studentId" IS NOT NULL;

-- Roll number must be unique within a class section among active students (nulls excluded)
CREATE UNIQUE INDEX "Student_classSection_rollNumber_active_unique"
  ON "Student"("classSectionId", "rollNumber")
  WHERE "isActive" = true AND "rollNumber" IS NOT NULL;

-- 4. Non-unique indexes for efficient filtering
CREATE INDEX "Student_isActive_idx" ON "Student"("isActive");
CREATE INDEX "Student_classSectionId_isActive_idx" ON "Student"("classSectionId", "isActive");
