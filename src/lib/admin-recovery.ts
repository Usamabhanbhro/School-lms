import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

/**
 * Recovery-code configuration.
 * Codes expire after RECOVERY_CODE_TTL_MS from generation.
 */
export const RECOVERY_CODE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Number of hex characters in the plaintext recovery code. */
const CODE_BYTE_LENGTH = 32; // 64 hex characters

/**
 * Generate a cryptographically secure random recovery code.
 * The plaintext is returned — it must be displayed to the Admin exactly once.
 */
export function generateRecoveryCode(): string {
  return crypto.randomBytes(CODE_BYTE_LENGTH).toString("hex");
}

/**
 * Hash a recovery code using bcrypt (12 rounds, same as passwords).
 */
export async function hashRecoveryCode(code: string): Promise<string> {
  return bcrypt.hash(code, 12);
}

/**
 * Verify a plaintext code against a bcrypt hash (timing-safe).
 */
export async function verifyRecoveryCode(
  plaintext: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}

/**
 * Create a new recovery code record for the Admin, invalidating any prior active code.
 *
 * Steps:
 *   1. Mark any existing active code as replaced
 *   2. Generate a new code
 *   3. Hash it
 *   4. Store the record
 *   5. Update the User.recoveryCodeHash (kept for backward compat / quick lookup)
 *   6. Return the plaintext code (shown once)
 */
export async function createRecoveryCode(userId: string): Promise<string> {
  const expiresAt = new Date(Date.now() + RECOVERY_CODE_TTL_MS);

  // Invalidate any prior active code (consumedAt NULL, replacedAt NULL)
  await prisma.adminRecoveryCode.updateMany({
    where: {
      userId,
      consumedAt: null,
      replacedAt: null,
    },
    data: { replacedAt: new Date() },
  });

  const plaintext = generateRecoveryCode();
  const codeHash = await hashRecoveryCode(plaintext);

  // Create the new recovery code record
  await prisma.adminRecoveryCode.create({
    data: {
      userId,
      codeHash,
      expiresAt,
    },
  });

  // Keep User.recoveryCodeHash in sync for quick lookup during verification
  await prisma.user.update({
    where: { id: userId },
    data: { recoveryCodeHash: codeHash },
  });

  return plaintext;
}

/**
 * Find the currently active recovery code record for a user.
 *
 * Active means:
 *   - consumedAt IS NULL
 *   - replacedAt IS NULL
 *   - expiresAt > now
 *
 * Returns null if no active code exists.
 */
export async function findActiveRecoveryCode(userId: string) {
  return prisma.adminRecoveryCode.findFirst({
    where: {
      userId,
      consumedAt: null,
      replacedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Find the most recent recovery code for a user (active or not).
 * Used to determine the status of an expired/consumed/replaced code.
 */
export async function findMostRecentRecoveryCode(userId: string) {
  return prisma.adminRecoveryCode.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Mark a recovery code as consumed (used successfully).
 */
export async function consumeRecoveryCode(codeId: string): Promise<void> {
  await prisma.adminRecoveryCode.update({
    where: { id: codeId },
    data: { consumedAt: new Date() },
  });
}
