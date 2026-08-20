import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole } from "@/lib/rbac";

const DocumentTemplateTypeEnum = z.enum([
  "LEAVING_CERTIFICATE",
  "CHARACTER_CERTIFICATE",
  "REPORT_CARD",
  "FEE_CHALLAN",
]);

/**
 * GET /api/templates/active?type=LEAVING_CERTIFICATE
 *
 * Fetch the active template (with fields and table regions) for a given document type.
 * Admin only.
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    requireRole(session, ["ADMIN"]);

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    if (!type) {
      return NextResponse.json(
        { error: { message: "type query parameter is required.", code: "VALIDATION_ERROR" } },
        { status: 400 },
      );
    }

    const parsedType = DocumentTemplateTypeEnum.parse(type);

    const template = await prisma.documentTemplate.findFirst({
      where: {
        type: parsedType,
        isActive: true,
      },
      include: {
        fields: true,
        tableRegions: true,
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: { message: "No active template found for this type.", code: "NOT_FOUND" } },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: template });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { message: "Invalid type parameter.", code: "VALIDATION_ERROR" } },
        { status: 400 },
      );
    }
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
  console.error(error);
  return NextResponse.json(
    { error: { message: "An internal error occurred.", code: "INTERNAL_ERROR" } },
    { status: 500 },
  );
}
