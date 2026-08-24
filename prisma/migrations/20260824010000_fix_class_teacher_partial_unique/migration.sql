-- Replace the full classSectionId/isActive uniqueness with the intended active-only invariant.
-- Historical inactive assignments must coexist so reassignment can preserve history.
DROP INDEX IF EXISTS "ClassTeacherAssignment_classSectionId_isActive_key";
CREATE UNIQUE INDEX IF NOT EXISTS "ClassTeacherAssignment_active_unique"
  ON "ClassTeacherAssignment" ("classSectionId")
  WHERE "isActive" = true;
