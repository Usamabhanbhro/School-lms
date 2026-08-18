import crypto from "crypto";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole } from "@/lib/rbac";

/**
 * POST /api/admin/recovery-code/regenerate
 *
 * Admin only. Generates a new one-time recovery code, hashes it,
 * stores the hash on the Admin's User record, and returns the
 * plaintext code exactly once.
 *
 * This is the manual rotation action (SRS §1.7 step 4) — the admin
 * can trigger this at any time if they suspect the current code
 * has been seen by someone else.
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    const authedSession = requireRole(session, ["ADMIN"]);

    // Generate a secure random recovery code (32 bytes = 64 hex chars)
    const recoveryCode = crypto.randomBytes(32).toString("hex");

    // Hash the recovery code (bcrypt, cost 12 — same as passwords)
    const recoveryCodeHash = await bcrypt.hash(recoveryCode, 12);

    // Update the Admin's User record
    await prisma.user.update({
      where: { id: authedSession.user.id },
      data: { recoveryCodeHash },
    });

    // Return the plaintext code exactly once — it is never stored in plaintext
    return NextResponse.json({
      data: { recoveryCode },
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
