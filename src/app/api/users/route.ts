import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole } from "@/lib/rbac";

const createUserSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-zA-Z0-9_.-]+$/, "Letters, numbers, dots, dashes, and underscores only."),
  email: z
    .union([z.email(), z.literal("")])
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
  name: z.string().min(1).max(100),
  password: z.string().min(8).max(100),
  role: z.enum(["ADMIN", "TEACHER", "STUDENT", "PARENT"]),
});

const userSelect = {
  id: true,
  username: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  createdAt: true,
} as const;

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    requireRole(session, ["ADMIN"]);

    const users = await prisma.user.findMany({
      select: userSelect,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ data: users });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    requireRole(session, ["ADMIN"]);

    const body = createUserSchema.parse(await request.json());
    const passwordHash = await bcrypt.hash(body.password, 12);

    const user = await prisma.user.create({
      data: {
        username: body.username,
        email: body.email,
        name: body.name,
        passwordHash,
        role: body.role,
      },
      select: userSelect,
    });
    return NextResponse.json({ data: user }, { status: 201 });
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
  // P2002 = unique constraint violation (username / email already taken)
  if ((error as { code?: string }).code === "P2002") {
    return NextResponse.json(
      { error: { message: "A user with that username or email already exists.", code: "CONFLICT" } },
      { status: 409 },
    );
  }
  console.error(error);
  return NextResponse.json(
    { error: { message: "An internal error occurred.", code: "INTERNAL_ERROR" } },
    { status: 500 },
  );
}
