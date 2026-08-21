import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole } from "@/lib/rbac";
import { cnicField, phoneField } from "@/lib/validations";

/**
 * GET /api/academics — list all academics accounts (Admin only).
 */
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

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    requireRole(session, ["ADMIN"]);

    const academics = await prisma.academicsProfile.findMany({
      select: academicsSelect,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ data: academics });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/academics — create an academics account (Admin only).
 * Creates both a User (auth identity) and an AcademicsProfile.
 */
const createAcademicsSchema = z.object({
  name: z.string().min(1).max(100),
  cnic: cnicField,
  phone: phoneField,
  email: z
    .union([z.email(), z.literal("")])
    .optional()
    .transform((value) =>
      value === "" || value === undefined ? undefined : value.trim().toLowerCase(),
    ),
  password: z.string().min(8).max(100),
});

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    requireRole(session, ["ADMIN"]);

    const body = createAcademicsSchema.parse(await request.json());
    const passwordHash = await bcrypt.hash(body.password, 12);

    const result = await prisma.$transaction(async (tx) => {
      // Usernames derived from the email prefix are lowercased too so login
      // (case-insensitive) and storage stay consistent.
      const username =
        body.email?.split("@")[0].toLowerCase() ?? body.cnic.replace(/-/g, "");
      const user = await tx.user.create({
        data: {
          username,
          email: body.email,
          name: body.name,
          passwordHash,
          role: "ACADEMICS",
        },
      });

      const profile = await tx.academicsProfile.create({
        data: {
          name: body.name,
          cnic: body.cnic,
          phone: body.phone,
          email: body.email,
          userId: user.id,
        },
        select: academicsSelect,
      });

      return profile;
    });

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
  console.error(error);
  return NextResponse.json(
    { error: { message: "An internal error occurred.", code: "INTERNAL_ERROR" } },
    { status: 500 },
  );
}
