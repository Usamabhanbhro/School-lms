import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Users,
  UserCheck,
  School,
  BookMarked,
  ClipboardCheck,
  Award,
  FileText,
  Banknote,
  ArrowRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Dashboard — Admin",
};

/**
 * Admin dashboard — answers "What is happening in this school?"
 * Uses real data from the database via server-side queries.
 */
export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/login");

  // Fetch real counts from the database
  const [
    totalStudents,
    totalTeachers,
    totalAcademics,
    totalClassSections,
    totalSubjects,
    activeTeachers,
  ] = await Promise.all([
    prisma.student.count(),
    prisma.user.count({ where: { role: "TEACHER" } }),
    prisma.user.count({ where: { role: "ACADEMICS" } }),
    prisma.classSection.count(),
    prisma.subject.count(),
    prisma.user.count({ where: { role: "TEACHER", isActive: true } }),
  ]);

  // Quick action links
  const quickActions = [
    { label: "Add Student", href: "/admin/students", icon: Users },
    { label: "Add Teacher", href: "/admin/teachers", icon: UserCheck },
    { label: "Manage Classes", href: "/admin/classes", icon: School },
    { label: "Mark Attendance", href: "/admin/attendance", icon: ClipboardCheck },
    { label: "School Settings", href: "/admin/settings", icon: School },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${session.user.name ?? "Admin"}.`}
      />

      {/* Stats grid */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={Users}
          label="Students"
          value={totalStudents}
          href="/admin/students"
        />
        <StatCard
          icon={UserCheck}
          label="Teachers"
          value={totalTeachers}
          detail={`${activeTeachers} active`}
          href="/admin/teachers"
        />
        <StatCard
          icon={Users}
          label="Academics Staff"
          value={totalAcademics}
          href="/admin/academics"
        />
        <StatCard
          icon={School}
          label="Class Sections"
          value={totalClassSections}
          href="/admin/classes"
        />
        <StatCard
          icon={BookMarked}
          label="Subjects"
          value={totalSubjects}
          href="/admin/subjects"
        />
        <StatCard
          icon={ClipboardCheck}
          label="Attendance"
          value={null}
          detail="View & override"
          href="/admin/attendance"
        />
      </div>

      {/* Quick actions */}
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

// ─── Stat Card ──────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: number | null;
  detail?: string;
  href: string;
}) {
  return (
    <Link href={href}>
      <Card className="flex items-start gap-4 p-4 transition-colors hover:bg-surface">
        <span className="flex size-10 shrink-0 items-center justify-center border border-border bg-surface">
          <Icon className="size-5 text-text/50" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-text/50">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">
            {value !== null ? value : "—"}
          </p>
          {detail && (
            <p className="mt-0.5 text-xs text-text/50">{detail}</p>
          )}
        </div>
      </Card>
    </Link>
  );
}
