-- Migration: Add AcademicsProfile table
-- The init migration (20260818110428) created TeacherProfile but omitted
-- AcademicsProfile. This table is required for ACADEMICS role accounts.

CREATE TABLE "AcademicsProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cnic" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicsProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AcademicsProfile_cnic_key" ON "AcademicsProfile"("cnic");
CREATE UNIQUE INDEX "AcademicsProfile_userId_key" ON "AcademicsProfile"("userId");

ALTER TABLE "AcademicsProfile" ADD CONSTRAINT "AcademicsProfile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
