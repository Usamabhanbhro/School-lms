import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { authOptions } from "@/lib/auth";
import { deriveFeePaymentSummary } from "@/lib/fee-ledger";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole } from "@/lib/rbac";
import { getTodayLocal, isValidDateOnly } from "@/lib/timezone";

const paymentSchema = z.object({
  amount: z.number().int().positive(),
  paidAt: z.string().refine((value) => !Number.isNaN(Date.parse(value)), "Invalid payment date"),
  note: z.string().trim().max(500).optional(),
});

function parsePaymentDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00.000Z`)
    : new Date(value);
}

function serializePayment(payment: {
  id: string;
  amount: number;
  paidAt: Date;
  note: string | null;
  recordedByUser: { id: string; name: string };
}) {
  return {
    id: payment.id,
    amount: payment.amount,
    paidAt: payment.paidAt,
    note: payment.note,
    recordedByUser: payment.recordedByUser,
  };
}

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
      select: {
        id: true,
        total: true,
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

    return NextResponse.json({
      data: {
        payments: challan.payments.map(serializePayment),
        ...summary,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const authedSession = requireRole(session, ["ADMIN", "ACADEMICS"]);
    const { id } = await params;
    const body = paymentSchema.parse(await request.json());
    const paidAtDateOnly = body.paidAt.slice(0, 10);
    if (!isValidDateOnly(paidAtDateOnly)) {
      throw new ApiError(400, "VALIDATION_ERROR", "Payment date must use a valid ISO date.");
    }
    if (paidAtDateOnly > getTodayLocal()) {
      throw new ApiError(400, "DATE_IN_FUTURE", "Payment date cannot be later than today.");
    }
    const paidAt = parsePaymentDate(body.paidAt);

    const result = await prisma.$transaction(async (tx) => {
      const challan = await tx.feeChallan.findUnique({
        where: { id },
        select: {
          id: true,
          total: true,
          payments: { select: { amount: true } },
        },
      });

      if (!challan) {
        throw new ApiError(404, "NOT_FOUND", "Fee challan not found.");
      }

      const paidTotal = challan.payments.reduce((sum, payment) => sum + payment.amount, 0);
      const balanceRemaining = challan.total - paidTotal;
      if (body.amount > balanceRemaining) {
        throw new ApiError(
          400,
          "PAYMENT_EXCEEDS_BALANCE",
          `Payment exceeds the remaining balance of Rs. ${Math.max(0, balanceRemaining).toLocaleString()}.`,
        );
      }

      const payment = await tx.feeChallanPayment.create({
        data: {
          feeChallanId: id,
          amount: body.amount,
          paidAt,
          recordedByUserId: authedSession.user.id,
          note: body.note?.trim() || null,
        },
        select: {
          id: true,
          amount: true,
          paidAt: true,
          note: true,
          recordedByUser: { select: { id: true, name: true } },
        },
      });

      const summary = deriveFeePaymentSummary(challan.total, paidTotal + payment.amount);
      return { payment, ...summary };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json({ data: result }, { status: 201 });
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
      { error: { message: "Invalid payment. Enter a positive amount and valid date.", code: "VALIDATION_ERROR" } },
      { status: 400 },
    );
  }
  console.error(error);
  return NextResponse.json(
    { error: { message: "An internal error occurred.", code: "INTERNAL_ERROR" } },
    { status: 500 },
  );
}
