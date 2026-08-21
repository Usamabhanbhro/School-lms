import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole } from "@/lib/rbac";
import { getScopedClassSectionIds } from "@/lib/teacher-scope";

/**
 * GET /api/class-sections
 * Admin: all class sections. Teacher: only sections they're assigned to.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const authedSession = requireRole(session, ["ADMIN", "TEACHER", "ACADEMICS"]);

    const scopedIds = await getScopedClassSectionIds(authedSession);

    const where = scopedIds ? { id: { in: scopedIds } } : {};

    const classSections = await prisma.classSection.findMany({
      where,
      include: {
        classTeacherAssignments: {
          where: { isActive: true },
          include: {
            teacher: {
              select: { id: true, name: true, phone: true },
            },
          },
        },
        subjectTeacherAssignments: {
          include: {
            teacher: { select: { id: true, name: true } },
            subject: { select: { id: true, name: true } },
          },
        },
        _count: { select: { students: true } },
      },
      orderBy: [{ className: "asc" }, { sectionName: "asc" }],
    });

    return NextResponse.json({ data: classSections });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/class-sections — create a class section. Admin only.
 */
const createClassSectionSchema = z.object({
  className: z.string().min(1).max(50),
  sectionName: z.string().min(1).max(20),
});

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    requireRole(session, ["ADMIN"]);

    const body = createClassSectionSchema.parse(await request.json());

    const classSection = await prisma.classSection.create({
      data: {
        className: body.className,
        sectionName: body.sectionName,
      },
    });

    return NextResponse.json({ data: classSection }, { status: 201 });
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
