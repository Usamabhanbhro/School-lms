import Link from "next/link";
import {
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Megaphone,
  Settings,
  Users,
} from "lucide-react";
import type { Role } from "@/generated/prisma/enums";
import { roleHomes } from "@/lib/rbac";

/**
 * Per-role navigation modules.
 * Active modules are wired to routes; planned modules are visually disabled.
 */
const adminNav = [
  { label: "Users", href: "/admin", icon: Users },
  { label: "Attendance", href: "/admin/attendance", icon: ClipboardCheck },
  { label: "Teacher Attendance", href: "/admin/teacher-attendance", icon: ClipboardCheck },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

const teacherNav = [
  { label: "Attendance", href: "/teacher/attendance", icon: ClipboardCheck },
];

const plannedModules = [
  { label: "Gradebook", icon: BookOpen },
  { label: "Assignments", icon: FileText },
  { label: "Timetable", icon: CalendarDays },
  { label: "Announcements", icon: Megaphone },
];

function getNavForRole(role: Role) {
  switch (role) {
    case "ADMIN":
      return adminNav;
    case "TEACHER":
      return teacherNav;
    default:
      return [];
  }
}

export function Sidebar({ role, name }: { role: Role; name: string }) {
  const home = roleHomes[role];
  const navItems = getNavForRole(role);

  return (
    <>
      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-bg px-4 py-4 md:hidden">
        <Link href={home} className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex size-8 items-center justify-center border border-border bg-surface">
            <GraduationCap className="size-4" aria-hidden="true" />
          </span>
          School LMS
        </Link>
        <span className="text-xs font-medium uppercase tracking-wide text-text/50">{role}</span>
      </header>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-border bg-bg md:flex">
        {/* Masthead */}
        <Link href={home} className="flex items-center gap-2 border-b border-border px-4 py-4">
          <span className="flex size-8 shrink-0 items-center justify-center border border-border bg-surface">
            <GraduationCap className="size-4" aria-hidden="true" />
          </span>
          <span className="text-sm font-semibold leading-tight">
            School LMS
            <span className="block text-xs font-normal text-text/50">{name}</span>
          </span>
        </Link>

        {/* Nav — binder-tab dividers per DESIGN.md */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4" aria-label="Main navigation">
          <Link
            href={home}
            className="flex items-center gap-2 border-l-2 border-primary bg-surface px-4 py-2 text-sm font-medium text-text"
          >
            <LayoutDashboard className="size-4" aria-hidden="true" />
            Dashboard
          </Link>

          {navItems.map(({ label, href, icon: Icon }) => (
            <Link
              key={label}
              href={href}
              className="flex items-center gap-2 border-l-2 border-transparent px-4 py-2 text-sm text-text/70 hover:border-text/20 hover:bg-surface hover:text-text"
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </Link>
          ))}

          {plannedModules.map(({ label, icon: Icon }) => (
            <span
              key={label}
              className="flex items-center gap-2 border-l-2 border-transparent px-4 py-2 text-sm text-text/50"
              aria-disabled="true"
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
              <span className="ml-auto text-xs font-medium uppercase tracking-wide text-text/30">planned</span>
            </span>
          ))}
        </nav>

        {/* Footer credit — keep intact per AGENTS.md */}
        <div className="border-t border-border px-4 py-4 text-xs text-text/40">Developed by Usama Bhanbhro</div>
      </aside>
    </>
  );
}
