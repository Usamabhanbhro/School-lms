/**
 * Simple in-memory rate limiter for public API endpoints.
 *
 * Suitable for single-instance deployments (Vercel serverless functions
 * each have their own memory, but rate limiting still helps against
 * rapid repeated requests within a single function invocation).
 *
 * For multi-instance deployments, consider a Redis-backed solution.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}, 60_000); // Clean up every minute

/**
 * Check and increment rate limit for a given key.
 *
 * @param key - Unique identifier (e.g. IP address or endpoint+IP)
 * @param limit - Maximum requests allowed in the window
 * @param windowMs - Time window in milliseconds
 * @returns { allowed: boolean, remaining: number, resetAt: number }
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    // New window
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (entry.count >= limit) {
    // Rate limited
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  // Increment
  entry.count++;
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

/**
 * Get client IP from request headers.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

// Pre-configured rate limits for public endpoints
export const PUBLIC_ENDPOINT_LIMITS = {
  /** Admin signup: 3 attempts per 15 minutes per IP */
  adminSignup: { limit: 3, windowMs: 15 * 60 * 1000 },
  /** Admin recovery: 5 attempts per 15 minutes per IP */
  adminRecover: { limit: 5, windowMs: 15 * 60 * 1000 },
  /** Admin recovery code generation: 3 attempts per 15 minutes per IP */
  adminRecoverCode: { limit: 3, windowMs: 15 * 60 * 1000 },
} as const;
