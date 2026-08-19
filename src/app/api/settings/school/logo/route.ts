import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole } from "@/lib/rbac";
import { put, del } from "@vercel/blob";
import { randomBytes } from "crypto";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_MIMES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];

/**
 * POST /api/settings/school/logo
 *
 * Upload a school logo. Admin only.
 * Saves to Vercel Blob storage (persistent across serverless invocations).
 * Updates the SchoolSettings.logoPath record with the blob URL.
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
    const file = formData.get("logo") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: { message: "No file provided.", code: "VALIDATION_ERROR" } },
        { status: 400 },
      );
    }

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

    // Delete old blob if exists
    const settings = await prisma.schoolSettings.findFirst();
    if (settings?.logoPath && settings.logoPath.startsWith("https://")) {
      await del(settings.logoPath).catch(() => {});
    }

    // Generate safe filename
    const ext = file.name.split(".").pop() ?? "png";
    const safeFilename = `school-logo/${randomBytes(16).toString("hex")}.${ext}`;

    // Upload to Vercel Blob (public access for rendering in <img>)
    const blob = await put(safeFilename, file, {
      access: "public",
    });

    // Update settings with blob URL
    if (settings) {
      await prisma.schoolSettings.update({
        where: { id: settings.id },
        data: { logoPath: blob.url },
      });
    } else {
      await prisma.schoolSettings.create({
        data: { logoPath: blob.url },
      });
    }

    return NextResponse.json({ data: { logoPath: blob.url } });
  } catch (error) {
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
}

/**
 * DELETE /api/settings/school/logo
 *
 * Remove the school logo. Admin only.
 * Deletes the blob from Vercel Blob storage and clears the path in settings.
 */
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    requireRole(session, ["ADMIN"]);

    const settings = await prisma.schoolSettings.findFirst();
    if (!settings?.logoPath) {
      return NextResponse.json(
        { error: { message: "No logo to remove.", code: "NOT_FOUND" } },
        { status: 404 },
      );
    }

    // Delete blob from Vercel Blob storage
    if (settings.logoPath.startsWith("https://")) {
      await del(settings.logoPath).catch(() => {});
    }

    // Clear the path in settings
    await prisma.schoolSettings.update({
      where: { id: settings.id },
      data: { logoPath: null },
    });

    return NextResponse.json({ data: { message: "Logo removed." } });
  } catch (error) {
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
}
