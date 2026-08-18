import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole } from "@/lib/rbac";

/**
 * GET /api/settings/bank
 *
 * Admin: allowed.
 * Academics: allowed (read-only, for challan generation).
 * Teacher: rejected (403).
 *
 * Returns the singleton BankSettings record, or 404 if none exists yet.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    requireRole(session, ["ADMIN", "ACADEMICS"]);

    const settings = await prisma.bankSettings.findFirst();

    if (!settings) {
      return NextResponse.json(
        { error: { message: "Bank settings not configured.", code: "NOT_FOUND" } },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: settings });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * PATCH /api/settings/bank
 *
 * Admin ONLY. Academics receive 403.
 *
 * Payload: { bankName, bankAccountNumber }
 *
 * Upserts the singleton BankSettings record. If no record exists, creates one.
 * If a record exists, updates it. Never creates duplicates.
 */
const updateBankSettingsSchema = z.object({
  bankName: z.string().min(1).max(200),
  bankAccountNumber: z.string().min(1).max(50),
});

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    requireRole(session, ["ADMIN"]);

    const body = updateBankSettingsSchema.parse(await request.json());

    // Find existing singleton row, or create if none exists
    const existing = await prisma.bankSettings.findFirst();

    let settings;
    if (existing) {
      settings = await prisma.bankSettings.update({
        where: { id: existing.id },
        data: {
          bankName: body.bankName,
          bankAccountNumber: body.bankAccountNumber,
        },
      });
    } else {
      settings = await prisma.bankSettings.create({
        data: {
          bankName: body.bankName,
          bankAccountNumber: body.bankAccountNumber,
        },
      });
    }

    return NextResponse.json({ data: settings });
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
