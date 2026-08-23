import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole } from "@/lib/rbac";
import { getTeacherProfile } from "@/lib/teacher-scope";

/**
 * GET /api/attendance/classes
 *
 * Returns the class sections where the authenticated teacher is the active Class Teacher.
 * Used by the teacher attendance page to show only classes the teacher can mark attendance for.
 *
 * Admin: returns all class sections.
 * Teacher: returns only classes where they are the active Class Teacher.
 * Academics: returns all class sections (read-only oversight).
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const authedSession = requireRole(session, ["ADMIN", "TEACHER", "ACADEMICS"]);

    let classSectionIds: string[] | undefined;

    if (authedSession.user.role === "TEACHER") {
      const profile = await getTeacherProfile(authedSession.user.id);

      // Only get classes where this teacher is the active Class Teacher
      const assignments = await prisma.classTeacherAssignment.findMany({
        where: { teacherId: profile.id, isActive: true },
        select: { classSectionId: true },
      });

      classSectionIds = assignments.map((a) => a.classSectionId);

      if (classSectionIds.length === 0) {
        return NextResponse.json({ data: [] });
      }
    }

    const where = classSectionIds ? { id: { in: classSectionIds } } : {};

    const classSections = await prisma.classSection.findMany({
      where,
      include: {
        _count: { select: { students: { where: { isActive: true } } } },
      },
      orderBy: [{ className: "asc" }, { sectionName: "asc" }],
    });

    return NextResponse.json({ data: classSections });
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
