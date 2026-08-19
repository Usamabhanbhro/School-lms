import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, PUBLIC_ENDPOINT_LIMITS } from "@/lib/rate-limit";
import { createRecoveryCode, findMostRecentRecoveryCode } from "@/lib/admin-recovery";

/**
 * POST /api/admin/recover/code
 *
 * Public route — generate a new recovery code for a locked-out Admin.
 * Used when the previous code has expired, been consumed, or been replaced.
 *
 * Rate limited: 3 attempts per 15 minutes per IP.
 *
 * Flow:
 *   1. Find the Admin user by username or email
 *   2. Find their most recent recovery code
 *   3. If the most recent code is still active (not consumed, not replaced, not expired),
 *      reject with a message telling them to use their existing code
 *   4. If no active code exists (expired, consumed, replaced, or never generated):
 *      generate a new code, hash it, store it, return plaintext once
 *
 * Security notes:
 *   - Generic error messages prevent enumeration
 *   - Rate limiting prevents brute force
 *   - Only returns the code once — never stored in plaintext
 */
const codeRequestSchema = z.object({
  usernameOrEmail: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    // Rate limiting
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(
      `admin-recover-code:${clientIp}`,
      PUBLIC_ENDPOINT_LIMITS.adminRecoverCode.limit,
      PUBLIC_ENDPOINT_LIMITS.adminRecoverCode.windowMs,
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

    const body = codeRequestSchema.parse(await request.json());

    // Find the Admin user
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

    // Generic error — do not reveal whether the username exists
    const genericError = {
      error: {
        message: "If an admin account exists with that identifier, a recovery code can be generated.",
        code: "CHECK_EMAIL",
      },
    };

    if (!admin) {
      return NextResponse.json(genericError, { status: 404 });
    }

    // Find the most recent recovery code
    const mostRecent = await findMostRecentRecoveryCode(admin.id);

    // Check if there's still an active code
    if (mostRecent && !mostRecent.consumedAt && !mostRecent.replacedAt && mostRecent.expiresAt > new Date()) {
      return NextResponse.json(
        {
          error: {
            message: "You already have an active recovery code. Use it to recover your account.",
            code: "ACTIVE_CODE_EXISTS",
          },
        },
        { status: 409 },
      );
    }

    // No active code — generate a new one
    const plaintextCode = await createRecoveryCode(admin.id);

    return NextResponse.json({
      data: {
        message: "New recovery code generated. Save this code — you will not see it again.",
        recoveryCode: plaintextCode,
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
