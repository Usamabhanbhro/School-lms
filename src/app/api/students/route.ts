import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole } from "@/lib/rbac";
import { getScopedClassSectionIds } from "@/lib/teacher-scope";
import { cnicField } from "@/lib/validations";

/**
 * GET /api/students
 * Admin: all students. Teacher: only students in classes they're assigned to.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const authedSession = requireRole(session, ["ADMIN", "TEACHER", "ACADEMICS"]);

    const scopedIds = await getScopedClassSectionIds(authedSession);

    const where = scopedIds ? { classSectionId: { in: scopedIds } } : {};

    const students = await prisma.student.findMany({
      where,
      include: {
        classSection: {
          select: { id: true, className: true, sectionName: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ data: students });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/students — create a student and allot to a class/section. Admin only.
 */
const createStudentSchema = z.object({
  name: z.string().min(1).max(100),
  guardianName: z.string().min(1).max(100),
  guardianCnic: cnicField,
  dateOfBirth: z.string().min(1), // ISO date string, validated as Date by Prisma
  admissionDate: z.string().min(1),
  classSectionId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    requireRole(session, ["ADMIN"]);

    const body = createStudentSchema.parse(await request.json());

    // Verify class section exists
    const classSection = await prisma.classSection.findUnique({
      where: { id: body.classSectionId },
    });
    if (!classSection) {
      return NextResponse.json(
        { error: { message: "Class section not found.", code: "NOT_FOUND" } },
        { status: 404 },
      );
    }

    const student = await prisma.student.create({
      data: {
        name: body.name,
        guardianName: body.guardianName,
        guardianCnic: body.guardianCnic,
        dateOfBirth: new Date(body.dateOfBirth),
        admissionDate: new Date(body.admissionDate),
        classSectionId: body.classSectionId,
      },
      include: {
        classSection: {
          select: { id: true, className: true, sectionName: true },
        },
      },
    });

    return NextResponse.json({ data: student }, { status: 201 });
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
      { error: { message: "A student with that CNIC already exists.", code: "CONFLICT" } },
      { status: 409 },
    );
  }
  console.error(error);
  return NextResponse.json(
    { error: { message: "An internal error occurred.", code: "INTERNAL_ERROR" } },
    { status: 500 },
  );
}
