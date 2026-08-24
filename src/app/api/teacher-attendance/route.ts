import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole } from "@/lib/rbac";
import { getTodayLocal, isDateInFuture, isValidDateOnly } from "@/lib/timezone";

/**
 * GET /api/teacher-attendance
 * Admin + Academics. Fetch teacher attendance records, optionally filterable.
 *
 * Query params (all optional):
 *   - teacherId: filter to a specific teacher
 *   - from / to: date range (ISO date strings, inclusive)
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    requireRole(session, ["ADMIN", "ACADEMICS"]);

    const { searchParams } = new URL(request.url);
    const teacherId = searchParams.get("teacherId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const today = getTodayLocal();
    for (const [label, value] of [["from", from], ["to", to]] as const) {
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
    if (teacherId) where.teacherId = teacherId;
    if (from || to) {
      where.date = {};
      if (from) (where.date as Record<string, Date>).gte = new Date(from);
      if (to) (where.date as Record<string, Date>).lte = new Date(to);
    }

    const records = await prisma.teacherAttendance.findMany({
      where,
      include: {
        teacher: {
          select: { id: true, name: true, phone: true },
        },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });

    // Also fetch teacher schedule info for the UI
    const teacherIds = [...new Set(records.map((r) => r.teacherId))];
    const teacherProfiles = await prisma.teacherProfile.findMany({
      where: { id: { in: teacherIds } },
      select: { id: true, reportingTime: true, offTime: true, lateThreshold: true },
    });
    const profileMap = new Map(teacherProfiles.map((p) => [p.id, p]));

    // Attach schedule info to each record for the frontend
    const recordsWithSchedule = records.map((r) => ({
      ...r,
      teacher: {
        ...r.teacher,
        ...profileMap.get(r.teacherId),
      },
    }));

    return NextResponse.json({ data: recordsWithSchedule });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/teacher-attendance
 * Admin only. Upsert teacher attendance for a teacher+date.
 * No draft/lock — direct edit access at all times.
 * Admin + Academics (full parity — Academics has the same marking rights
 * as Admin here, per the SRS scope amendment).
 *
 * Body: { teacherId, date, status, actualReportingTime?, actualOffTime? }
 */
const upsertTeacherAttendanceSchema = z.object({
  teacherId: z.string().min(1),
  date: z.string().min(1), // ISO date string
  status: z.enum(["PRESENT", "ABSENT", "LEAVE"]),
  actualReportingTime: z.string().optional(), // HH:MM or HH:MM:SS — only for PRESENT/LATE
  actualOffTime: z.string().optional(), // HH:MM or HH:MM:SS — only for PRESENT/LATE
});

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const authedSession = requireRole(session, ["ADMIN", "ACADEMICS"]);

    const body = upsertTeacherAttendanceSchema.parse(await request.json());
    if (!isValidDateOnly(body.date)) {
      throw new ApiError(400, "VALIDATION_ERROR", "Date must use YYYY-MM-DD format.");
    }
    if (isDateInFuture(body.date)) {
      throw new ApiError(400, "DATE_IN_FUTURE", "Attendance date cannot be later than today.");
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

    // Auto-derive LATE: if status is PRESENT and actualReportingTime is provided,
    // compare against the teacher's configured lateThreshold. If the actual time
    // is after the threshold, store status as LATE instead of PRESENT.
    let finalStatus: "PRESENT" | "ABSENT" | "LEAVE" | "LATE" = body.status;
    let finalReportingTime: string | null = null;
    let finalOffTime: string | null = null;

    if (body.status === "PRESENT" || body.status === "LEAVE") {
      finalReportingTime = body.actualReportingTime || null;
      finalOffTime = body.actualOffTime || null;
    }

    if (body.status === "PRESENT" && body.actualReportingTime) {
      const teacherProfile = await prisma.teacherProfile.findUnique({
        where: { id: body.teacherId },
        select: { lateThreshold: true },
      });
      if (teacherProfile?.lateThreshold) {
        // Compare times as strings (HH:MM:SS format is lexicographically sortable)
        const actualTime = body.actualReportingTime.length === 5
          ? body.actualReportingTime + ":00"
          : body.actualReportingTime;
        const threshold = teacherProfile.lateThreshold;
        if (actualTime > threshold) {
          finalStatus = "LATE";
        }
      }
    }

    // Upsert: create or update for this teacher+date
    const record = await prisma.teacherAttendance.upsert({
      where: {
        teacherId_date: {
          teacherId: body.teacherId,
          date: new Date(body.date),
        },
      },
      update: {
        status: finalStatus,
        actualReportingTime: finalReportingTime,
        actualOffTime: finalOffTime,
        markedById: authedSession.user.id,
      },
      create: {
        teacherId: body.teacherId,
        date: new Date(body.date),
        status: finalStatus,
        actualReportingTime: finalReportingTime,
        actualOffTime: finalOffTime,
        markedById: authedSession.user.id,
      },
      include: {
        teacher: {
          select: { id: true, name: true, phone: true },
        },
      },
    });

    return NextResponse.json({ data: record }, { status: 201 });
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
