import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole } from "@/lib/rbac";
import { getTeacherProfile, getScopedClassSectionIds } from "@/lib/teacher-scope";
import { requireActiveClassTeacher } from "@/lib/class-teacher";

/**
 * GET /api/report-cards
 *
 * Admin: all report cards (global oversight).
 * Academics: all report cards (read-only).
 * Teacher: only report cards for students in their assigned classes.
 *
 * Query params (all optional):
 *   - classSectionId: filter to a specific class
 *   - studentId: filter to a specific student
 *   - termId: filter to a specific term
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const authedSession = requireRole(session, ["ADMIN", "TEACHER", "ACADEMICS"]);

    const { searchParams } = new URL(request.url);
    const classSectionId = searchParams.get("classSectionId");
    const studentId = searchParams.get("studentId");
    const termId = searchParams.get("termId");

    const where: Record<string, unknown> = {};

    // Teacher scope: only their assigned class sections
    const scopedIds = await getScopedClassSectionIds(authedSession);

    if (scopedIds) {
      // Teacher sees only report cards in their assigned classes
      if (classSectionId) {
        if (!scopedIds.includes(classSectionId)) {
          return NextResponse.json(
            { error: { message: "You are not assigned to this class section.", code: "FORBIDDEN" } },
            { status: 403 },
          );
        }
        where.classSectionId = classSectionId;
      } else {
        where.classSectionId = { in: scopedIds };
      }
    } else if (classSectionId) {
      where.classSectionId = classSectionId;
    }

    if (studentId) where.studentId = studentId;
    if (termId) where.termId = termId;

    const reportCards = await prisma.reportCard.findMany({
      where,
      include: {
        student: {
          select: { id: true, name: true, guardianName: true, studentId: true },
        },
        classSection: {
          select: { id: true, className: true, sectionName: true },
        },
        term: {
          select: { id: true, name: true },
        },
        generatedByTeacher: {
          select: { id: true, name: true },
        },
        reportCardTests: {
          include: {
            test: {
              select: {
                id: true,
                title: true,
                date: true,
                maxMarks: true,
                subject: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: reportCards });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/report-cards
 *
 * Teacher ONLY. Must be the active Class Teacher for the target ClassSection.
 * Generates an aggregate ReportCard linking selected tests from any subject
 * within that class section.
 *
 * Body: { studentId, classSectionId, termId, testIds: [...] }
 *
 * Authorization:
 *   - Requires active ClassTeacherAssignment for the specified classSectionId.
 *   - Tests can come from any subject within that class section.
 *   - A Subject Teacher who is NOT the active Class Teacher is rejected.
 *
 * Rules:
 *   - All testIds must belong to the specified classSectionId
 *   - Student must belong to the specified classSectionId
 *   - Wrapped in a transaction: creates ReportCard + ReportCardTest links
 */
const createReportCardSchema = z.object({
  studentId: z.string().min(1),
  classSectionId: z.string().min(1),
  termId: z.string().min(1),
  testIds: z.array(z.string().min(1)).min(1),
});

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const authedSession = requireRole(session, ["TEACHER"]);

    const profile = await getTeacherProfile(authedSession.user.id);
    const body = createReportCardSchema.parse(await request.json());

    // Require active Class Teacher for this class section.
    // This is the authoritative authorization: not Subject Teacher, not any assignment.
    await requireActiveClassTeacher(profile.id, body.classSectionId);

    // Verify student exists and belongs to the class section
    const student = await prisma.student.findFirst({
      where: {
        id: body.studentId,
        classSectionId: body.classSectionId,
      },
      select: { id: true },
    });

    if (!student) {
      return NextResponse.json(
        { error: { message: "Student not found in this class section.", code: "NOT_FOUND" } },
        { status: 404 },
      );
    }

    // Verify term exists
    const term = await prisma.term.findUnique({
      where: { id: body.termId },
      select: { id: true },
    });

    if (!term) {
      return NextResponse.json(
        { error: { message: "Term not found.", code: "NOT_FOUND" } },
        { status: 404 },
      );
    }

    // Fetch all tests and verify they all belong to the specified class section.
    // Tests from any subject within this class section are allowed.
    const tests = await prisma.test.findMany({
      where: {
        id: { in: body.testIds },
        classSectionId: body.classSectionId,
      },
      include: {
        subject: { select: { id: true, name: true } },
      },
    });

    if (tests.length !== body.testIds.length) {
      return NextResponse.json(
        {
          error: {
            message: "One or more test IDs are invalid or do not belong to this class section.",
            code: "INVALID_TESTS",
          },
        },
        { status: 400 },
      );
    }

    // Create ReportCard + ReportCardTest links in a transaction
    const reportCard = await prisma.$transaction(async (tx) => {
      const rc = await tx.reportCard.create({
        data: {
          studentId: body.studentId,
          classSectionId: body.classSectionId,
          termId: body.termId,
          generatedByTeacherId: authedSession.user.id,
        },
      });

      await tx.reportCardTest.createMany({
        data: body.testIds.map((testId) => ({
          reportCardId: rc.id,
          testId,
        })),
      });

      return tx.reportCard.findUnique({
        where: { id: rc.id },
        include: {
          student: {
            select: { id: true, name: true },
          },
          classSection: {
            select: { id: true, className: true, sectionName: true },
          },
          term: {
            select: { id: true, name: true },
          },
          reportCardTests: {
            include: {
              test: {
                select: {
                  id: true,
                  title: true,
                  date: true,
                  maxMarks: true,
                  subject: { select: { name: true } },
                },
              },
            },
          },
        },
      });
    });

    return NextResponse.json({ data: reportCard }, { status: 201 });
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
