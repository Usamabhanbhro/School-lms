import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole } from "@/lib/rbac";

/**
 * POST /api/terms
 *
 * Teacher ONLY. Creates a Term label on the fly (e.g. "Mid Term").
 * No date ranges — just a name, created at report-card-generation time.
 *
 * Body: { name }
 */
const createTermSchema = z.object({
  name: z.string().min(1).max(100),
});

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const authedSession = requireRole(session, ["TEACHER"]);

    const body = createTermSchema.parse(await request.json());

    const term = await prisma.term.create({
      data: {
        name: body.name,
        createdByTeacherId: authedSession.user.id,
      },
    });

    return NextResponse.json({ data: term }, { status: 201 });
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
