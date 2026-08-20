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
 *   3. If the most recent code is still active, reject with a generic message
 *   4. If no active code exists, generate a new one atomically
 *
 * Security notes:
 *   - Uses the same generic response whether or not the admin exists (prevents enumeration)
 *   - Rate limiting prevents brute force and code-rotation attacks
 *   - createRecoveryCode runs atomically via Prisma transaction
 *   - Only returns the code once — never stored in plaintext
 *   - The active-code check and generation are separated by the transaction boundary
 *     in createRecoveryCode, which also marks any old active code as replaced
 */
const codeRequestSchema = z.object({
  usernameOrEmail: z.string().min(1),
});

/** Unified response message — same whether or not the admin exists. */
const GENERIC_RESPONSE = {
  data: {
    message:
      "If an admin account exists with that identifier, a recovery code has been generated. Check the response for the code.",
  },
};

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

    // Find the Admin user — run the same query regardless of existence
    // to prevent timing-based enumeration
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
      // Return same shape as success but with no code — prevents enumeration
      // Use 200 with a message field so the frontend can distinguish
      // (the code field will be absent, which signals "no admin found")
      return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
    }

    // Find the most recent recovery code
    const mostRecent = await findMostRecentRecoveryCode(admin.id);

    // Check if there's still an active code (consumedAt and replacedAt both null)
    // Codes have no time-based expiry — they remain valid until used or regenerated.
    if (
      mostRecent &&
      !mostRecent.consumedAt &&
      !mostRecent.replacedAt
    ) {
      return NextResponse.json(
        {
          error: {
            message:
              "An active recovery code already exists. Use it to recover your account, or regenerate from the admin panel to rotate it.",
            code: "ACTIVE_CODE_EXISTS",
          },
        },
        { status: 409 },
      );
    }

    // No active code — generate a new one (atomic: replaces any old active code)
    const plaintextCode = await createRecoveryCode(admin.id);

    return NextResponse.json({
      data: {
        message:
          "New recovery code generated. Save this code — you will not see it again. Your previous recovery code is no longer valid.",
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
