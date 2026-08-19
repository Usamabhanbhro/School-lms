import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole } from "@/lib/rbac";

/**
 * GET /api/settings/school
 *
 * Returns the singleton SchoolSettings record.
 * Admin: read and write.
 * Academics: read-only.
 * Teacher: rejected.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    requireRole(session, ["ADMIN", "ACADEMICS"]);

    let settings = await prisma.schoolSettings.findFirst();

    // Create default settings if none exist
    if (!settings) {
      settings = await prisma.schoolSettings.create({
        data: {
          schoolName: "[SCHOOL NAME]",
          address: "",
          phone: "",
          email: "",
          principalName: "",
        },
      });
    }

    return NextResponse.json({ data: settings });
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

const updateSchoolSettingsSchema = z.object({
  schoolName: z.string().min(1).max(200).optional(),
  address: z.string().max(500).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().max(200).optional(),
  principalName: z.string().max(100).optional(),
  logoPath: z.string().nullable().optional(),
});

/**
 * PATCH /api/settings/school
 *
 * Update school settings. Admin only.
 */
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    requireRole(session, ["ADMIN"]);

    const body = updateSchoolSettingsSchema.parse(await request.json());

    // Get or create settings
    let settings = await prisma.schoolSettings.findFirst();
    if (!settings) {
      settings = await prisma.schoolSettings.create({ data: {} });
    }

    // Update only provided fields
    const updated = await prisma.schoolSettings.update({
      where: { id: settings.id },
      data: body,
    });

    return NextResponse.json({ data: updated });
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
    console.error(error);
    return NextResponse.json(
      { error: { message: "An internal error occurred.", code: "INTERNAL_ERROR" } },
      { status: 500 },
    );
  }
}
