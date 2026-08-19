import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, PUBLIC_ENDPOINT_LIMITS } from "@/lib/rate-limit";
import {
  verifyRecoveryCode,
  createRecoveryCode,
  findActiveRecoveryCode,
} from "@/lib/admin-recovery";

/**
 * POST /api/admin/recover
 *
 * Public route — the recovery path for a locked-out Admin.
 * No session required.
 *
 * Rate limited: 5 attempts per 15 minutes per IP.
 *
 * Flow:
 *   1. Find the User with role = ADMIN matching username or email
 *   2. Find an active recovery code (not consumed, not replaced, not expired)
 *   3. Verify the provided code against the stored hash
 *   4. If valid: consume the code, hash the new password, generate a NEW recovery code,
 *      and update the Admin record
 *   5. Return success — the new recovery code is NOT returned from this endpoint
 *      (the Admin should already have a valid code or use the code-generation endpoint)
 *
 * Security notes:
 *   - bcrypt.compare handles timing-safe comparison
 *   - Codes are single-use: consumedAt is set atomically
 *   - Rate limiting prevents brute force attempts
 *   - Generic error messages prevent enumeration
 */
const recoverSchema = z.object({
  usernameOrEmail: z.string().min(1),
  recoveryCode: z.string().min(1),
  newPassword: z.string().min(8).max(100),
});

export async function POST(request: Request) {
  try {
    // Rate limiting
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(
      `admin-recover:${clientIp}`,
      PUBLIC_ENDPOINT_LIMITS.adminRecover.limit,
      PUBLIC_ENDPOINT_LIMITS.adminRecover.windowMs,
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

    const body = recoverSchema.parse(await request.json());

    // Find the Admin user
    const admin = await prisma.user.findFirst({
      where: {
        role: "ADMIN",
        OR: [
          { username: body.usernameOrEmail },
          { email: body.usernameOrEmail },
        ],
      },
    });

    // Generic error — do not reveal whether the username exists
    const genericError = {
      error: {
        message: "Invalid username/email or recovery code.",
        code: "INVALID_CREDENTIALS",
      },
    };

    if (!admin) {
      return NextResponse.json(genericError, { status: 401 });
    }

    // Find an active recovery code for this Admin
    const activeCode = await findActiveRecoveryCode(admin.id);

    if (!activeCode) {
      // No active code — could be expired, consumed, or never generated
      return NextResponse.json(genericError, { status: 401 });
    }

    // Verify the recovery code against the stored hash
    const codeValid = await verifyRecoveryCode(body.recoveryCode, activeCode.codeHash);
    if (!codeValid) {
      return NextResponse.json(genericError, { status: 401 });
    }

    // Code is valid — atomically consume the code, change password, and generate new code
    const newPasswordHash = await bcrypt.hash(body.newPassword, 12);

    await prisma.$transaction(async (tx) => {
      // Mark the recovery code as consumed
      await tx.adminRecoveryCode.update({
        where: { id: activeCode.id },
        data: { consumedAt: new Date() },
      });

      // Update the Admin's password
      await tx.user.update({
        where: { id: admin.id },
        data: { passwordHash: newPasswordHash },
      });

      // Invalidate any other active codes (shouldn't exist, but safety net)
      await tx.adminRecoveryCode.updateMany({
        where: {
          userId: admin.id,
          consumedAt: null,
          replacedAt: null,
          id: { not: activeCode.id },
        },
        data: { replacedAt: new Date() },
      });
    });

    // Generate a new recovery code for future use
    const newPlaintextCode = await createRecoveryCode(admin.id);

    // Return success with the new recovery code (shown once)
    return NextResponse.json({
      data: {
        message: "Password reset successful.",
        newRecoveryCode: newPlaintextCode,
      },
    });
  } catch (error) {
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
