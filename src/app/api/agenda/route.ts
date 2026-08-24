import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole } from "@/lib/rbac";
import { getTeacherProfile } from "@/lib/teacher-scope";
import { requireSubjectTeacher } from "@/lib/subject-teacher";
import { getTodayLocal, isDateInFuture, isDateLocked, isValidDateOnly } from "@/lib/timezone";

/**
 * GET /api/agenda
 *
 * Admin: all entries (read-only), filterable by teacher/class/subject/date range.
 * Teacher: own entries only, scoped to assigned class+subject combinations.
 * Academics: NO ACCESS (see SRS §1A.2).
 *
 * Query params (all optional):
 *   classSectionId, subjectId, date, from, to, teacherId (Admin only)
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const authedSession = requireRole(session, ["ADMIN", "TEACHER"]);

    const { searchParams } = new URL(request.url);
    const classSectionId = searchParams.get("classSectionId");
    const subjectId = searchParams.get("subjectId");
    const date = searchParams.get("date");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const teacherIdFilter = searchParams.get("teacherId");

    const today = getTodayLocal();
    for (const [label, value] of [["date", date], ["from", from], ["to", to]] as const) {
      if (!value) continue;
      if (!isValidDateOnly(value)) {
        throw new ApiError(400, "VALIDATION_ERROR", `${label} must use YYYY-MM-DD format.`);
      }
      if (value > today) {
        throw new ApiError(400, "DATE_IN_FUTURE", `${label} cannot be later than today.`);
      }
    }
    if (from && to && from > to) {
      throw new ApiError(400, "INVALID_DATE_RANGE", "The from date cannot be after the to date.");
    }

    const where: Record<string, unknown> = {};

    if (classSectionId) where.classSectionId = classSectionId;
    if (subjectId) where.subjectId = subjectId;

    // Date filtering
    if (date) {
      where.date = new Date(date);
    } else if (from || to) {
      const dateFilter: Record<string, Date> = {};
      if (from) dateFilter.gte = new Date(from);
      if (to) dateFilter.lte = new Date(to);
      where.date = dateFilter;
    }

    if (authedSession.user.role === "TEACHER") {
      // Teacher: only own entries, scoped to assigned classes/subjects
      const profile = await getTeacherProfile(authedSession.user.id);

      // Get the teacher's subject teacher assignments to determine scope
      const subjectAssignments = await prisma.subjectTeacherAssignment.findMany({
        where: { teacherId: profile.id },
        select: { classSectionId: true, subjectId: true },
      });

      if (subjectAssignments.length === 0) {
        return NextResponse.json({ data: [] });
      }

      // Scope: only entries where the teacher has an assignment
      const scopedPairs = subjectAssignments.map((a) => ({
        teacherId: profile.id,
        classSectionId: a.classSectionId,
        subjectId: a.subjectId,
      }));

      // Build an OR filter for the scoped pairs
      where.OR = scopedPairs;

      // If specific classSectionId or subjectId was requested, verify the teacher has that assignment
      if (classSectionId) {
        const hasAssignment = subjectAssignments.some(
          (a) => a.classSectionId === classSectionId,
        );
        if (!hasAssignment) {
          return NextResponse.json({ data: [] });
        }
      }
      if (subjectId) {
        const hasAssignment = subjectAssignments.some(
          (a) => a.subjectId === subjectId,
        );
        if (!hasAssignment) {
          return NextResponse.json({ data: [] });
        }
      }
    } else {
      // Admin: can filter by teacherId
      if (teacherIdFilter) {
        // Verify teacher exists
        const teacherProfile = await prisma.teacherProfile.findUnique({
          where: { id: teacherIdFilter },
        });
        if (!teacherProfile) {
          return NextResponse.json(
            { error: { message: "Teacher not found.", code: "NOT_FOUND" } },
            { status: 404 },
          );
        }
        where.teacherId = teacherIdFilter;
      }
    }

    const entries = await prisma.dailyAgenda.findMany({
      where,
      include: {
        teacher: {
          select: { id: true, name: true },
        },
        classSection: {
          select: { id: true, className: true, sectionName: true },
        },
        subject: {
          select: { id: true, name: true },
        },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });

    // Add computed isLocked field
    const entriesWithLock = entries.map((entry) => ({
      ...entry,
      date: entry.date.toISOString().split("T")[0],
      isLocked: isDateLocked(entry.date.toISOString().split("T")[0]),
    }));

    return NextResponse.json({ data: entriesWithLock });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/agenda
 *
 * Teacher ONLY. Must hold a SubjectTeacherAssignment for the given
 * classSectionId + subjectId.
 *
 * Creates or updates (upserts) an agenda entry for today only.
 * Server rejects both future dates and past (locked) dates.
 *
 * Body: { classSectionId, subjectId, date, content }
 */
const createAgendaSchema = z.object({
  classSectionId: z.string().min(1),
  subjectId: z.string().min(1),
  date: z.string().min(1),
  content: z.string().min(1).max(5000),
});

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const authedSession = requireRole(session, ["TEACHER"]);

    const profile = await getTeacherProfile(authedSession.user.id);
    const body = createAgendaSchema.parse(await request.json());

    // Verify this teacher holds the SubjectTeacherAssignment
    await requireSubjectTeacher(profile.id, body.classSectionId, body.subjectId);

    if (!isValidDateOnly(body.date)) {
      throw new ApiError(400, "VALIDATION_ERROR", "Date must use YYYY-MM-DD format.");
    }
    if (isDateInFuture(body.date)) {
      throw new ApiError(400, "DATE_IN_FUTURE", "Cannot create an entry for a future date.");
    }
    if (isDateLocked(body.date)) {
      throw new ApiError(400, "DATE_LOCKED", "Cannot create an entry for a date that has already passed.");
    }

    // Upsert by unique constraint: (teacherId, classSectionId, subjectId, date)
    const entry = await prisma.dailyAgenda.upsert({
      where: {
        teacherId_classSectionId_subjectId_date: {
          teacherId: profile.id,
          classSectionId: body.classSectionId,
          subjectId: body.subjectId,
          date: new Date(body.date),
        },
      },
      update: {
        content: body.content,
      },
      create: {
        teacherId: profile.id,
        classSectionId: body.classSectionId,
        subjectId: body.subjectId,
        date: new Date(body.date),
        content: body.content,
      },
      include: {
        teacher: {
          select: { id: true, name: true },
        },
        classSection: {
          select: { id: true, className: true, sectionName: true },
        },
        subject: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(
      {
        data: {
          ...entry,
          date: entry.date.toISOString().split("T")[0],
          isLocked: false,
        },
      },
      { status: 201 },
    );
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
