import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ClipboardCheck,
  CalendarDays,
  FileSpreadsheet,
  Award,
  ArrowRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { roleHome } from "@/lib/rbac";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "Teacher",
};

const quickActions = [
  { label: "Mark Attendance", href: "/teacher/attendance", icon: ClipboardCheck },
  { label: "Tests & Marks", href: "/teacher/tests", icon: FileSpreadsheet },
  { label: "Report Cards", href: "/teacher/report-cards", icon: Award },
  { label: "Daily Agenda", href: "/teacher/agenda", icon: CalendarDays },
];

export default async function TeacherPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "TEACHER") redirect(roleHome(session.user.role));

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${session.user.name ?? "Teacher"}.`}
      />

      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-text/60">
        Quick Actions
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {quickActions.map(({ label, href, icon: Icon }) => (
          <Link key={href} href={href}>
            <Card className="flex items-center gap-3 p-4 transition-colors hover:bg-surface">
              <span className="flex size-9 shrink-0 items-center justify-center border border-border bg-surface">
                <Icon className="size-4 text-text/60" aria-hidden="true" />
              </span>
              <span className="flex-1 text-sm font-medium">{label}</span>
              <ArrowRight className="size-4 text-text/30" aria-hidden="true" />
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
