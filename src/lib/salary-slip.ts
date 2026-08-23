import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/rbac";

/**
 * Shared salary-slip computation used by both the preview and save routes.
 *
 * Rules (SRS §1.11):
 *  - Absent day   → full per-day pay deducted (no pay for that day).
 *  - Late day     → deducted per the teacher's lateDeductionType:
 *      AMOUNT      → flat lateDeductionValue (Rs.)
 *      PERCENTAGE  → perDaySalary * lateDeductionValue / 100
 *  - Leave/Present→ no deduction.
 *  - A day with no attendance record is not counted as a working day.
 */

export interface DeductionLine {
  date: Date;
  type: "LATE" | "ABSENT";
  amount: number;
}

export interface TeacherSalaryConfig {
  teacherId: string;
  teacherName: string;
  perDaySalary: number;
  lateDeductionType: "AMOUNT" | "PERCENTAGE";
  lateDeductionValue: number;
}

/** Load a teacher and their salary config; throws if not configured. */
export async function loadTeacherSalaryConfig(teacherId: string): Promise<TeacherSalaryConfig> {
  const teacher = await prisma.teacherProfile.findUnique({ where: { id: teacherId } });
  if (!teacher) {
    throw new ApiError(404, "NOT_FOUND", "Teacher not found.");
  }
  const { perDaySalary, lateDeductionType, lateDeductionValue } = teacher;
  if (perDaySalary == null || !lateDeductionType || lateDeductionValue == null) {
    throw new ApiError(
      400,
      "SALARY_NOT_CONFIGURED",
      "Salary rate not configured for this teacher — ask Admin to set it in Users.",
    );
  }
  return {
    teacherId: teacher.id,
    teacherName: teacher.name,
    perDaySalary,
    lateDeductionType,
    lateDeductionValue,
  };
}

/** Compute base + per-day deduction lines from attendance for the period. */
export async function computeSalaryBreakdown(
  teacherId: string,
  from: Date,
  to: Date,
): Promise<{ config: TeacherSalaryConfig; attendance: { date: Date; status: string }[]; workingDays: number; leaveDays: number; baseAmount: number; deductions: DeductionLine[] }> {
  const config = await loadTeacherSalaryConfig(teacherId);

  const attendance = await prisma.teacherAttendance.findMany({
    where: { teacherId, date: { gte: from, lte: to } },
    orderBy: { date: "asc" },
  });

  const deductions: DeductionLine[] = [];
  for (const rec of attendance) {
    if (rec.status === "ABSENT") {
      deductions.push({ date: rec.date, type: "ABSENT", amount: config.perDaySalary });
    } else if (rec.status === "LATE") {
      const amount =
        config.lateDeductionType === "AMOUNT"
          ? config.lateDeductionValue
          : Math.round((config.perDaySalary * config.lateDeductionValue) / 100);
      deductions.push({ date: rec.date, type: "LATE", amount });
    }
  }

  const workingDays = attendance.length;
  const leaveDays = attendance.filter((r) => r.status === "LEAVE").length;
  const baseAmount = workingDays * config.perDaySalary;

  return { config, attendance, workingDays, leaveDays, baseAmount, deductions };
}