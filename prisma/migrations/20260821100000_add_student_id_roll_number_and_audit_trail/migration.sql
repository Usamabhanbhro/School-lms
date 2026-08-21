-- Migration: Add student ID, roll number, and attendance audit trail
-- Data-safe: all new fields are nullable, existing data untouched

-- 1. Add studentId (unique, nullable) to Student
ALTER TABLE "Student" ADD COLUMN "studentId" TEXT;

-- 2. Add rollNumber (nullable) to Student
ALTER TABLE "Student" ADD COLUMN "rollNumber" TEXT;

-- 3. Add unique constraint on studentId
CREATE UNIQUE INDEX "Student_studentId_key" ON "Student"("studentId");

-- 4. Add partial unique index on (classSectionId, rollNumber) WHERE rollNumber IS NOT NULL
CREATE UNIQUE INDEX "Student_classSection_rollNumber_unique" ON "Student"("classSectionId", "rollNumber") WHERE "rollNumber" IS NOT NULL;

-- 5. Create AttendanceAuditLog table
CREATE TABLE "AttendanceAuditLog" (
    "id" TEXT NOT NULL,
    "studentAttendanceId" TEXT NOT NULL,
    "editedById" TEXT NOT NULL,
    "editedByRole" "Role" NOT NULL,
    "previousStatus" "AttendanceStatus" NOT NULL,
    "newStatus" "AttendanceStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceAuditLog_pkey" PRIMARY KEY ("id")
);

-- 6. Add unique constraint on studentAttendanceId (one audit log per edit)
CREATE UNIQUE INDEX "AttendanceAuditLog_studentAttendanceId_key" ON "AttendanceAuditLog"("studentAttendanceId");

-- 7. Add index for efficient audit log queries
CREATE INDEX "AttendanceAuditLog_studentAttendanceId_idx" ON "AttendanceAuditLog"("studentAttendanceId");

-- 8. Add foreign key constraints
ALTER TABLE "AttendanceAuditLog" ADD CONSTRAINT "AttendanceAuditLog_studentAttendanceId_fkey" FOREIGN KEY ("studentAttendanceId") REFERENCES "StudentAttendance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AttendanceAuditLog" ADD CONSTRAINT "AttendanceAuditLog_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
