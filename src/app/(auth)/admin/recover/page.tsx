import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AdminRecoverForm } from "@/components/admin/admin-recover-form";
import { buttonClasses } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Admin Recovery",
};

/**
 * Admin Recovery Page — Self-service password recovery for locked-out Admin.
 *
 * Server component that checks whether an Admin exists.
 * - State A (Admin exists): shows the recovery form
 * - State B (no Admin): shows link to signup
 */
export default async function AdminRecoverPage() {
  const existingAdmin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
  });

  // State B — No Admin exists
  if (!existingAdmin) {
    return (
      <div className="border border-border bg-bg p-8">
        <h1 className="text-xl font-bold">No Admin Account</h1>
        <p className="mt-2 text-sm text-text/60">
          No administrator account has been created yet. Set up the first admin account first.
        </p>
        <div className="mt-6">
          <Link href="/admin/signup" className={buttonClasses("primary", "w-full")}>
            Set up admin account
          </Link>
        </div>
      </div>
    );
  }

  // State A — Admin exists, show recovery form
  return <AdminRecoverForm />;
}
