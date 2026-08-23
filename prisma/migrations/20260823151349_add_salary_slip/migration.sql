-- CreateEnum
CREATE TYPE "LateDeductionType" AS ENUM ('AMOUNT', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "SalarySlipDeductionType" AS ENUM ('LATE', 'ABSENT');

-- AlterEnum
ALTER TYPE "DocumentTemplateType" ADD VALUE 'SALARY_SLIP';

-- AlterTable
ALTER TABLE "TeacherProfile" ADD COLUMN     "lateDeductionType" "LateDeductionType",
ADD COLUMN     "lateDeductionValue" INTEGER,
ADD COLUMN     "perDaySalary" INTEGER;

-- CreateTable
CREATE TABLE "SalarySlip" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "periodFrom" DATE NOT NULL,
    "periodTo" DATE NOT NULL,
    "perDaySalary" INTEGER NOT NULL,
    "lateDeductionType" "LateDeductionType" NOT NULL,
    "lateDeductionValue" INTEGER NOT NULL,
    "baseAmount" INTEGER NOT NULL,
    "netAmount" INTEGER NOT NULL,
    "generatedByUserId" TEXT NOT NULL,
    "issuedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalarySlip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalarySlipDeduction" (
    "id" TEXT NOT NULL,
    "salarySlipId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "type" "SalarySlipDeductionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "waived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalarySlipDeduction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalarySlip_teacherId_periodFrom_periodTo_idx" ON "SalarySlip"("teacherId", "periodFrom", "periodTo");

-- CreateIndex
CREATE INDEX "SalarySlipDeduction_salarySlipId_idx" ON "SalarySlipDeduction"("salarySlipId");

-- AddForeignKey
ALTER TABLE "SalarySlip" ADD CONSTRAINT "SalarySlip_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalarySlip" ADD CONSTRAINT "SalarySlip_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalarySlipDeduction" ADD CONSTRAINT "SalarySlipDeduction_salarySlipId_fkey" FOREIGN KEY ("salarySlipId") REFERENCES "SalarySlip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
