import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole } from "@/lib/rbac";

const editSubjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    requireRole(session, ["ADMIN"]);

    const { id } = await params;
    const body = editSubjectSchema.parse(await request.json());

    const subject = await prisma.subject.update({
      where: { id },
      data: body,
    });

    return NextResponse.json({ data: subject });
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
        { error: { message: "Subject not found.", code: "NOT_FOUND" } },
        { status: 404 },
      );
    }
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: { message: "A subject with that name already exists.", code: "CONFLICT" } },
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
