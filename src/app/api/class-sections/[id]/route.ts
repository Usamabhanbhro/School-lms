import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole } from "@/lib/rbac";

const editClassSectionSchema = z.object({
  className: z.string().min(1).max(50).optional(),
  sectionName: z.string().min(1).max(20).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    requireRole(session, ["ADMIN"]);

    const { id } = await params;
    const body = editClassSectionSchema.parse(await request.json());

    const classSection = await prisma.classSection.update({
      where: { id },
      data: body,
    });

    return NextResponse.json({ data: classSection });
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
        { error: { message: "Class section not found.", code: "NOT_FOUND" } },
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
