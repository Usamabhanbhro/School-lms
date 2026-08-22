import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole } from "@/lib/rbac";
import { put } from "@vercel/blob";
import { randomBytes } from "crypto";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIMES = ["image/png", "image/jpeg", "image/webp"];

const DocumentTemplateTypeEnum = z.enum([
  "LEAVING_CERTIFICATE",
  "CHARACTER_CERTIFICATE",
  "REPORT_CARD",
  "FEE_CHALLAN",
]);

/**
 * GET /api/templates
 *
 * List all document templates, optionally filtered by type.
 * Admin only.
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    requireRole(session, ["ADMIN"]);

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    const where = type
      ? { type: DocumentTemplateTypeEnum.parse(type) }
      : {};

    const templates = await prisma.documentTemplate.findMany({
      where,
      include: {
        fields: true,
        staticTexts: true,
        tableRegions: true,
        _count: {
          select: {
            certificates: true,
            reportCards: true,
            feeChallans: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: templates });
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

/**
 * POST /api/templates
 *
 * Upload a new document template. Admin only.
 * Accepts multipart form data with:
 * - file: PNG/JPG image (already converted from PDF on client if needed)
 * - type: DocumentTemplateType enum value
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    requireRole(session, ["ADMIN"]);

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        {
          error: {
            message: "File storage is not configured. Please add BLOB_READ_WRITE_TOKEN to your environment variables.",
            code: "STORAGE_NOT_CONFIGURED",
          },
        },
        { status: 500 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const typeRaw = formData.get("type") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: { message: "No file provided.", code: "VALIDATION_ERROR" } },
        { status: 400 },
      );
    }

    if (!typeRaw) {
      return NextResponse.json(
        { error: { message: "Template type is required.", code: "VALIDATION_ERROR" } },
        { status: 400 },
      );
    }

    const type = DocumentTemplateTypeEnum.parse(typeRaw);

    // Validate MIME type
    if (!ALLOWED_MIMES.includes(file.type)) {
      return NextResponse.json(
        {
          error: {
            message: `Invalid file type. Allowed: ${ALLOWED_MIMES.join(", ")}`,
            code: "VALIDATION_ERROR",
          },
        },
        { status: 400 },
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: {
            message: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
            code: "VALIDATION_ERROR",
          },
        },
        { status: 400 },
      );
    }

    const userId = (session as any).user.id as string;

    // Generate safe filename
    const ext = file.name.split(".").pop() ?? "png";
    const safeFilename = `templates/${type.toLowerCase()}/${randomBytes(16).toString("hex")}.${ext}`;

    // Upload to Vercel Blob (public access for rendering)
    const blob = await put(safeFilename, file, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    // Create template record — file is both original and background (client already converted PDF to image)
    const template = await prisma.documentTemplate.create({
      data: {
        type,
        originalFileUrl: blob.url,
        backgroundImageUrl: blob.url,
        uploadedBy: userId,
        isActive: false,
      },
      include: {
        fields: true,
        tableRegions: true,
      },
    });

    return NextResponse.json({ data: template });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { message: "Invalid template type.", code: "VALIDATION_ERROR" } },
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
