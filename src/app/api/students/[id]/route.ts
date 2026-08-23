import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole } from "@/lib/rbac";
import { cnicField, phoneField } from "@/lib/validations";

/**
 * PATCH /api/students/:id — edit student fields or reallot to a different class/section. Admin only.
 */
const editStudentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  guardianName: z.string().min(1).max(100).optional(),
  guardianCnic: cnicField.optional(),
  dateOfBirth: z.string().min(1).optional(),
  admissionDate: z.string().min(1).optional(),
  placeOfBirth: z.string().min(1).max(200).optional(),
  bloodGroup: z.enum(["A_PLUS", "A_MINUS", "B_PLUS", "B_MINUS", "AB_PLUS", "AB_MINUS", "O_PLUS", "O_MINUS"]).optional(),
  guardianContact: phoneField.optional(),
  address: z.string().min(1).max(500).optional(),
  classSectionId: z.string().min(1).optional(),
  studentId: z.string().max(50).optional(),
  rollNumber: z.string().max(20).optional(),
  grNumber: z.string().max(50).optional(),
  previousSchool: z.string().max(200).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    requireRole(session, ["ADMIN"]);

    const { id } = await params;
    const body = editStudentSchema.parse(await request.json());

    // Verify student exists
    const existing = await prisma.student.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: { message: "Student not found.", code: "NOT_FOUND" } },
        { status: 404 },
      );
    }

    // If changing class section, verify the new one exists
    if (body.classSectionId) {
      const classSection = await prisma.classSection.findUnique({
        where: { id: body.classSectionId },
      });
      if (!classSection) {
        return NextResponse.json(
          { error: { message: "Class section not found.", code: "NOT_FOUND" } },
          { status: 404 },
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.guardianName !== undefined) updateData.guardianName = body.guardianName;
    if (body.guardianCnic !== undefined) updateData.guardianCnic = body.guardianCnic;
    if (body.dateOfBirth !== undefined) updateData.dateOfBirth = new Date(body.dateOfBirth);
    if (body.admissionDate !== undefined) updateData.admissionDate = new Date(body.admissionDate);
    if (body.placeOfBirth !== undefined) updateData.placeOfBirth = body.placeOfBirth;
    if (body.bloodGroup !== undefined) updateData.bloodGroup = body.bloodGroup || null;
    if (body.guardianContact !== undefined) updateData.guardianContact = body.guardianContact;
    if (body.address !== undefined) updateData.address = body.address;
    if (body.classSectionId !== undefined) updateData.classSectionId = body.classSectionId;
    if (body.studentId !== undefined) updateData.studentId = body.studentId || null;
    if (body.rollNumber !== undefined) updateData.rollNumber = body.rollNumber || null;
    if (body.grNumber !== undefined) updateData.grNumber = body.grNumber || null;
    if (body.previousSchool !== undefined) updateData.previousSchool = body.previousSchool || null;

    // Validate studentId uniqueness if changing (active students only)
    if (body.studentId) {
      const dup = await prisma.student.findFirst({
        where: { studentId: body.studentId, id: { not: id }, isActive: true },
      });
      if (dup) {
        return NextResponse.json(
          { error: { message: "A student with this ID already exists.", code: "CONFLICT" } },
          { status: 409 },
        );
      }
    }

    // Validate rollNumber uniqueness within class section if changing (active only)
    if (body.rollNumber) {
      const targetClassId = body.classSectionId ?? existing.classSectionId;
      const dup = await prisma.student.findFirst({
        where: { classSectionId: targetClassId, rollNumber: body.rollNumber, id: { not: id }, isActive: true },
      });
      if (dup) {
        return NextResponse.json(
          { error: { message: "A student with this roll number already exists in this class section.", code: "CONFLICT" } },
          { status: 409 },
        );
      }
    }

    const student = await prisma.student.update({
      where: { id },
      data: updateData,
      include: {
        classSection: {
          select: { id: true, className: true, sectionName: true },
        },
      },
    });

    return NextResponse.json({ data: student });
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
        { error: { message: "Student not found.", code: "NOT_FOUND" } },
        { status: 404 },
      );
    }
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: { message: "A student with that CNIC already exists.", code: "CONFLICT" } },
        { status: 409 },
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
 * DELETE /api/students/:id — delete a student record.
 * Admin only. Blocks if historical records exist (attendance, marks, certificates, fee challans).
 * Without the block, the onDelete: Cascade FKs would silently wipe academic history.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    requireRole(session, ["ADMIN"]);

    const { id } = await params;

    const existing = await prisma.student.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      return NextResponse.json(
        { error: { message: "Student not found.", code: "NOT_FOUND" } },
        { status: 404 },
      );
    }

    // Check for historical references — if any exist, refuse to delete
    const [attendanceCount, markCount, reportCardCount, certificateCount, feeChallanCount] =
      await Promise.all([
        prisma.studentAttendance.count({ where: { studentId: id } }),
        prisma.mark.count({ where: { studentId: id } }),
        prisma.reportCard.count({ where: { studentId: id } }),
        prisma.certificate.count({ where: { studentId: id } }),
        prisma.feeChallan.count({ where: { studentId: id } }),
      ]);

    const totalRecords = attendanceCount + markCount + reportCardCount + certificateCount + feeChallanCount;

    if (totalRecords > 0) {
      // Has historical records — archive instead of deleting.
      // The student's record is preserved in full; their Student ID/Roll Number
      // become available for reuse by a new student (partial unique indexes
      // only enforce uniqueness among active students).
      await prisma.student.update({
        where: { id },
        data: { isActive: false },
      });

      return NextResponse.json({
        data: {
          id,
          archived: true,
          message: "Student archived to Past Students. Their records are preserved but they have been removed from active rosters.",
        },
      });
    }

    // No historical records — safe to hard delete
    await prisma.student.delete({ where: { id } });

    return NextResponse.json({ data: { id, deleted: true } });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: { message: error.message, code: error.code } },
        { status: error.status },
      );
    }
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json(
        { error: { message: "Student not found.", code: "NOT_FOUND" } },
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
