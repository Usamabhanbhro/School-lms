import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole } from "@/lib/rbac";

/**
 * GET /api/subjects — list all subjects. Admin + Teacher (read).
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    requireRole(session, ["ADMIN", "TEACHER"]);

    const subjects = await prisma.subject.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { subjectTeacherAssignments: true } },
      },
    });

    return NextResponse.json({ data: subjects });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/subjects — create a subject. Admin only.
 */
const createSubjectSchema = z.object({
  name: z.string().min(1).max(100),
});

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    requireRole(session, ["ADMIN"]);

    const body = createSubjectSchema.parse(await request.json());

    const subject = await prisma.subject.create({
      data: { name: body.name },
    });

    return NextResponse.json({ data: subject }, { status: 201 });
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
      { error: { message: "A subject with that name already exists.", code: "CONFLICT" } },
      { status: 409 },
    );
  }
  console.error(error);
  return NextResponse.json(
    { error: { message: "An internal error occurred.", code: "INTERNAL_ERROR" } },
    { status: 500 },
  );
}
