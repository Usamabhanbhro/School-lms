import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole } from "@/lib/rbac";
import { cnicField } from "@/lib/validations";

/**
 * PATCH /api/students/:id — edit student fields or reallot to a different class/section. Admin only.
 */
const editStudentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  guardianName: z.string().min(1).max(100).optional(),
  guardianCnic: cnicField.optional(),
  dateOfBirth: z.string().min(1).optional(),
  admissionDate: z.string().min(1).optional(),
  classSectionId: z.string().min(1).optional(),
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
    if (body.classSectionId !== undefined) updateData.classSectionId = body.classSectionId;

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
