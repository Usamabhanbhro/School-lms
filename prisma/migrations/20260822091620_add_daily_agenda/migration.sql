-- AlterTable
ALTER TABLE "ClassTeacherAssignment" ALTER COLUMN "isActive" SET DEFAULT true;

-- CreateTable
CREATE TABLE "DailyAgenda" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "classSectionId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyAgenda_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyAgenda_classSectionId_date_idx" ON "DailyAgenda"("classSectionId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyAgenda_teacherId_classSectionId_subjectId_date_key" ON "DailyAgenda"("teacherId", "classSectionId", "subjectId", "date");

-- AddForeignKey
ALTER TABLE "DailyAgenda" ADD CONSTRAINT "DailyAgenda_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyAgenda" ADD CONSTRAINT "DailyAgenda_classSectionId_fkey" FOREIGN KEY ("classSectionId") REFERENCES "ClassSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyAgenda" ADD CONSTRAINT "DailyAgenda_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "Student_classSection_rollNumber_unique" RENAME TO "Student_classSectionId_rollNumber_key";
