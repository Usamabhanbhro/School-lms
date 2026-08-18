import crypto from "crypto";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/admin/recover
 *
 * Public route — the recovery path for a locked-out Admin (SRS §1.7).
 * No session required.
 *
 * Flow:
 *   1. Find the User with role = ADMIN matching username or email
 *   2. Verify the provided recovery code against the stored hash
 *   3. If valid: hash the new password, generate a brand new recovery code,
 *      hash it, and update the Admin record with both
 *   4. Return success + the new plaintext recovery code (the old one is
 *      now invalid — single-use by design)
 *
 * Security notes:
 *   - The plaintext code is returned exactly once, never logged
 *   - bcrypt.compare handles timing-safe comparison
 *   - A new code is generated on every successful recovery, so a
 *     leaked-but-unused code cannot be reused
 */
const recoverSchema = z.object({
  usernameOrEmail: z.string().min(1),
  recoveryCode: z.string().min(1),
  newPassword: z.string().min(8).max(100),
});

export async function POST(request: Request) {
  try {
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

    // Generic error message — do not reveal whether the username exists
    const genericError = {
      error: {
        message: "Invalid username/email or recovery code.",
        code: "INVALID_CREDENTIALS",
      },
    };

    if (!admin || !admin.recoveryCodeHash) {
      return NextResponse.json(genericError, { status: 401 });
    }

    // Verify the recovery code against the stored hash
    const codeValid = await bcrypt.compare(body.recoveryCode, admin.recoveryCodeHash);
    if (!codeValid) {
      return NextResponse.json(genericError, { status: 401 });
    }

    // Code is valid — generate new password hash and new recovery code
    const newPasswordHash = await bcrypt.hash(body.newPassword, 12);
    const newRecoveryCode = crypto.randomBytes(32).toString("hex");
    const newRecoveryCodeHash = await bcrypt.hash(newRecoveryCode, 12);

    // Update Admin record: new password + new recovery code (invalidates old code)
    await prisma.user.update({
      where: { id: admin.id },
      data: {
        passwordHash: newPasswordHash,
        recoveryCodeHash: newRecoveryCodeHash,
      },
    });

    // Return success with the new recovery code
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
