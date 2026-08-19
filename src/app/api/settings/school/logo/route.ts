import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole } from "@/lib/rbac";
import { writeFile, unlink, mkdir } from "fs/promises";
import { join } from "path";
import { randomBytes } from "crypto";

const UPLOAD_DIR = join(process.cwd(), "public", "uploads", "logos");
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_MIMES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];

/**
 * POST /api/settings/school/logo
 *
 * Upload a school logo. Admin only.
 * Saves to public/uploads/logos/ with a random filename.
 * Updates the SchoolSettings.logoPath record.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    requireRole(session, ["ADMIN"]);

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

    // Generate safe filename
    const ext = file.name.split(".").pop() ?? "png";
    const safeFilename = `${randomBytes(16).toString("hex")}.${ext}`;

    // Ensure upload directory exists
    await mkdir(UPLOAD_DIR, { recursive: true });

    // Write file
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(join(UPLOAD_DIR, safeFilename), buffer);

    // Delete old logo if exists
    const settings = await prisma.schoolSettings.findFirst();
    if (settings?.logoPath) {
      const oldPath = join(process.cwd(), "public", settings.logoPath);
      await unlink(oldPath).catch(() => {}); // ignore if file doesn't exist
    }

    // Update settings with new logo path
    const logoPath = `/uploads/logos/${safeFilename}`;

    if (settings) {
      await prisma.schoolSettings.update({
        where: { id: settings.id },
        data: { logoPath },
      });
    } else {
      await prisma.schoolSettings.create({
        data: { logoPath },
      });
    }

    return NextResponse.json({ data: { logoPath } });
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

    // Delete the file
    const filePath = join(process.cwd(), "public", settings.logoPath);
    await unlink(filePath).catch(() => {});

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
