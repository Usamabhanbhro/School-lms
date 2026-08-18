import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole } from "@/lib/rbac";
import { getTeacherProfile } from "@/lib/teacher-scope";

/**
 * GET /api/attendance/export
 *
 * Admin: any class, any date.
 * Academics: any class, any date (read-only oversight).
 * Teacher: only their assigned class (must be active Class Teacher).
 *
 * Query params (required):
 *   - classSectionId
 *   - date (ISO date string)
 *
 * Returns: raw CSV string with Content-Type: text/csv
 *
 * CSV columns:
 *   Student Name, Guardian Name, Status, Confirmed
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const authedSession = requireRole(session, ["ADMIN", "TEACHER", "ACADEMICS"]);

    const { searchParams } = new URL(request.url);
    const classSectionId = searchParams.get("classSectionId");
    const date = searchParams.get("date");

    if (!classSectionId || !date) {
      return NextResponse.json(
        {
          error: {
            message: "classSectionId and date query parameters are required.",
            code: "VALIDATION_ERROR",
          },
        },
        { status: 400 },
      );
    }

    // Teacher scope check
    if (authedSession.user.role === "TEACHER") {
      const profile = await getTeacherProfile(authedSession.user.id);
      const activeAssignment = await prisma.classTeacherAssignment.findFirst({
        where: {
          teacherId: profile.id,
          classSectionId,
          isActive: true,
        },
      });
      if (!activeAssignment) {
        return NextResponse.json(
          { error: { message: "You are not the class teacher for this section.", code: "FORBIDDEN" } },
          { status: 403 },
        );
      }
    }

    const recordDate = new Date(date);

    // Fetch class section info for the CSV header
    const classSection = await prisma.classSection.findUnique({
      where: { id: classSectionId },
    });
    if (!classSection) {
      return NextResponse.json(
        { error: { message: "Class section not found.", code: "NOT_FOUND" } },
        { status: 404 },
      );
    }

    // Fetch attendance records with student info
    const records = await prisma.studentAttendance.findMany({
      where: {
        classSectionId,
        date: recordDate,
      },
      include: {
        student: {
          select: { id: true, name: true, guardianName: true },
        },
      },
      orderBy: { student: { name: "asc" } },
    });

    // Build CSV
    const lines: string[] = [];

    // Header row
    lines.push("Student Name,Guardian Name,Status,Confirmed");

    // Data rows
    for (const record of records) {
      const name = escapeCsvField(record.student.name);
      const guardian = escapeCsvField(record.student.guardianName);
      const status = record.status;
      const confirmed = record.isConfirmed ? "Yes" : "No";
      lines.push(`${name},${guardian},${status},${confirmed}`);
    }

    const csv = lines.join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="attendance-${classSection.className}-${classSection.sectionName}-${date}.csv"`,
      },
    });
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

/**
 * Escape a string for CSV (wrap in quotes if it contains comma, quote, or newline).
 */
function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
