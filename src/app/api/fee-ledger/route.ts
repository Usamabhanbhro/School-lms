import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { deriveFeePaymentSummary, type FeePaymentStatus } from "@/lib/fee-ledger";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole } from "@/lib/rbac";

function parseDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    requireRole(session, ["ADMIN", "ACADEMICS"]);

    const url = new URL(request.url);
    const classSection = url.searchParams.get("classSection")?.trim() || "";
    const studentId = url.searchParams.get("studentId")?.trim() || "";
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const status = url.searchParams.get("status") as FeePaymentStatus | null;

    if (from && !parseDate(from)) {
      throw new ApiError(400, "VALIDATION_ERROR", "The from date must use YYYY-MM-DD format.");
    }
    if (to && !parseDate(to)) {
      throw new ApiError(400, "VALIDATION_ERROR", "The to date must use YYYY-MM-DD format.");
    }
    if (status && !["Pending", "Partial", "Paid"].includes(status)) {
      throw new ApiError(400, "VALIDATION_ERROR", "Status must be Pending, Partial, or Paid.");
    }

    const fromDate = parseDate(from);
    const toDate = parseDate(to);
    const issuedDate = {
      ...(fromDate ? { gte: fromDate } : {}),
      ...(toDate ? { lt: new Date(toDate.getTime() + 24 * 60 * 60 * 1000) } : {}),
    };

    const challans = await prisma.feeChallan.findMany({
      where: {
        ...(studentId ? { studentId } : {}),
        ...(classSection
          ? { classSectionSnapshot: { contains: classSection, mode: "insensitive" } }
          : {}),
        ...(Object.keys(issuedDate).length ? { issuedDate } : {}),
      },
      orderBy: [{ issuedDate: "desc" }, { id: "desc" }],
      select: {
        id: true,
        studentId: true,
        studentNameSnapshot: true,
        classSectionSnapshot: true,
        issuedDate: true,
        total: true,
        payments: { select: { amount: true } },
      },
    });

    const rows = challans
      .map((challan) => {
        const summary = deriveFeePaymentSummary(
          challan.total,
          challan.payments.reduce((sum, payment) => sum + payment.amount, 0),
        );
        return {
          challanId: challan.id,
          studentId: challan.studentId,
          studentName: challan.studentNameSnapshot,
          classSection: challan.classSectionSnapshot,
          issuedDate: challan.issuedDate,
          total: challan.total,
          ...summary,
        };
      })
      .filter((row) => !status || row.status === status);

    return NextResponse.json({
      data: {
        rows,
        totals: rows.reduce(
          (totals, row) => ({
            challans: totals.challans + 1,
            total: totals.total + row.total,
            paidTotal: totals.paidTotal + row.paidTotal,
            balanceRemaining: totals.balanceRemaining + row.balanceRemaining,
          }),
          { challans: 0, total: 0, paidTotal: 0, balanceRemaining: 0 },
        ),
      },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: { message: error.message, code: error.code } },
        { status: error.status },
      );
    }
    console.error(error);
    return NextResponse.json(
      { error: { message: "An internal error occurred.", code: "INTERNAL_ERROR" } },
      { status: 500 },
    );
  }
}
