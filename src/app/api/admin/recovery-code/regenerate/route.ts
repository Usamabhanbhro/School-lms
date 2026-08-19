import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { ApiError, requireRole } from "@/lib/rbac";
import { createRecoveryCode } from "@/lib/admin-recovery";

/**
 * POST /api/admin/recovery-code/regenerate
 *
 * Admin only (authenticated). Generates a new one-time recovery code using the
 * AdminRecoveryCode model, invalidating any prior active code.
 *
 * This is the manual rotation action (SRS §1.7 step 4) — the admin
 * can trigger this at any time if they suspect the current code
 * has been seen by someone else.
 *
 * createRecoveryCode runs atomically via Prisma transaction.
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    const authedSession = requireRole(session, ["ADMIN"]);

    // Use the shared helper to generate a new code (invalidates any prior active code)
    // createRecoveryCode wraps in its own transaction for atomicity
    const plaintextCode = await createRecoveryCode(authedSession.user.id);

    // Return the plaintext code exactly once — it is never stored in plaintext
    return NextResponse.json({
      data: {
        message:
          "New recovery code generated. Save this code — you will not see it again. Your previous recovery code is no longer valid.",
        recoveryCode: plaintextCode,
      },
    });
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
