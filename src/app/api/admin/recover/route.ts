import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, PUBLIC_ENDPOINT_LIMITS } from "@/lib/rate-limit";
import {
  verifyRecoveryCode,
  findActiveRecoveryCode,
  consumeAndRotate,
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
 *   4. Atomically: consume the code, change password, generate NEW recovery code
 *   5. Return success with the new recovery code (shown once)
 *
 * Security notes:
 *   - bcrypt.compare handles timing-safe comparison
 *   - Codes are single-use: consumedAt is set atomically
 *   - Rate limiting prevents brute force attempts
 *   - Generic error messages prevent enumeration
 *   - The new recovery code is generated atomically with password change
 */
const recoverSchema = z.object({
  usernameOrEmail: z.string().min(1),
  recoveryCode: z.string().min(1),
  newPassword: z.string().min(8).max(100),
});

/** Unified error response — prevents account enumeration. */
const GENERIC_ERROR = {
  error: {
    message: "Invalid username/email or recovery code.",
    code: "INVALID_CREDENTIALS",
  },
};

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

    // Find the Admin user (same query regardless of existence to prevent timing leak)
    const admin = await prisma.user.findFirst({
      where: {
        role: "ADMIN",
        OR: [
          { username: body.usernameOrEmail },
          { email: body.usernameOrEmail },
        ],
      },
      select: { id: true },
    });

    if (!admin) {
      // Always use the same generic error — do not reveal whether the username exists
      return NextResponse.json(GENERIC_ERROR, { status: 401 });
    }

    // Find an active recovery code for this Admin
    const activeCode = await findActiveRecoveryCode(admin.id);

    if (!activeCode) {
      // No active code — could be expired, consumed, or never generated
      return NextResponse.json(GENERIC_ERROR, { status: 401 });
    }

    // Verify the recovery code against the stored hash
    const codeValid = await verifyRecoveryCode(body.recoveryCode, activeCode.codeHash);
    if (!codeValid) {
      return NextResponse.json(GENERIC_ERROR, { status: 401 });
    }

    // Code is valid — atomically consume code, change password, and generate new code
    const newPasswordHash = await bcrypt.hash(body.newPassword, 12);

    // All 5 operations happen atomically in one transaction:
    // consume old code, update password, mark other codes replaced,
    // create new recovery code record, update User.recoveryCodeHash
    const newRecoveryCode = await consumeAndRotate(
      admin.id,
      activeCode.id,
      newPasswordHash,
    );

    // Return success with the new recovery code (shown once)
    return NextResponse.json({
      data: {
        message: "Password reset successful.",
        newRecoveryCode,
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
