import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { ApiError, requireRole } from "@/lib/rbac";
import { computeSalaryBreakdown } from "@/lib/salary-slip";

/**
 * POST /api/salary-slips/preview
 * Admin + Academics. Compute and return the breakdown for a teacher over a
 * date range WITHOUT saving anything. The frontend shows this table with
 * per-line waiver toggles, then POSTs /api/salary-slips to actually save.
 */
const previewSchema = z.object({
  teacherId: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    requireRole(session, ["ADMIN", "ACADEMICS"]);

    const parsed = previewSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: { message: "Invalid request body.", code: "VALIDATION_ERROR" } },
        { status: 400 },
      );
    }
    const body = parsed.data;

    const from = new Date(body.from);
    const to = new Date(body.to);
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) {
      return NextResponse.json(
        { error: { message: "Invalid date range.", code: "VALIDATION_ERROR" } },
        { status: 400 },
      );
    }

    const { config, workingDays, leaveDays, baseAmount, deductions } =
      await computeSalaryBreakdown(body.teacherId, from, to);

    const lineItems = deductions.map((d, i) => ({
      lineId: `d-${i}`,
      date: d.date.toISOString().split("T")[0],
      type: d.type,
      amount: d.amount,
    }));

    return NextResponse.json({
      data: {
        teacher: { id: body.teacherId, name: config.teacherName },
        periodFrom: body.from,
        periodTo: body.to,
        perDaySalary: config.perDaySalary,
        lateDeductionType: config.lateDeductionType,
        lateDeductionValue: config.lateDeductionValue,
        workingDays,
        leaveDays,
        baseAmount,
        deductions: lineItems.map((l) => ({ ...l, waived: false })),
        totalDeductions: lineItems.reduce((s, l) => s + l.amount, 0),
        netAmount: baseAmount - lineItems.reduce((s, l) => s + l.amount, 0),
      },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: { message: error.message, code: error.code } },
        { status: error.status },
      );
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { message: "Invalid request body.", code: "VALIDATION_ERROR" } },
        { status: 400 },
      );
    }
    console.error(error);
    return NextResponse.json(
      { error: { message: "An internal error occurred.", code: "INTERNAL_ERROR" } },
      { status: 500 },
    );
  }
}