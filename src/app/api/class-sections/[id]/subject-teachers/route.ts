import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole } from "@/lib/rbac";

/**
 * POST /api/class-sections/:id/subject-teachers
 * Assign a Subject Teacher to a ClassSection+Subject.
 * Admin only. A teacher can hold many assignments across different classes/subjects.
 */
const assignSubjectTeacherSchema = z.object({
  teacherId: z.string().min(1),
  subjectId: z.string().min(1),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    requireRole(session, ["ADMIN"]);

    const { id: classSectionId } = await params;
    const body = assignSubjectTeacherSchema.parse(await request.json());

    // Verify class section exists
    const classSection = await prisma.classSection.findUnique({
      where: { id: classSectionId },
    });
    if (!classSection) {
      return NextResponse.json(
        { error: { message: "Class section not found.", code: "NOT_FOUND" } },
        { status: 404 },
      );
    }

    // Verify teacher exists
    const teacher = await prisma.teacherProfile.findUnique({
      where: { id: body.teacherId },
    });
    if (!teacher) {
      return NextResponse.json(
        { error: { message: "Teacher not found.", code: "NOT_FOUND" } },
        { status: 404 },
      );
    }

    // Verify subject exists
    const subject = await prisma.subject.findUnique({
      where: { id: body.subjectId },
    });
    if (!subject) {
      return NextResponse.json(
        { error: { message: "Subject not found.", code: "NOT_FOUND" } },
        { status: 404 },
      );
    }

    const assignment = await prisma.subjectTeacherAssignment.create({
      data: {
        classSectionId,
        subjectId: body.subjectId,
        teacherId: body.teacherId,
      },
      include: {
        teacher: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
        classSection: { select: { id: true, className: true, sectionName: true } },
      },
    });

    return NextResponse.json({ data: assignment }, { status: 201 });
  } catch (error) {
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
        { error: { message: "This teacher is already assigned to this class+subject.", code: "CONFLICT" } },
        { status: 409 },
      );
    }
    console.error(error);
    return NextResponse.json(
      { error: { message: "An internal error occurred.", code: "INTERNAL_ERROR" } },
      { status: 500 },
    );
  }
}
