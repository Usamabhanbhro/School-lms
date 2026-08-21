import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole } from "@/lib/rbac";

/**
 * GET /api/certificates
 *
 * Admin: all certificates (global oversight).
 * Academics: all certificates (read-only).
 *
 * Lists all generated certificates, newest first.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    requireRole(session, ["ADMIN", "ACADEMICS"]);

    const certificates = await prisma.certificate.findMany({
      include: {
        student: {
          select: { id: true, name: true, classSection: { select: { className: true, sectionName: true } } },
        },
        generatedByUser: {
          select: { id: true, name: true },
        },
      },
      orderBy: { issuedDate: "desc" },
    });

    return NextResponse.json({ data: certificates });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/certificates
 *
 * Admin: allowed.
 * Academics: allowed.
 * Teacher: rejected (403).
 *
 * Payload: { studentId, type }
 *   - type must be "LEAVING" or "CHARACTER" (CertificateType enum)
 *
 * Creates a Certificate record for the given student.
 * generatedByUserId is set from the authenticated session, never from the client.
 */
const createCertificateSchema = z.object({
  studentId: z.string().min(1),
  type: z.enum(["LEAVING", "CHARACTER"]),
});

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const authedSession = requireRole(session, ["ADMIN", "ACADEMICS"]);

    const body = createCertificateSchema.parse(await request.json());

    // Verify the student exists
    const student = await prisma.student.findUnique({
      where: { id: body.studentId },
      select: { id: true, name: true },
    });

    if (!student) {
      return NextResponse.json(
        { error: { message: "Student not found.", code: "NOT_FOUND" } },
        { status: 404 },
      );
    }

    // Snapshot the active template for this certificate type
    const templateType = body.type === "LEAVING"
      ? "LEAVING_CERTIFICATE"
      : "CHARACTER_CERTIFICATE";
    const activeTemplate = await prisma.documentTemplate.findFirst({
      where: { type: templateType as any, isActive: true },
      select: { id: true },
    });

    const certificate = await prisma.certificate.create({
      data: {
        studentId: body.studentId,
        type: body.type,
        generatedByUserId: authedSession.user.id,
        templateId: activeTemplate?.id ?? null,
      },
      include: {
        student: {
          select: { id: true, name: true },
        },
        generatedByUser: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({ data: certificate }, { status: 201 });
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
