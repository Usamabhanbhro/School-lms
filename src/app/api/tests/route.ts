import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole } from "@/lib/rbac";
import { getTeacherProfile, getScopedClassSectionIds } from "@/lib/teacher-scope";
import { requireSubjectTeacher } from "@/lib/subject-teacher";

/**
 * GET /api/tests
 *
 * Admin/Academics: all tests (global read access).
 * Teacher: only tests for their assigned class+subject combinations.
 *
 * Query params (optional):
 *   - classSectionId: filter to a specific class
 *   - subjectId: filter to a specific subject
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const authedSession = requireRole(session, ["ADMIN", "TEACHER", "ACADEMICS"]);

    const { searchParams } = new URL(request.url);
    const classSectionId = searchParams.get("classSectionId");
    const subjectId = searchParams.get("subjectId");

    const where: Record<string, unknown> = {};

    if (classSectionId) where.classSectionId = classSectionId;
    if (subjectId) where.subjectId = subjectId;

    // Teacher scope: only their assigned class+subject combinations
    if (authedSession.user.role === "TEACHER") {
      const profile = await getTeacherProfile(authedSession.user.id);
      const scopedIds = await getScopedClassSectionIds(authedSession);

      if (!scopedIds || scopedIds.length === 0) {
        return NextResponse.json({ data: [] });
      }

      where.classSectionId = classSectionId && scopedIds.includes(classSectionId)
        ? classSectionId
        : { in: scopedIds };

      // Also scope to subjects the teacher is assigned to
      const subjectAssignments = await prisma.subjectTeacherAssignment.findMany({
        where: { teacherId: profile.id },
        select: { subjectId: true },
      });
      const assignedSubjectIds = subjectAssignments.map((a) => a.subjectId);

      if (assignedSubjectIds.length === 0) {
        return NextResponse.json({ data: [] });
      }

      if (subjectId) {
        if (!assignedSubjectIds.includes(subjectId)) {
          return NextResponse.json(
            { error: { message: "You are not assigned to this subject.", code: "FORBIDDEN" } },
            { status: 403 },
          );
        }
        where.subjectId = subjectId;
      } else {
        where.subjectId = { in: assignedSubjectIds };
      }
    }

    const tests = await prisma.test.findMany({
      where,
      include: {
        classSection: {
          select: { id: true, className: true, sectionName: true },
        },
        subject: {
          select: { id: true, name: true },
        },
        teacher: {
          select: { id: true, name: true },
        },
        _count: { select: { marks: true } },
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json({ data: tests });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/tests
 *
 * Teacher ONLY. Must hold a SubjectTeacherAssignment for the given
 * classSectionId + subjectId.
 *
 * Body: { classSectionId, subjectId, title, date, maxMarks }
 */
const createTestSchema = z.object({
  classSectionId: z.string().min(1),
  subjectId: z.string().min(1),
  title: z.string().min(1).max(200),
  date: z.string().min(1),
  maxMarks: z.number().int().positive(),
});

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const authedSession = requireRole(session, ["TEACHER"]);

    const profile = await getTeacherProfile(authedSession.user.id);
    const body = createTestSchema.parse(await request.json());

    // Verify this teacher holds the SubjectTeacherAssignment
    const assignment = await requireSubjectTeacher(
      profile.id,
      body.classSectionId,
      body.subjectId,
    );

    const test = await prisma.test.create({
      data: {
        classSectionId: body.classSectionId,
        subjectId: body.subjectId,
        teacherId: authedSession.user.id,
        subjectTeacherAssignmentId: assignment.id,
        title: body.title,
        date: new Date(body.date),
        maxMarks: body.maxMarks,
      },
      include: {
        classSection: {
          select: { id: true, className: true, sectionName: true },
        },
        subject: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({ data: test }, { status: 201 });
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
