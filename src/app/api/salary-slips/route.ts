import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole } from "@/lib/rbac";
import { computeSalaryBreakdown } from "@/lib/salary-slip";

/**
 * GET  /api/salary-slips?teacherId=&from=&to=  → list saved slips
 * POST /api/salary-slips                      → save (generate) a slip
 * POST /api/salary-slips/preview              → computed breakdown, nothing saved
 *
 * Admin + Academics can generate. Rate configuration stays Admin-only via
 * POST/PATCH /api/teachers (enforced there with requireRole ADMIN).
 */

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    requireRole(session, ["ADMIN", "ACADEMICS"]);

    const { searchParams } = new URL(request.url);
    const teacherId = searchParams.get("teacherId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const where: Record<string, unknown> = {};
    if (teacherId) where.teacherId = teacherId;
    if (from || to) {
      where.periodFrom = {};
      if (from) (where.periodFrom as Record<string, Date>).gte = new Date(from);
      if (to) (where.periodFrom as Record<string, Date>).lte = new Date(to);
    }

    const slips = await prisma.salarySlip.findMany({
      where,
      include: {
        teacher: { select: { id: true, name: true } },
        generatedByUser: { select: { id: true, name: true } },
        deductions: { orderBy: { date: "asc" } },
      },
      orderBy: { issuedDate: "desc" },
    });
    return NextResponse.json({ data: slips });
  } catch (error) {
    return handleError(error);
  }
}

const slipBodySchema = z.object({
  teacherId: z.string().min(1),
  from: z.string().min(1), // YYYY-MM-DD
  to: z.string().min(1),
  waivedIds: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const authedSession = requireRole(session, ["ADMIN", "ACADEMICS"]);

    const parsed = slipBodySchema.safeParse(await request.json());
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

    const { config, baseAmount, deductions } = await computeSalaryBreakdown(body.teacherId, from, to);

    // Waived lineIds are excluded from the saved slip entirely (per-instance waiver decision).
    const waivedSet = new Set(body.waivedIds ?? []);
    const nonWaived = deductions.filter((_, i) => !waivedSet.has(`d-${i}`));
    const totalDeductions = nonWaived.reduce((sum, d) => sum + d.amount, 0);
    const netAmount = baseAmount - totalDeductions;

    const slip = await prisma.$transaction(async (tx) => {
      return tx.salarySlip.create({
        data: {
          teacherId: body.teacherId,
          periodFrom: from,
          periodTo: to,
          perDaySalary: config.perDaySalary,
          lateDeductionType: config.lateDeductionType,
          lateDeductionValue: config.lateDeductionValue,
          baseAmount,
          netAmount,
          generatedByUserId: authedSession.user.id,
          deductions: {
            create: nonWaived.map((d) => ({
              date: d.date,
              type: d.type,
              amount: d.amount,
              waived: false,
            })),
          },
        },
        include: {
          teacher: { select: { id: true, name: true } },
          generatedByUser: { select: { id: true, name: true } },
          deductions: { orderBy: { date: "asc" } },
        },
      });
    });

    return NextResponse.json({ data: slip }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

function handleError(error: unknown): NextResponse {
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