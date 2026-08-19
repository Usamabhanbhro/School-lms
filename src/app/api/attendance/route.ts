import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole } from "@/lib/rbac";
import { getTeacherProfile } from "@/lib/teacher-scope";
import { requireActiveClassTeacher } from "@/lib/class-teacher";

/**
 * GET /api/attendance
 *
 * Admin: all attendance records.
 * Academics: all attendance records (read-only oversight).
 * Teacher: only records for classes they are the active Class Teacher of.
 *
 * Query params (all optional):
 *   - classSectionId: filter to a specific class
 *   - date: filter to a specific date (ISO date string)
 *   - studentId: filter to a specific student
 *   - from / to: date range (inclusive)
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const authedSession = requireRole(session, ["ADMIN", "TEACHER", "ACADEMICS"]);

    const { searchParams } = new URL(request.url);
    const classSectionId = searchParams.get("classSectionId");
    const date = searchParams.get("date");
    const studentId = searchParams.get("studentId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const where: Record<string, unknown> = {};

    // Teacher scope: only their active class sections
    if (authedSession.user.role === "TEACHER") {
      const profile = await getTeacherProfile(authedSession.user.id);
      const activeAssignments = await prisma.classTeacherAssignment.findMany({
        where: { teacherId: profile.id, isActive: true },
        select: { classSectionId: true },
      });
      const allowedIds = activeAssignments.map((a) => a.classSectionId);

      if (allowedIds.length === 0) {
        return NextResponse.json({ data: [] });
      }

      // If filtering by classSectionId, verify it's in the allowed list
      if (classSectionId) {
        if (!allowedIds.includes(classSectionId)) {
          return NextResponse.json(
            { error: { message: "You are not the class teacher for this section.", code: "FORBIDDEN" } },
            { status: 403 },
          );
        }
        where.classSectionId = classSectionId;
      } else {
        where.classSectionId = { in: allowedIds };
      }
    } else {
      // Admin / Academics: no scope filter, but apply explicit filters
      if (classSectionId) where.classSectionId = classSectionId;
    }

    if (date) where.date = new Date(date);
    if (studentId) where.studentId = studentId;
    if (from || to) {
      if (!where.date) where.date = {};
      if (from) (where.date as Record<string, Date>).gte = new Date(from);
      if (to) (where.date as Record<string, Date>).lte = new Date(to);
    }

    const records = await prisma.studentAttendance.findMany({
      where,
      include: {
        student: {
          select: { id: true, name: true, guardianName: true },
        },
        classSection: {
          select: { id: true, className: true, sectionName: true },
        },
        markedByTeacher: {
          select: { id: true, name: true },
        },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ data: records });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/attendance
 *
 * Teacher ONLY (must be the active Class Teacher for the provided classSectionId).
 * Upserts draft attendance records for a class+date.
 *
 * Body: { classSectionId, date, records: [{ studentId, status }] }
 *
 * Rules:
 *   - Creates or updates records as isConfirmed: false (Draft)
 *   - If any record for this class+date is already isConfirmed: true,
 *     returns 403 — cannot overwrite locked records
 *   - Validates that all submitted studentIds belong to the specified classSectionId
 *   - Uses a transaction to ensure atomicity
 */
const attendanceRecordSchema = z.object({
  studentId: z.string().min(1),
  status: z.enum(["PRESENT", "ABSENT", "LEAVE"]),
});

const submitAttendanceSchema = z.object({
  classSectionId: z.string().min(1),
  date: z.string().min(1),
  records: z.array(attendanceRecordSchema).min(1),
});

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const authedSession = requireRole(session, ["TEACHER"]);

    // Resolve teacher profile
    const profile = await getTeacherProfile(authedSession.user.id);

    const body = submitAttendanceSchema.parse(await request.json());

    // Verify this teacher is the active Class Teacher for this section
    await requireActiveClassTeacher(profile.id, body.classSectionId);

    // Validate that all submitted student IDs actually belong to this class section
    const submittedStudentIds = body.records.map((r) => r.studentId);
    const validStudentCount = await prisma.student.count({
      where: {
        id: { in: submittedStudentIds },
        classSectionId: body.classSectionId,
      },
    });

    if (validStudentCount !== submittedStudentIds.length) {
      return NextResponse.json(
        {
          error: {
            message: "One or more students do not belong to the specified class section.",
            code: "INVALID_STUDENT_CLASS",
          },
        },
        { status: 400 },
      );
    }

    const date = new Date(body.date);

    // Check for any already-confirmed records for this class+date
    const lockedCount = await prisma.studentAttendance.count({
      where: {
        classSectionId: body.classSectionId,
        date,
        isConfirmed: true,
      },
    });

    if (lockedCount > 0) {
      return NextResponse.json(
        {
          error: {
            message: "Attendance for this class and date is already confirmed. Only Admin can edit locked records.",
            code: "ATTENDANCE_LOCKED",
          },
        },
        { status: 403 },
      );
    }

    // Upsert all records in a transaction
    const results = await prisma.$transaction(
      body.records.map((record) =>
        prisma.studentAttendance.upsert({
          where: {
            studentId_classSectionId_date: {
              studentId: record.studentId,
              classSectionId: body.classSectionId,
              date,
            },
          },
          update: {
            status: record.status,
            markedByTeacherId: profile.id,
            isConfirmed: false, // always draft on submit
          },
          create: {
            studentId: record.studentId,
            classSectionId: body.classSectionId,
            date,
            status: record.status,
            markedByTeacherId: profile.id,
            isConfirmed: false,
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
