import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole } from "@/lib/rbac";
import { getTeacherProfile } from "@/lib/teacher-scope";
import { requireSubjectTeacher } from "@/lib/subject-teacher";

/**
 * POST /api/tests/:id/marks
 *
 * Teacher ONLY. Must hold a SubjectTeacherAssignment for the Test's
 * classSectionId + subjectId.
 *
 * Body: { records: [{ studentId, marksObtained }] }
 *
 * Rules:
 *   - Upserts Mark records in a transaction
 *   - Server-side validation: marksObtained must not exceed the Test's maxMarks
 *   - Returns 400 if any record exceeds maxMarks
 */

const markRecordSchema = z.object({
  studentId: z.string().min(1),
  marksObtained: z.number().int().min(0),
});

const submitMarksSchema = z.object({
  records: z.array(markRecordSchema).min(1),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const authedSession = requireRole(session, ["TEACHER"]);

    const profile = await getTeacherProfile(authedSession.user.id);
    const { id: testId } = await params;

    // Fetch the test to verify ownership and get maxMarks
    const test = await prisma.test.findUnique({
      where: { id: testId },
      select: {
        id: true,
        classSectionId: true,
        subjectId: true,
        maxMarks: true,
      },
    });

    if (!test) {
      return NextResponse.json(
        { error: { message: "Test not found.", code: "NOT_FOUND" } },
        { status: 404 },
      );
    }

    // Verify this teacher holds the SubjectTeacherAssignment for this test's class+subject
    await requireSubjectTeacher(profile.id, test.classSectionId, test.subjectId);

    const body = submitMarksSchema.parse(await request.json());

    // Validate all marksObtained values against maxMarks
    const invalidRecords = body.records.filter(
      (r) => r.marksObtained > test.maxMarks,
    );

    if (invalidRecords.length > 0) {
      return NextResponse.json(
        {
          error: {
            message: `Marks obtained exceeds maximum marks (${test.maxMarks}) for ${invalidRecords.length} record(s).`,
            code: "MARKS_EXCEED_MAX",
          },
        },
        { status: 400 },
      );
    }

    // Verify all students are active and belong to the test's class section
    const studentIds = body.records.map((r) => r.studentId);
    const validStudents = await prisma.student.findMany({
      where: {
        id: { in: studentIds },
        classSectionId: test.classSectionId,
        isActive: true,
      },
      select: { id: true },
    });

    const validStudentIds = new Set(validStudents.map((s) => s.id));
    const invalidStudents = studentIds.filter((id) => !validStudentIds.has(id));

    if (invalidStudents.length > 0) {
      return NextResponse.json(
        {
          error: {
            message: `${invalidStudents.length} student(s) do not belong to this class section.`,
            code: "INVALID_STUDENTS",
          },
        },
        { status: 400 },
      );
    }

    // Upsert all marks in a transaction
    const results = await prisma.$transaction(
      body.records.map((record) =>
        prisma.mark.upsert({
          where: {
            testId_studentId: {
              testId,
              studentId: record.studentId,
            },
          },
          update: {
            marksObtained: record.marksObtained,
          },
          create: {
            testId,
            studentId: record.studentId,
            marksObtained: record.marksObtained,
          },
        }),
      ),
    );

    return NextResponse.json({ data: results }, { status: 201 });
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
