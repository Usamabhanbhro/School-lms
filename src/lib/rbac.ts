import type { Session } from "next-auth";
import type { Role } from "@/generated/prisma/enums";

/**
 * Error carrying an HTTP status + machine-readable code, matching the
 * `{ error: { message, code } }` response shape from CONVENTIONS.md.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const roleHomes: Record<Role, string> = {
  ADMIN: "/admin",
  TEACHER: "/teacher",
  STUDENT: "/student",
  PARENT: "/parent",
};

export function roleHome(role: Role): string {
  return roleHomes[role];
}

/**
 * RBAC check for API routes. Throws ApiError (401/403) when the session role
 * is missing or not allowed — every API route must use this, per AGENTS.md.
 */
export function requireRole(session: Session | null, allowed: readonly Role[]): Session {
  if (!session?.user) {
    throw new ApiError(401, "UNAUTHENTICATED", "Sign in to continue.");
  }
  if (!allowed.includes(session.user.role)) {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission to perform this action.");
  }
  return session;
}
