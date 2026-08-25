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
import { NeedsAttention, needsAttentionIcons, type NeedsAttentionItem } from "@/components/dashboard/needs-attention";
import { getTodayLocal } from "@/lib/timezone";

export const metadata: Metadata = {
  title: "Dashboard",
};

/**
 * Admin dashboard — answers "What is happening in this school?"
 * Uses real data from the database via server-side queries.
 */
export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/login");

  // Fetch real counts and operational signals from the database.
  const today = getTodayLocal();
  const todayDate = new Date(`${today}T00:00:00.000Z`);
  const yesterdayDate = new Date(todayDate.getTime() - 24 * 60 * 60 * 1000);
  const [
    totalStudents,
    totalTeachers,
    totalAcademics,
    totalClassSections,
    totalSubjects,
    activeTeachers,
    unassignedClassSections,
    studentsMissingAttendance,
    teachersMissingAttendance,
    teachersMissingSalarySetup,
    yesterdayDraftAttendance,
  ] = await Promise.all([
    prisma.student.count({ where: { isActive: true } }),
    prisma.user.count({ where: { role: "TEACHER" } }),
    prisma.user.count({ where: { role: "ACADEMICS" } }),
    prisma.classSection.count(),
    prisma.subject.count(),
    prisma.user.count({ where: { role: "TEACHER", isActive: true } }),
    prisma.classSection.findMany({
      where: { classTeacherAssignments: { none: { isActive: true } } },
      select: { id: true },
    }),
    prisma.student.count({
      where: {
        isActive: true,
        attendance: { none: { date: todayDate } },
      },
    }),
    prisma.teacherProfile.count({
      where: {
        user: { isActive: true },
        teacherAttendanceRecords: { none: { date: todayDate } },
      },
    }),
    prisma.teacherProfile.count({
      where: { user: { isActive: true }, perDaySalary: null },
    }),
    prisma.studentAttendance.count({
      where: { date: yesterdayDate, isConfirmed: false },
    }),
  ]);

  const totalUsers = totalTeachers + totalAcademics;
  const needsAttentionItems: NeedsAttentionItem[] = [];
  if (unassignedClassSections.length > 0) {
    needsAttentionItems.push({
      id: "unassigned-class-teachers",
      title: "Class sections need a Class Teacher",
      detail: `${unassignedClassSections.length} class section${unassignedClassSections.length === 1 ? " is" : "s are"} missing an active Class Teacher assignment.`,
      href: "/admin/classes",
      icon: needsAttentionIcons.classTeacher,
    });
  }
  if (studentsMissingAttendance > 0) {
    needsAttentionItems.push({
      id: "missing-student-attendance",
      title: "Student attendance is incomplete",
      detail: `${studentsMissingAttendance} active student${studentsMissingAttendance === 1 ? " has" : "s have"} no attendance record for today.`,
      href: "/admin/attendance",
      icon: needsAttentionIcons.attendance,
    });
  }
  if (teachersMissingAttendance > 0) {
    needsAttentionItems.push({
      id: "missing-teacher-attendance",
      title: "Teacher attendance is incomplete",
      detail: `${teachersMissingAttendance} active teacher${teachersMissingAttendance === 1 ? " has" : "s have"} no attendance record for today.`,
      href: "/admin/teacher-attendance",
      icon: needsAttentionIcons.attendance,
    });
  }
  if (yesterdayDraftAttendance > 0) {
    needsAttentionItems.push({
      id: "draft-attendance",
      title: "Attendance drafts need confirmation",
      detail: `${yesterdayDraftAttendance} student attendance record${yesterdayDraftAttendance === 1 ? " is" : "s are"} still unconfirmed from yesterday.`,
      href: "/admin/attendance",
      icon: needsAttentionIcons.warning,
    });
  }
  if (teachersMissingSalarySetup > 0) {
    needsAttentionItems.push({
      id: "salary-setup",
      title: "Salary setup is incomplete",
      detail: `${teachersMissingSalarySetup} active teacher${teachersMissingSalarySetup === 1 ? " is" : "s are"} missing a per-day salary rate.`,
      href: "/admin/teachers",
      icon: needsAttentionIcons.salary,
    });
  }

  // Quick action links
  const quickActions = [
    { label: "Add Student", href: "/admin/students", icon: Users },
    { label: "Manage Users", href: "/admin/teachers", icon: UserCheck },
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
          label="Users"
          value={totalUsers}
          detail={`${totalTeachers} teachers, ${totalAcademics} academics`}
          href="/admin/teachers"
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

      <NeedsAttention items={needsAttentionItems} />

      {/* Quick actions */}
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-text/60">
        Quick Actions
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {quickActions.map(({ label, href, icon: Icon }) => (
          <Link key={href} href={href}>
            <Card className="flex items-center gap-3 p-4 transition-colors hover:bg-surface">
              <span className="flex size-10 shrink-0 items-center justify-center border border-border bg-surface">
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
