import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole } from "@/lib/rbac";
import { getTeacherProfile } from "@/lib/teacher-scope";
import { isDateInFuture, isDateLocked } from "@/lib/timezone";

/**
 * PATCH /api/agenda/:id
 *
 * Teacher ONLY. Must be the author of the entry.
 * Server rejects if the entry's date is in the past (same isDateLocked()
 * helper as POST — one shared function, not duplicated).
 *
 * Body: { content }
 */
const updateAgendaSchema = z.object({
  content: z.string().min(1).max(5000),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const authedSession = requireRole(session, ["TEACHER"]);

    const profile = await getTeacherProfile(authedSession.user.id);
    const { id } = await params;
    const body = updateAgendaSchema.parse(await request.json());

    // Find the existing entry
    const existing = await prisma.dailyAgenda.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new ApiError(404, "NOT_FOUND", "Agenda entry not found.");
    }

    // Verify ownership
    if (existing.teacherId !== profile.id) {
      throw new ApiError(
        403,
        "FORBIDDEN",
        "You can only edit your own agenda entries.",
      );
    }

    // Check the shared local-date boundary — past entries are locked and future rows are invalid.
    const dateStr = existing.date.toISOString().split("T")[0];
    if (isDateInFuture(dateStr)) {
      throw new ApiError(400, "DATE_IN_FUTURE", "Cannot edit an entry for a future date.");
    }
    if (isDateLocked(dateStr)) {
      throw new ApiError(400, "DATE_LOCKED", "Cannot edit an entry for a date that has already passed.");
    }

    const entry = await prisma.dailyAgenda.update({
      where: { id },
      data: { content: body.content },
      include: {
        teacher: {
          select: { id: true, name: true },
        },
        classSection: {
          select: { id: true, className: true, sectionName: true },
        },
        subject: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({
      data: {
        ...entry,
        date: entry.date.toISOString().split("T")[0],
        isLocked: false,
      },
    });
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
  console.error(error);
  return NextResponse.json(
    { error: { message: "An internal error occurred.", code: "INTERNAL_ERROR" } },
    { status: 500 },
  );
}
