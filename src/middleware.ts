import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * In-memory rate limiter for login brute-force protection.
 * Applied to POST /api/auth/callback/credentials (NextAuth's internal login endpoint).
 *
 * Limit: 5 attempts per 15 minutes per IP.
 * Matches the pattern used in src/lib/rate-limit.ts for other public endpoints.
 * Known limitation: counters are per serverless function instance (same as admin signup/recovery).
 */
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const LOGIN_LIMIT = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function checkLoginRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return { allowed: true, remaining: LOGIN_LIMIT - 1 };
  }

  if (entry.count >= LOGIN_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: LOGIN_LIMIT - entry.count };
}

// Clean up expired entries every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of loginAttempts) {
    if (now > entry.resetAt) loginAttempts.delete(key);
  }
}, 60_000);

export function middleware(request: NextRequest) {
  // Only rate-limit POST to the NextAuth credentials callback (actual login attempts)
  if (
    request.method === "POST" &&
    request.nextUrl.pathname === "/api/auth/callback/credentials"
  ) {
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0].trim() : request.headers.get("x-real-ip") ?? "unknown";

    const { allowed } = checkLoginRateLimit(ip);
    if (!allowed) {
      return NextResponse.json(
        { error: { message: "Too many login attempts. Please try again later.", code: "RATE_LIMITED" } },
        { status: 429 },
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/auth/callback/credentials"],
};
