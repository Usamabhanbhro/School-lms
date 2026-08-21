import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole } from "@/lib/rbac";
import { cnicField, phoneField } from "@/lib/validations";

/**
 * PATCH /api/teachers/:id — edit teacher fields, or set isActive: false to revoke.
 * Admin only.
 */
const editTeacherSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  fatherOrSpouseName: z.string().min(1).max(100).optional(),
  cnic: cnicField.optional(),
  phone: phoneField.optional(),
  email: z
    .union([z.email(), z.literal("")])
    .optional()
    .transform((value) =>
      value === "" || value === undefined ? undefined : value.trim().toLowerCase(),
    ),
  isActive: z.boolean().optional(),
});

const teacherSelect = {
  id: true,
  name: true,
  fatherOrSpouseName: true,
  cnic: true,
  phone: true,
  email: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      username: true,
      email: true,
      isActive: true,
      role: true,
    },
  },
} as const;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    requireRole(session, ["ADMIN"]);

    const { id } = await params;
    const body = editTeacherSchema.parse(await request.json());

    // Find the teacher profile
    const existing = await prisma.teacherProfile.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: { message: "Teacher not found.", code: "NOT_FOUND" } },
        { status: 404 },
      );
    }

    // Build update data — only include fields that were provided
    const profileData: Record<string, unknown> = {};
    if (body.name !== undefined) profileData.name = body.name;
    if (body.fatherOrSpouseName !== undefined) profileData.fatherOrSpouseName = body.fatherOrSpouseName;
    if (body.cnic !== undefined) profileData.cnic = body.cnic;
    if (body.phone !== undefined) profileData.phone = body.phone;
    if (body.email !== undefined) profileData.email = body.email;

    const userData: Record<string, unknown> = {};
    if (body.name !== undefined) userData.name = body.name;
    if (body.email !== undefined) userData.email = body.email;
    if (body.isActive !== undefined) userData.isActive = body.isActive;

    const result = await prisma.$transaction(async (tx) => {
      if (Object.keys(profileData).length > 0) {
        await tx.teacherProfile.update({
          where: { id },
          data: profileData,
        });
      }
      if (Object.keys(userData).length > 0) {
        await tx.user.update({
          where: { id: existing.userId },
          data: userData,
        });
      }
      return tx.teacherProfile.findUnique({
        where: { id },
        select: teacherSelect,
      });
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * DELETE /api/teachers/:id — delete a teacher record.
 * Admin only. Cascades to TeacherProfile (onDelete: Cascade on userId).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    requireRole(session, ["ADMIN"]);

    const { id } = await params;

    const existing = await prisma.teacherProfile.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: { message: "Teacher not found.", code: "NOT_FOUND" } },
        { status: 404 },
      );
    }

    // Check for historical references attached to this TeacherProfile
    const [classTeacherCount, subjectTeacherCount, studentAttendanceCount, teacherAttendanceCount, testCount] =
      await Promise.all([
        prisma.classTeacherAssignment.count({ where: { teacherId: id } }),
        prisma.subjectTeacherAssignment.count({ where: { teacherId: id } }),
        prisma.studentAttendance.count({ where: { markedByTeacherId: id } }),
        prisma.teacherAttendance.count({ where: { teacherId: id } }),
        prisma.test.count({ where: { teacherId: existing.userId } }),
      ]);

    const totalRecords =
      classTeacherCount + subjectTeacherCount + studentAttendanceCount + teacherAttendanceCount + testCount;

    if (totalRecords > 0) {
      return NextResponse.json(
        {
          error: {
            message: "Cannot delete teacher with existing historical records. Please revoke access (isActive: false) instead.",
            code: "HISTORICAL_RECORDS_EXIST",
          },
        },
        { status: 400 },
      );
    }

    // No historical records — safe to hard delete
    // Delete User (cascades to TeacherProfile via onDelete: Cascade)
    await prisma.user.delete({ where: { id: existing.userId } });

    return NextResponse.json({ data: { id } });
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
  if ((error as { code?: string }).code === "P2002") {
    return NextResponse.json(
      { error: { message: "A teacher with that username, email, or CNIC already exists.", code: "CONFLICT" } },
      { status: 409 },
    );
  }
  if ((error as { code?: string }).code === "P2025") {
    return NextResponse.json(
      { error: { message: "Teacher not found.", code: "NOT_FOUND" } },
      { status: 404 },
    );
  }
  console.error(error);
  return NextResponse.json(
    { error: { message: "An internal error occurred.", code: "INTERNAL_ERROR" } },
    { status: 500 },
  );
}
