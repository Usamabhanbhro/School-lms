import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole } from "@/lib/rbac";
import { cnicField, phoneField } from "@/lib/validations";

/**
 * POST /api/teachers — create a teacher account (Admin only).
 * Creates both a User (auth identity) and a TeacherProfile (teacher-specific fields).
 * Preserves the established RBAC pattern: session → requireRole → Zod → Prisma → { data }/{ error }.
 */
const createTeacherSchema = z.object({
  name: z.string().min(1).max(100),
  fatherOrSpouseName: z.string().min(1).max(100),
  cnic: cnicField,
  phone: phoneField,
  email: z
    .union([z.email(), z.literal("")])
    .optional()
    .transform((value) =>
      value === "" || value === undefined ? undefined : value.trim().toLowerCase(),
    ),
  password: z.string().min(8).max(100),
  reportingTime: z.string().optional(),
  offTime: z.string().optional(),
  lateThreshold: z.string().optional(),
  perDaySalary: z.coerce.number().int().min(0).optional(),
  lateDeductionType: z.enum(["AMOUNT", "PERCENTAGE"]).optional(),
  lateDeductionValue: z.coerce.number().int().min(0).optional(),
});

const teacherSelect = {
  id: true,
  name: true,
  fatherOrSpouseName: true,
  cnic: true,
  phone: true,
  email: true,
  reportingTime: true,
  offTime: true,
  lateThreshold: true,
  perDaySalary: true,
  lateDeductionType: true,
  lateDeductionValue: true,
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

    const teachers = await prisma.teacherProfile.findMany({
      select: teacherSelect,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ data: teachers });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    requireRole(session, ["ADMIN"]);

    const body = createTeacherSchema.parse(await request.json());
    const passwordHash = await bcrypt.hash(body.password, 12);

    // Create User (auth identity) + TeacherProfile in a transaction
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
          role: "TEACHER",
        },
      });

      const profile = await tx.teacherProfile.create({
        data: {
          name: body.name,
          fatherOrSpouseName: body.fatherOrSpouseName,
          cnic: body.cnic,
          phone: body.phone,
          email: body.email,
          reportingTime: body.reportingTime || null,
          offTime: body.offTime || null,
          lateThreshold: body.lateThreshold || null,
          perDaySalary: body.perDaySalary ?? null,
          lateDeductionType: body.lateDeductionType ?? null,
          lateDeductionValue: body.lateDeductionValue ?? null,
          userId: user.id,
        },
        select: teacherSelect,
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
  // P2002 = unique constraint violation (username / email / cnic already taken)
  if ((error as { code?: string }).code === "P2002") {
    return NextResponse.json(
      { error: { message: "A teacher with that username, email, or CNIC already exists.", code: "CONFLICT" } },
      { status: 409 },
    );
  }
  console.error(error);
  return NextResponse.json(
    { error: { message: "An internal error occurred.", code: "INTERNAL_ERROR" } },
    { status: 500 },
  );
}
