import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole } from "@/lib/rbac";

/**
 * DELETE /api/class-sections/:id/class-teacher
 * Remove the active Class Teacher assignment for a ClassSection.
 * Admin only. Does not delete the teacher — only removes the relationship.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    requireRole(session, ["ADMIN"]);

    const { id: classSectionId } = await params;

    // Find the active assignment
    const activeAssignment = await prisma.classTeacherAssignment.findFirst({
      where: { classSectionId, isActive: true },
    });

    if (!activeAssignment) {
      return NextResponse.json(
        { error: { message: "No active class teacher assignment found.", code: "NOT_FOUND" } },
        { status: 404 },
      );
    }

    // Deactivate the assignment
    await prisma.classTeacherAssignment.update({
      where: { id: activeAssignment.id },
      data: { isActive: false },
    });

    return NextResponse.json({ data: { message: "Class teacher unassigned." } });
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
 * POST /api/class-sections/:id/class-teacher
 * Assign (or reassign) the single active Class Teacher for a ClassSection.
 * Admin only.
 *
 * Atomic transaction:
 *   Step 1: Soft-delete any currently active assignment (set isActive = false)
 *   Step 2: Create the new active assignment
 *   If either fails, the transaction rolls back — no orphaned or duplicate states.
 */
const assignClassTeacherSchema = z.object({
  teacherId: z.string().min(1),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    requireRole(session, ["ADMIN"]);

    const { id: classSectionId } = await params;
    const body = assignClassTeacherSchema.parse(await request.json());

    // Verify the class section exists
    const classSection = await prisma.classSection.findUnique({
      where: { id: classSectionId },
    });
    if (!classSection) {
      return NextResponse.json(
        { error: { message: "Class section not found.", code: "NOT_FOUND" } },
        { status: 404 },
      );
    }

    // Verify the teacher exists
    const teacher = await prisma.teacherProfile.findUnique({
      where: { id: body.teacherId },
    });
    if (!teacher) {
      return NextResponse.json(
        { error: { message: "Teacher not found.", code: "NOT_FOUND" } },
        { status: 404 },
      );
    }

    // Atomic: deactivate old + create new
    const assignment = await prisma.$transaction(async (tx) => {
      // Step 1: Soft-delete any currently active assignment for this section
      await tx.classTeacherAssignment.updateMany({
        where: { classSectionId, isActive: true },
        data: { isActive: false },
      });

      // Step 2: Create the new active assignment
      return tx.classTeacherAssignment.create({
        data: {
          classSectionId,
          teacherId: body.teacherId,
          isActive: true,
        },
        include: {
          teacher: {
            select: { id: true, name: true, phone: true },
          },
          classSection: {
            select: { id: true, className: true, sectionName: true },
          },
        },
      });
    });

    return NextResponse.json({ data: assignment }, { status: 201 });
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
    console.error(error);
    return NextResponse.json(
      { error: { message: "An internal error occurred.", code: "INTERNAL_ERROR" } },
      { status: 500 },
    );
  }
}
