import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole } from "@/lib/rbac";

const fieldSchema = z.object({
  fieldKey: z.string().min(1).max(100),
  xPercent: z.number().min(0).max(100),
  yPercent: z.number().min(0).max(100),
  fontSize: z.number().min(6).max(72),
  textAlign: z.enum(["left", "center", "right"]).default("left"),
});

const columnSchema = z.object({
  fieldKey: z.string().min(1).max(100),
  xPercent: z.number().min(0).max(100),
  label: z.string().min(1).max(200),
});

const tableRegionSchema = z.object({
  anchorXPercent: z.number().min(0).max(100),
  anchorYPercent: z.number().min(0).max(100),
  rowHeightPercent: z.number().min(0.1).max(50),
  columns: z.array(columnSchema).min(1),
});

const saveFieldsSchema = z.object({
  fields: z.array(fieldSchema),
  tableRegions: z.array(tableRegionSchema),
});

/**
 * GET /api/templates/[id]/fields
 *
 * Fetch field placements and table regions for a template.
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
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: { message: "Template not found.", code: "NOT_FOUND" } },
        { status: 404 },
      );
    }

    return NextResponse.json({
      data: {
        fields: template.fields,
        tableRegions: template.tableRegions,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/templates/[id]/fields
 *
 * Save field placements and table regions for a template (replaces all existing).
 * Admin only.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    requireRole(session, ["ADMIN"]);

    const { id } = await params;
    const body = saveFieldsSchema.parse(await request.json());

    const template = await prisma.documentTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json(
        { error: { message: "Template not found.", code: "NOT_FOUND" } },
        { status: 404 },
      );
    }

    // Replace all fields and table regions atomically
    await prisma.$transaction([
      // Delete existing
      prisma.templateField.deleteMany({ where: { templateId: id } }),
      prisma.templateTableRegion.deleteMany({ where: { templateId: id } }),
      // Insert new fields
      ...body.fields.map((f) =>
        prisma.templateField.create({
          data: {
            templateId: id,
            fieldKey: f.fieldKey,
            xPercent: f.xPercent,
            yPercent: f.yPercent,
            fontSize: f.fontSize,
            textAlign: f.textAlign,
          },
        }),
      ),
      // Insert new table regions
      ...body.tableRegions.map((tr) =>
        prisma.templateTableRegion.create({
          data: {
            templateId: id,
            anchorXPercent: tr.anchorXPercent,
            anchorYPercent: tr.anchorYPercent,
            rowHeightPercent: tr.rowHeightPercent,
            columns: tr.columns as any,
          },
        }),
      ),
    ]);

    // Return the updated template
    const updated = await prisma.documentTemplate.findUnique({
      where: { id },
      include: { fields: true, tableRegions: true },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { message: "Invalid field data.", code: "VALIDATION_ERROR" } },
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
