import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  FileText,
  Banknote,
  Users,
  ClipboardCheck,
  FileSpreadsheet,
  Award,
  ArrowRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "Academics Dashboard",
};

/**
 * ACADEMICS landing page — delegated certificate & fee challan generation,
 * plus read-only oversight of students, attendance, marks, and report cards.
 *
 * Per SRS v5 §1A:
 * - Can: generate certificates, generate fee challans
 * - Can (read-only): student lists, attendance records, tests, marks, report cards
 * - Cannot: manage users, create/edit classes/subjects, assign teachers, edit bank settings
 */

interface QuickAction {
  label: string;
  href: string;
  icon: LucideIcon;
  category: "write" | "read";
}

const quickActions: QuickAction[] = [
  { label: "Certificates", href: "/admin/certificates", icon: FileText, category: "write" },
  { label: "Fees & Challans", href: "/admin/fees", icon: Banknote, category: "write" },
  { label: "Students", href: "/admin/students", icon: Users, category: "read" },
  { label: "Attendance", href: "/admin/attendance", icon: ClipboardCheck, category: "read" },
  { label: "Tests & Marks", href: "/admin/tests", icon: FileSpreadsheet, category: "read" },
  { label: "Report Cards", href: "/admin/report-cards", icon: Award, category: "read" },
];

export default async function AcademicsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN" && session.user.role !== "ACADEMICS") redirect("/login");

  return (
    <>
      <PageHeader
        title="Academics Dashboard"
        description={`Welcome back, ${session.user.name ?? "Staff"}. Generate certificates and fee challans, or review school records.`}
      />

      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-text/60">
        Quick Actions
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {quickActions.map(({ label, href, icon: Icon, category }) => (
          <Link key={href} href={href}>
            <Card className="flex items-center gap-3 p-4 transition-colors hover:bg-surface">
              <span className="flex size-9 shrink-0 items-center justify-center border border-border bg-surface">
                <Icon className="size-4 text-text/60" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{label}</span>
                <span className="text-xs text-text/40">
                  {category === "write" ? "Generate" : "Read-only"}
                </span>
              </div>
              <ArrowRight className="size-4 text-text/30" aria-hidden="true" />
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
