/*
  Warnings:

  - Added the required column `address` to the `Student` table without a default value. This is not possible if the table is not empty.
  - Added the required column `guardianContact` to the `Student` table without a default value. This is not possible if the table is not empty.
  - Added the required column `placeOfBirth` to the `Student` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "BloodGroup" AS ENUM ('A_PLUS', 'A_MINUS', 'B_PLUS', 'B_MINUS', 'AB_PLUS', 'AB_MINUS', 'O_PLUS', 'O_MINUS');

-- AlterEnum
ALTER TYPE "AttendanceStatus" ADD VALUE 'LATE';

-- AlterTable: add new columns with defaults for existing rows
ALTER TABLE "Student" ADD COLUMN "placeOfBirth" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Student" ADD COLUMN "bloodGroup" "BloodGroup";
ALTER TABLE "Student" ADD COLUMN "guardianContact" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Student" ADD COLUMN "address" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "TeacherAttendance" ADD COLUMN     "actualOffTime" TEXT,
ADD COLUMN     "actualReportingTime" TEXT;

-- AlterTable
ALTER TABLE "TeacherProfile" ADD COLUMN     "lateThreshold" TEXT,
ADD COLUMN     "offTime" TEXT,
ADD COLUMN     "reportingTime" TEXT;
