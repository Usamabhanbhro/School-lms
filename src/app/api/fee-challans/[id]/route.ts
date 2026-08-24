import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { deriveFeePaymentSummary } from "@/lib/fee-ledger";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole } from "@/lib/rbac";

/**
 * GET /api/fee-challans/:id
 *
 * Admin: allowed.
 * Academics: allowed.
 * Teacher: rejected (403).
 *
 * Fetch a single FeeChallan by ID including its line items.
 * Returns the full snapshot + line items, ready for print rendering.
 * Returns 404 if the challan does not exist.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    requireRole(session, ["ADMIN", "ACADEMICS"]);

    const { id } = await params;

    const challan = await prisma.feeChallan.findUnique({
      where: { id },
      include: {
        lineItems: true,
        student: {
          select: { id: true, name: true },
        },
        generatedByUser: {
          select: { id: true, name: true },
        },
        payments: {
          orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            amount: true,
            paidAt: true,
            note: true,
            recordedByUser: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!challan) {
      return NextResponse.json(
        { error: { message: "Fee challan not found.", code: "NOT_FOUND" } },
        { status: 404 },
      );
    }

    const summary = deriveFeePaymentSummary(
      challan.total,
      challan.payments.reduce((sum, payment) => sum + payment.amount, 0),
    );

    return NextResponse.json({ data: { ...challan, ...summary } });
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
