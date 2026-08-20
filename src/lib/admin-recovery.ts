import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "@/generated/prisma/client";

/** Number of hex characters in the plaintext recovery code. */
const CODE_BYTE_LENGTH = 32; // 64 hex characters = 256 bits of entropy

/**
 * Generate a cryptographically secure random recovery code.
 * Uses Node.js crypto.randomBytes (CSPRNG).
 *
 * The plaintext is returned — it must be displayed to the Admin exactly once.
 * 64 hex characters = 256 bits of randomness.
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
 * Verify a plaintext code against a bcrypt hash (timing-safe via bcrypt.compare).
 */
export async function verifyRecoveryCode(
  plaintext: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}

/**
 * Type alias for the Prisma transaction client.
 */
type TxClient = PrismaClient;

/**
 * Atomically create a new recovery code for the Admin, replacing any prior active code.
 *
 * Steps (all within a single transaction):
 *   1. Mark any existing active code as replaced
 *   2. Create a new recovery code record (hash only)
 *   3. Update User.recoveryCodeHash for quick lookup
 *   4. Return the plaintext code (shown once, never stored)
 *
 * The bcrypt hash is computed BEFORE entering the transaction to keep
 * the database transaction fast (bcrypt takes ~200ms).
 *
 * @param userId - The Admin user ID
 * @param tx - Optional Prisma transaction client. If provided, the operation
 *             runs within the caller's transaction. If omitted, a new transaction is used.
 */
export async function createRecoveryCode(
  userId: string,
  tx?: TxClient,
): Promise<string> {
  // Generate and hash BEFORE the transaction (bcrypt is slow)
  const plaintext = generateRecoveryCode();
  const codeHash = await hashRecoveryCode(plaintext);

  const run = async (client: TxClient) => {
    // 1. Mark any existing active code as replaced (consumedAt NULL, replacedAt NULL)
    await client.adminRecoveryCode.updateMany({
      where: {
        userId,
        consumedAt: null,
        replacedAt: null,
      },
      data: { replacedAt: new Date() },
    });

    // 2. Create the new recovery code record (no expiry — valid until used or regenerated)
    await client.adminRecoveryCode.create({
      data: {
        userId,
        codeHash,
      },
    });

    // 3. Keep User.recoveryCodeHash in sync for quick lookup during verification
    await client.user.update({
      where: { id: userId },
      data: { recoveryCodeHash: codeHash },
    });
  };

  if (tx) {
    // Run within the caller's existing transaction
    await run(tx);
  } else {
    // Wrap in our own transaction for atomicity
    await prisma.$transaction(async (client) => {
      await run(client as unknown as TxClient);
    });
  }

  return plaintext;
}

/**
 * Atomically consume the old recovery code, change the password, and generate
 * a fresh recovery code — all in one transaction.
 *
 * This is the safe pattern for POST /api/admin/recover:
 *   1. Mark old code as consumed
 *   2. Update password hash
 *   3. Mark any other active codes as replaced (safety net)
 *   4. Create new recovery code record
 *   5. Update User.recoveryCodeHash
 *
 * All operations are atomic: if any step fails, none persist.
 *
 * The bcrypt hashes for BOTH the old code verification and new code generation
 * are computed BEFORE the transaction to keep it fast.
 *
 * @returns The new plaintext recovery code (shown once to the Admin)
 */
export async function consumeAndRotate(
  userId: string,
  activeCodeId: string,
  newPasswordHash: string,
): Promise<string> {
  // Generate and hash the new recovery code BEFORE the transaction
  const newPlaintext = generateRecoveryCode();
  const newCodeHash = await hashRecoveryCode(newPlaintext);

  await prisma.$transaction(async (tx) => {
    // 1. Mark the old recovery code as consumed
    await tx.adminRecoveryCode.update({
      where: { id: activeCodeId },
      data: { consumedAt: new Date() },
    });

    // 2. Update the Admin's password
    await tx.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    // 3. Mark any other active codes as replaced (safety net)
    await tx.adminRecoveryCode.updateMany({
      where: {
        userId,
        consumedAt: null,
        replacedAt: null,
        id: { not: activeCodeId },
      },
      data: { replacedAt: new Date() },
    });

    // 4. Create the new recovery code record (no expiry — valid until used or regenerated)
    await tx.adminRecoveryCode.create({
      data: {
        userId,
        codeHash: newCodeHash,
      },
    });

    // 5. Update User.recoveryCodeHash for quick lookup
    await tx.user.update({
      where: { id: userId },
      data: { recoveryCodeHash: newCodeHash },
    });
  });

  return newPlaintext;
}

/**
 * Find the currently active recovery code record for a user.
 *
 * Active means:
 *   - consumedAt IS NULL
 *   - replacedAt IS NULL
 *
 * Returns null if no active code exists.
 * Codes have no time-based expiry — they remain valid until
 * used (consumed) or manually regenerated (replaced).
 */
export async function findActiveRecoveryCode(userId: string) {
  return prisma.adminRecoveryCode.findFirst({
    where: {
      userId,
      consumedAt: null,
      replacedAt: null,
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
