import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole } from "@/lib/rbac";
import { getTeacherProfile } from "@/lib/teacher-scope";
import { requireActiveClassTeacher } from "@/lib/class-teacher";

/**
 * POST /api/attendance/:classSectionId/:date/confirm
 *
 * Teacher ONLY (must be the active Class Teacher for this classSectionId).
 * Locks all draft attendance records for this class+date by setting
 * isConfirmed = true. Once locked, the teacher can no longer edit them.
 *
 * This is a batch operation — all records for the class+date are locked
 * together in a single transaction.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ classSectionId: string; date: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const authedSession = requireRole(session, ["TEACHER"]);

    const { classSectionId, date } = await params;
    const recordDate = new Date(date);

    // Resolve teacher profile
    const profile = await getTeacherProfile(authedSession.user.id);

    // Verify this teacher is the active Class Teacher for this section
    await requireActiveClassTeacher(profile.id, classSectionId);

    // Find all draft records for this class+date
    const draftRecords = await prisma.studentAttendance.findMany({
      where: {
        classSectionId,
        date: recordDate,
        isConfirmed: false,
      },
    });

    if (draftRecords.length === 0) {
      return NextResponse.json(
        {
          error: {
            message: "No draft attendance records found for this class and date. Nothing to confirm.",
            code: "NO_DRAFT_RECORDS",
          },
        },
        { status: 404 },
      );
    }

    // Lock all draft records in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.studentAttendance.updateMany({
        where: {
          classSectionId,
          date: recordDate,
          isConfirmed: false,
        },
        data: {
          isConfirmed: true,
        },
      });

      return { lockedCount: updated.count };
    });

    return NextResponse.json({
      data: {
        message: `Locked ${result.lockedCount} attendance record(s) for ${classSectionId} on ${date}.`,
        lockedCount: result.lockedCount,
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
