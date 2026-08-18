import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole } from "@/lib/rbac";

/**
 * PATCH /api/attendance/:id
 *
 * Admin ONLY. Allows editing a record after it has been locked
 * (isConfirmed: true). This is the override path described in SRS §1.5.
 *
 * Sets lastEditedByAdmin to the Admin's user ID for audit trail.
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
    const authedSession = requireRole(session, ["ADMIN"]);

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

    // Update the record with audit trail
    const record = await prisma.studentAttendance.update({
      where: { id },
      data: {
        status: body.status,
        lastEditedByAdmin: authedSession.user.id,
      },
      include: {
        student: {
          select: { id: true, name: true },
        },
        classSection: {
          select: { id: true, className: true, sectionName: true },
        },
      },
    });

    return NextResponse.json({ data: record });
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
