import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole } from "@/lib/rbac";

/**
 * PATCH /api/attendance/:id
 *
 * Admin and Academics. Allows editing any attendance record:
 * - Admin can edit locked records (SRS §1.5 override)
 * - Academics can edit any record (read-write oversight per new requirement)
 *
 * Every edit produces an AttendanceAuditLog entry.
 * Sets lastEditedByAdmin for Admin overrides.
 *
 * Body: { status } — the new attendance status
 */
const overrideAttendanceSchema = z.object({
  status: z.enum(["PRESENT", "ABSENT", "LEAVE"]),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const authedSession = requireRole(session, ["ADMIN", "ACADEMICS"]);

    const { id } = await params;
    const body = overrideAttendanceSchema.parse(await request.json());

    // Verify the record exists
    const existing = await prisma.studentAttendance.findUnique({
      where: { id },
    });
    if (!existing) {
      return NextResponse.json(
        { error: { message: "Attendance record not found.", code: "NOT_FOUND" } },
        { status: 404 },
      );
    }

    // If status hasn't changed, nothing to do
    if (existing.status === body.status) {
      return NextResponse.json({ data: existing });
    }

    // Update the record with audit trail in a transaction
    const record = await prisma.$transaction(async (tx) => {
      // Update the attendance record
      const updated = await tx.studentAttendance.update({
        where: { id },
        data: {
          status: body.status,
          lastEditedByAdmin: authedSession.user.id,
        },
      });

      // Create audit log entry
      await tx.attendanceAuditLog.create({
        data: {
          studentAttendanceId: id,
          editedById: authedSession.user.id,
          editedByRole: authedSession.user.role,
          previousStatus: existing.status,
          newStatus: body.status,
        },
      });

      return updated;
    });

    // Return with related data
    const result = await prisma.studentAttendance.findUnique({
      where: { id },
      include: {
        student: {
          select: { id: true, name: true },
        },
        classSection: {
          select: { id: true, className: true, sectionName: true },
        },
      },
    });

    return NextResponse.json({ data: result });
  } catch (error) {
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
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json(
        { error: { message: "Attendance record not found.", code: "NOT_FOUND" } },
        { status: 404 },
      );
    }
    console.error(error);
    return NextResponse.json(
      { error: { message: "An internal error occurred.", code: "INTERNAL_ERROR" } },
      { status: 500 },
    );
  }
}
