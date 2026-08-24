import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole } from "@/lib/rbac";
import { isDateInFuture, isValidDateOnly } from "@/lib/timezone";

/**
 * GET /api/attendance/audit
 *
 * Admin ONLY. View attendance audit history.
 *
 * Query params (all optional):
 *   - classSectionId: filter to a specific class
 *   - date: filter to a specific date
 *   - studentId: filter to a specific student
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    requireRole(session, ["ADMIN"]);

    const { searchParams } = new URL(request.url);
    const classSectionId = searchParams.get("classSectionId");
    const date = searchParams.get("date");
    const studentId = searchParams.get("studentId");

    const where: Record<string, unknown> = {};

    if (classSectionId) {
      where.studentAttendance = { classSectionId };
    }
    if (date) {
      if (!isValidDateOnly(date)) {
        throw new ApiError(400, "VALIDATION_ERROR", "date must use YYYY-MM-DD format.");
      }
      if (isDateInFuture(date)) {
        throw new ApiError(400, "DATE_IN_FUTURE", "date cannot be later than today.");
      }
      if (!where.studentAttendance) where.studentAttendance = {};
      (where.studentAttendance as Record<string, unknown>).date = new Date(date);
    }
    if (studentId) {
      if (!where.studentAttendance) where.studentAttendance = {};
      (where.studentAttendance as Record<string, unknown>).studentId = studentId;
    }

    const auditLogs = await prisma.attendanceAuditLog.findMany({
      where,
      include: {
        studentAttendance: {
          include: {
            student: { select: { id: true, name: true } },
            classSection: { select: { id: true, className: true, sectionName: true } },
          },
        },
        editedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json({ data: auditLogs });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: { message: error.message, code: error.code } },
        { status: error.status },
      );
    }
    console.error(error);
    return NextResponse.json(
      { error: { message: "An internal error occurred.", code: "INTERNAL_ERROR" } },
      { status: 500 },
    );
  }
}
