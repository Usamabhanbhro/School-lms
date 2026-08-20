import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole } from "@/lib/rbac";
import { del } from "@vercel/blob";

/**
 * GET /api/templates/[id]
 *
 * Fetch a single template with its fields and table regions.
 * Admin only.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    requireRole(session, ["ADMIN"]);

    const { id } = await params;

    const template = await prisma.documentTemplate.findUnique({
      where: { id },
      include: {
        fields: true,
        tableRegions: true,
        _count: {
          select: {
            certificates: true,
            reportCards: true,
            feeChallans: true,
          },
        },
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: { message: "Template not found.", code: "NOT_FOUND" } },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: template });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * PATCH /api/templates/[id]
 *
 * Update template (activate/deactivate). Admin only.
 * Activating a template deactivates other templates of the same type.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    requireRole(session, ["ADMIN"]);

    const { id } = await params;
    const body = await request.json();

    const template = await prisma.documentTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json(
        { error: { message: "Template not found.", code: "NOT_FOUND" } },
        { status: 404 },
      );
    }

    if (typeof body.isActive === "boolean" && body.isActive === true) {
      // Deactivate all other templates of the same type, then activate this one
      await prisma.$transaction([
        prisma.documentTemplate.updateMany({
          where: { type: template.type, isActive: true },
          data: { isActive: false },
        }),
        prisma.documentTemplate.update({
          where: { id },
          data: { isActive: true },
        }),
      ]);
    } else if (typeof body.isActive === "boolean") {
      await prisma.documentTemplate.update({
        where: { id },
        data: { isActive: body.isActive },
      });
    }

    const updated = await prisma.documentTemplate.findUnique({
      where: { id },
      include: { fields: true, tableRegions: true },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * DELETE /api/templates/[id]
 *
 * Delete a template and its associated blobs. Admin only.
 * Cannot delete if documents reference this template.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    requireRole(session, ["ADMIN"]);

    const { id } = await params;

    const template = await prisma.documentTemplate.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            certificates: true,
            reportCards: true,
            feeChallans: true,
          },
        },
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: { message: "Template not found.", code: "NOT_FOUND" } },
        { status: 404 },
      );
    }

    const totalReferences =
      template._count.certificates +
      template._count.reportCards +
      template._count.feeChallans;

    if (totalReferences > 0) {
      return NextResponse.json(
        {
          error: {
            message: `Cannot delete template — ${totalReferences} document(s) reference it. Deactivate it instead.`,
            code: "IN_USE",
          },
        },
        { status: 409 },
      );
    }

    // Delete blobs
    if (template.originalFileUrl.startsWith("https://")) {
      await del(template.originalFileUrl).catch(() => {});
    }
    if (
      template.backgroundImageUrl !== template.originalFileUrl &&
      template.backgroundImageUrl.startsWith("https://")
    ) {
      await del(template.backgroundImageUrl).catch(() => {});
    }

    // Delete the template (cascade deletes fields and table regions)
    await prisma.documentTemplate.delete({ where: { id } });

    return NextResponse.json({ data: { message: "Template deleted." } });
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
  console.error(error);
  return NextResponse.json(
    { error: { message: "An internal error occurred.", code: "INTERNAL_ERROR" } },
    { status: 500 },
  );
}
