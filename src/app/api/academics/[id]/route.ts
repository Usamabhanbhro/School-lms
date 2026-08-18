import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole } from "@/lib/rbac";
import { cnicField, phoneField } from "@/lib/validations";

/**
 * PATCH /api/academics/:id — edit academics fields, or set isActive: false to revoke.
 * Admin only.
 */
const editAcademicsSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  cnic: cnicField.optional(),
  phone: phoneField.optional(),
  email: z
    .union([z.email(), z.literal("")])
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
  isActive: z.boolean().optional(),
});

const academicsSelect = {
  id: true,
  name: true,
  cnic: true,
  phone: true,
  email: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      username: true,
      email: true,
      isActive: true,
      role: true,
    },
  },
} as const;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    requireRole(session, ["ADMIN"]);

    const { id } = await params;
    const body = editAcademicsSchema.parse(await request.json());

    const existing = await prisma.academicsProfile.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: { message: "Academics account not found.", code: "NOT_FOUND" } },
        { status: 404 },
      );
    }

    const profileData: Record<string, unknown> = {};
    if (body.name !== undefined) profileData.name = body.name;
    if (body.cnic !== undefined) profileData.cnic = body.cnic;
    if (body.phone !== undefined) profileData.phone = body.phone;
    if (body.email !== undefined) profileData.email = body.email;

    const userData: Record<string, unknown> = {};
    if (body.name !== undefined) userData.name = body.name;
    if (body.email !== undefined) userData.email = body.email;
    if (body.isActive !== undefined) userData.isActive = body.isActive;

    const result = await prisma.$transaction(async (tx) => {
      if (Object.keys(profileData).length > 0) {
        await tx.academicsProfile.update({ where: { id }, data: profileData });
      }
      if (Object.keys(userData).length > 0) {
        await tx.user.update({ where: { id: existing.userId }, data: userData });
      }
      return tx.academicsProfile.findUnique({ where: { id }, select: academicsSelect });
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * DELETE /api/academics/:id — delete an academics record.
 * Admin only. Cascades to User via FK.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    requireRole(session, ["ADMIN"]);

    const { id } = await params;

    const existing = await prisma.academicsProfile.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: { message: "Academics account not found.", code: "NOT_FOUND" } },
        { status: 404 },
      );
    }

    await prisma.user.delete({ where: { id: existing.userId } });

    return NextResponse.json({ data: { id } });
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
  if ((error as { code?: string }).code === "P2002") {
    return NextResponse.json(
      { error: { message: "An account with that username, email, or CNIC already exists.", code: "CONFLICT" } },
      { status: 409 },
    );
  }
  if ((error as { code?: string }).code === "P2025") {
    return NextResponse.json(
      { error: { message: "Academics account not found.", code: "NOT_FOUND" } },
      { status: 404 },
    );
  }
  console.error(error);
  return NextResponse.json(
    { error: { message: "An internal error occurred.", code: "INTERNAL_ERROR" } },
    { status: 500 },
  );
}
