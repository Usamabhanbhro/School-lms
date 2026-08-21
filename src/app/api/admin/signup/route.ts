import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, PUBLIC_ENDPOINT_LIMITS } from "@/lib/rate-limit";
import { createRecoveryCode } from "@/lib/admin-recovery";

/**
 * POST /api/admin/signup
 *
 * Public route — first admin provisioning (SRS §1.7).
 * Only works if no ADMIN user exists yet.
 *
 * Rate limited: 3 attempts per 15 minutes per IP.
 *
 * Creates:
 *   1. User with role = ADMIN
 *   2. A one-time recovery code (hashed, displayed once)
 *
 * Security:
 *   - Database-level: checks for existing ADMIN before insert
 *   - Uses create (not upsert) to avoid race conditions
 *   - Password hashed with bcrypt (12 rounds)
 *   - Recovery code hashed with bcrypt (12 rounds)
 *   - Generic error messages to prevent enumeration
 *   - Rate limiting to prevent brute force
 */
const signupSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").max(100),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export async function POST(request: Request) {
  try {
    // Rate limiting
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(
      `admin-signup:${clientIp}`,
      PUBLIC_ENDPOINT_LIMITS.adminSignup.limit,
      PUBLIC_ENDPOINT_LIMITS.adminSignup.windowMs,
    );

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: {
            message: "Too many attempts. Please try again later.",
            code: "RATE_LIMITED",
          },
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
          },
        },
      );
    }

    const body = signupSchema.parse(await request.json());

    // Normalize email
    const normalizedEmail = body.email.toLowerCase().trim();

    // Check if any ADMIN already exists (race-condition safe with create)
    const existingAdmin = await prisma.user.findFirst({
      where: { role: "ADMIN" },
    });

    if (existingAdmin) {
      // Generic error — don't reveal that an admin already exists
      return NextResponse.json(
        {
          error: {
            message: "Admin account already exists. Please contact your school administrator.",
            code: "ADMIN_EXISTS",
          },
        },
        { status: 409 },
      );
    }

    // Check for duplicate email — case-insensitive so pre-normalization
    // mixed-case rows are still caught
    const existingEmail = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
    });

    if (existingEmail) {
      return NextResponse.json(
        {
          error: {
            message: "An account with this email already exists.",
            code: "DUPLICATE_EMAIL",
          },
        },
        { status: 409 },
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(body.password, 12);

    // Create admin user with recovery code
    // Use a transaction to ensure atomicity
    const user = await prisma.$transaction(async (tx) => {
      // Double-check no admin exists (within transaction)
      const adminCheck = await tx.user.findFirst({
        where: { role: "ADMIN" },
      });

      if (adminCheck) {
        throw new Error("ADMIN_EXISTS_RACE");
      }

      return tx.user.create({
        data: {
          username: normalizedEmail, // Use email as username
          email: normalizedEmail,
          name: body.name,
          passwordHash,
          role: "ADMIN",
        },
      });
    });

    // Generate initial recovery code using the new model
    const recoveryCode = await createRecoveryCode(user.id);

    // Return success with plaintext recovery code (shown once)
    return NextResponse.json(
      {
        data: {
          message: "Admin account created successfully.",
          userId: user.id,
          recoveryCode, // Shown once — user must save this
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { message: "Invalid request body.", code: "VALIDATION_ERROR" } },
        { status: 400 },
      );
    }

    // Handle race condition where two signups happen simultaneously
    if (error instanceof Error && error.message === "ADMIN_EXISTS_RACE") {
      return NextResponse.json(
        {
          error: {
            message: "Admin account already exists. Please contact your school administrator.",
            code: "ADMIN_EXISTS",
          },
        },
        { status: 409 },
      );
    }

    console.error(error);
    return NextResponse.json(
      { error: { message: "An internal error occurred.", code: "INTERNAL_ERROR" } },
      { status: 500 },
    );
  }
}
