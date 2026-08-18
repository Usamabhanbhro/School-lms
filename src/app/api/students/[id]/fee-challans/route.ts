import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole } from "@/lib/rbac";

/**
 * GET /api/students/:id/fee-challans
 *
 * Admin: allowed.
 * Academics: allowed.
 * Teacher: rejected (403).
 *
 * Returns all Fee Challans for the specified student, newest first.
 * Validates the student exists per normal API conventions.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    requireRole(session, ["ADMIN", "ACADEMICS"]);

    const { id } = await params;

    // Verify student exists
    const student = await prisma.student.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!student) {
      return NextResponse.json(
        { error: { message: "Student not found.", code: "NOT_FOUND" } },
        { status: 404 },
      );
    }

    const challans = await prisma.feeChallan.findMany({
      where: { studentId: id },
      include: {
        lineItems: true,
      },
      orderBy: { issuedDate: "desc" },
    });

    return NextResponse.json({ data: challans });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/students/:id/fee-challans
 *
 * Admin: allowed.
 * Academics: allowed.
 * Teacher: rejected (403).
 *
 * Payload: { lineItems: [{ description, amount }, ...] }
 *
 * Snapshot requirements:
 *   - Student name, guardian name, guardian CNIC
 *   - Class section as text ("Grade 5 - A")
 *   - Bank name and account number
 *   - generatedByUserId from session (never from client)
 *   - total computed server-side from line items
 *
 * If BankSettings does not exist, returns 400 with a clear setup message.
 * FeeChallan + line items are created in a single transaction.
 */
const lineItemSchema = z.object({
  description: z.string().min(1).max(200),
  amount: z.number().int().min(0),
});

const createChallanSchema = z.object({
  lineItems: z.array(lineItemSchema).min(1),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const authedSession = requireRole(session, ["ADMIN", "ACADEMICS"]);

    const { id } = await params;
    const body = createChallanSchema.parse(await request.json());

    // Fetch student with class section details for snapshot
    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        classSection: {
          select: { className: true, sectionName: true },
        },
      },
    });

    if (!student) {
      return NextResponse.json(
        { error: { message: "Student not found.", code: "NOT_FOUND" } },
        { status: 404 },
      );
    }

    // Fetch current BankSettings for snapshot
    const bankSettings = await prisma.bankSettings.findFirst();

    if (!bankSettings) {
      return NextResponse.json(
        {
          error: {
            message: "Bank settings not configured. An administrator must set up bank details before generating fee challans.",
            code: "BANK_SETTINGS_MISSING",
          },
        },
        { status: 400 },
      );
    }

    // Compute total server-side from validated line items
    const total = body.lineItems.reduce((sum, item) => sum + item.amount, 0);

    // Create FeeChallan + FeeChallanLineItems in a single transaction
    const challan = await prisma.$transaction(async (tx) => {
      const created = await tx.feeChallan.create({
        data: {
          studentId: id,
          // Snapshot student details
          studentNameSnapshot: student.name,
          guardianNameSnapshot: student.guardianName,
          guardianCnicSnapshot: student.guardianCnic,
          classSectionSnapshot: `${student.classSection.className} - ${student.classSection.sectionName}`,
          // Snapshot bank details
          bankNameSnapshot: bankSettings.bankName,
          bankAccountNumberSnapshot: bankSettings.bankAccountNumber,
          // Creator from session
          generatedByUserId: authedSession.user.id,
          // Computed total
          total,
        },
      });

      // Create line items
      await tx.feeChallanLineItem.createMany({
        data: body.lineItems.map((item) => ({
          feeChallanId: created.id,
          description: item.description,
          amount: item.amount,
        })),
      });

      // Return with line items included
      return tx.feeChallan.findUnique({
        where: { id: created.id },
        include: { lineItems: true },
      });
    });

    return NextResponse.json({ data: challan }, { status: 201 });
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
