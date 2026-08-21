import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AdminSignupForm } from "@/components/admin/admin-signup-form";
import { buttonClasses } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Admin Setup",
};

// Must render per-request: whether an Admin exists changes at runtime, and a
// statically prerendered page would keep showing the signup form forever.
// `headers()` call below also guarantees dynamic rendering — no CDN cache
// can serve a stale "no admin" version after an admin has been created.
export const dynamic = "force-dynamic";

/**
 * Admin Signup Page — First Admin Provisioning
 *
 * Server component that checks whether an Admin already exists.
 * - State A (no Admin): shows the signup form
 * - State B (Admin exists): shows "already configured" message with link to login
 *
 * This ensures the onboarding screen is never shown after initial setup,
 * and the UI never exposes the form when registration would be rejected.
 */
export default async function AdminSignupPage() {
  // Touch headers() to guarantee dynamic rendering — prevents any CDN or
  // build-time cache from serving a stale page after an admin exists.
  await headers();

  // Check if any Admin user already exists
  const existingAdmin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
  });

  // State B — Admin already configured
  if (existingAdmin) {
    return (
      <div className="border border-border bg-bg p-8">
        <h1 className="text-xl font-bold">Admin Already Configured</h1>
        <p className="mt-2 text-sm text-text/60">
          This school already has an administrator account. If you need
          to recover your password, use the recovery code you received
          during initial setup.
        </p>

        <div className="mt-6 space-y-3">
          <Link href="/login" className={buttonClasses("primary", "w-full")}>
            Sign in
          </Link>
          <Link
            href="/admin/recover"
            className={buttonClasses("secondary", "w-full")}
          >
            Recover admin password
          </Link>
        </div>
      </div>
    );
  }

  // State A — No Admin exists, show onboarding form
  return <AdminSignupForm />;
}
