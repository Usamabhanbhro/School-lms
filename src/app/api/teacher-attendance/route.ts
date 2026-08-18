import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole } from "@/lib/rbac";

/**
 * GET /api/teacher-attendance
 * Admin only. Fetch teacher attendance records, optionally filterable.
 *
 * Query params (all optional):
 *   - teacherId: filter to a specific teacher
 *   - from / to: date range (ISO date strings, inclusive)
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    requireRole(session, ["ADMIN"]);

    const { searchParams } = new URL(request.url);
    const teacherId = searchParams.get("teacherId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

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

    return NextResponse.json({ data: records });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/teacher-attendance
 * Admin only. Upsert teacher attendance for a teacher+date.
 * No draft/lock — Admin has direct edit access at all times.
 *
 * Body: { teacherId, date, status }
 */
const upsertTeacherAttendanceSchema = z.object({
  teacherId: z.string().min(1),
  date: z.string().min(1), // ISO date string
  status: z.enum(["PRESENT", "ABSENT", "LEAVE"]),
});

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const authedSession = requireRole(session, ["ADMIN"]);

    const body = upsertTeacherAttendanceSchema.parse(await request.json());

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

    // Upsert: create or update for this teacher+date
    const record = await prisma.teacherAttendance.upsert({
      where: {
        teacherId_date: {
          teacherId: body.teacherId,
          date: new Date(body.date),
        },
      },
      update: {
        status: body.status,
        markedById: authedSession.user.id,
      },
      create: {
        teacherId: body.teacherId,
        date: new Date(body.date),
        status: body.status,
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
