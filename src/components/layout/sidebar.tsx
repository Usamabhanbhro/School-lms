"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  Menu,
  Settings,
  Users,
  UserCheck,
  X,
  School,
  BookMarked,
  Award,
  Banknote,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Role } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { GlobalSearch } from "@/components/layout/global-search";

// ─── Navigation structure ─────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const adminNav: NavItem[] = [
  { label: "Students", href: "/admin/students", icon: Users },
  { label: "Users", href: "/admin/teachers", icon: UserCheck },
  { label: "Classes", href: "/admin/classes", icon: School },
  { label: "Subjects", href: "/admin/subjects", icon: BookMarked },
  { label: "Attendance", href: "/admin/attendance", icon: ClipboardCheck },
  { label: "Teacher Attendance", href: "/admin/teacher-attendance", icon: ClipboardCheck },
  { label: "Tests & Marks", href: "/admin/tests", icon: FileSpreadsheet },
  { label: "Report Cards", href: "/admin/report-cards", icon: Award },
  { label: "Daily Agenda", href: "/admin/agenda", icon: CalendarDays },
  { label: "Certificates", href: "/admin/certificates", icon: FileText },
  { label: "Fees", href: "/admin/fees", icon: Banknote },
  { label: "Fee Ledger", href: "/admin/fee-ledger", icon: Banknote },
  { label: "Salary Slips", href: "/admin/salary-slips", icon: Banknote },
  { label: "Templates", href: "/admin/templates", icon: LayoutTemplate },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

const teacherNav: NavItem[] = [
  { label: "Attendance", href: "/teacher/attendance", icon: ClipboardCheck },
  { label: "Tests & Marks", href: "/teacher/tests", icon: FileSpreadsheet },
  { label: "Report Cards", href: "/teacher/report-cards", icon: Award },
  { label: "Daily Agenda", href: "/teacher/agenda", icon: CalendarDays },
];

/**
 * Academics staff — delegated certificate & fee challan generation;
 * read-only oversight of students, attendance, marks, report cards.
 * Based on SRS v5 ACADEMICS permissions (§1A).
 */
const academicsNav: NavItem[] = [
  { label: "Certificates", href: "/admin/certificates", icon: FileText },
  { label: "Fees", href: "/admin/fees", icon: Banknote },
  { label: "Fee Ledger", href: "/admin/fee-ledger", icon: Banknote },
  { label: "Salary Slips", href: "/admin/salary-slips", icon: Banknote },
  { label: "Students", href: "/admin/students", icon: Users },
  { label: "Attendance", href: "/admin/attendance", icon: ClipboardCheck },
  { label: "Teacher Attendance", href: "/admin/teacher-attendance", icon: ClipboardCheck },
  { label: "Tests & Marks", href: "/admin/tests", icon: FileSpreadsheet },
  { label: "Report Cards", href: "/admin/report-cards", icon: Award },
];

function getNavForRole(role: Role): NavItem[] {
  switch (role) {
    case "ADMIN":
      return adminNav;
    case "TEACHER":
      return teacherNav;
    case "ACADEMICS":
      return academicsNav;
    default:
      return [];
  }
}

// ─── Helper: check if nav item is active ─────────────────────────

function isActive(href: string, pathname: string): boolean {
  // Exact match for top-level routes like /admin/teachers
  // Also match sub-routes like /admin/teachers/123
  if (href === "/admin" || href === "/teacher" || href === "/admin/academics") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(href + "/");
}

// ─── Sidebar Component ──────────────────────────────────────────

export function Sidebar({
  role,
  name,
  schoolName,
  logoPath,
}: {
  role: Role;
  name: string;
  schoolName: string;
  logoPath: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const home =
    role === "ADMIN"
      ? "/admin/dashboard"
      : role === "TEACHER"
        ? "/teacher"
        : "/admin/academics";
  const navItems = getNavForRole(role);

  const handleSignOut = useCallback(async () => {
    await signOut({ redirect: false });
    router.push("/login");
  }, [router]);

  // ─── Nav content (shared between mobile and desktop) ──────────

  const navContent = (
    <>
      {/* Masthead */}
      <Link
        href={home}
        className="flex items-center gap-3 border-b border-border px-4 py-4"
        onClick={() => setMobileOpen(false)}
      >
        <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden">
          {logoPath ? (
            <img src={logoPath} alt={`${schoolName ?? "School"} logo`} className="size-14 object-contain" />
          ) : (
            <GraduationCap className="size-8" aria-hidden="true" />
          )}
        </span>
        <span className="min-w-0 text-sm font-semibold leading-tight">
          {schoolName || "School LMS"}
        </span>
      </Link>

      {/* Single school-data search entry point for roles with school-wide oversight */}
      {(role === "ADMIN" || role === "ACADEMICS") && <GlobalSearch />}

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3" aria-label="Main navigation">
        {/* Dashboard link */}
        <Link
          href={home}
          onClick={() => setMobileOpen(false)}
          className={cn(
            "flex items-center gap-3 border-l-2 px-3 py-2 text-sm transition-colors duration-150",
            pathname === home
              ? "border-primary bg-surface font-medium text-text"
              : "border-transparent text-text/70 hover:border-text/20 hover:bg-surface hover:text-text",
          )}
          aria-current={pathname === home ? "page" : undefined}
        >
          <LayoutDashboard className="size-4" aria-hidden="true" />
          Dashboard
        </Link>

        {/* Role-specific nav items */}
        {navItems.map(({ label, href, icon: Icon }) => {
          const active = isActive(href, pathname);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 border-l-2 px-3 py-2 text-sm transition-colors duration-150",
                active
                  ? "border-primary bg-surface font-medium text-text"
                  : "border-transparent text-text/70 hover:border-text/20 hover:bg-surface hover:text-text",
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer: credit + user menu */}
      <div className="border-t border-border">
        {/* User menu */}
        <div className="relative px-2 pt-2">
          <button
            type="button"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex w-full items-center gap-3 px-3 py-2 text-sm text-text/70 hover:bg-surface"
            aria-expanded={userMenuOpen}
            aria-haspopup="true"
          >
            <span className="flex size-6 shrink-0 items-center justify-center border border-border bg-surface text-xs font-semibold uppercase text-text/50">
              {name?.charAt(0) ?? "A"}
            </span>
            <span className="min-w-0 flex-1 truncate text-left">{name || "Admin"}</span>
            <span className="text-xs uppercase text-text/40">{role}</span>
          </button>

          {userMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setUserMenuOpen(false)}
              />
              <div className="absolute bottom-full left-2 right-2 z-50 mb-1 border border-border bg-bg shadow-sm" style={{ animation: "dropdown-fade-in 150ms ease-out both" }}>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-text/70 hover:bg-surface hover:text-text"
                >
                  <LogOut className="size-4" aria-hidden="true" />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>

        {/* Credit — keep intact per AGENTS.md */}
        <div className="px-4 py-3 text-xs text-text/40">
          Developed by Usama Bhanbhro
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* ─── Mobile header ─────────────────────────────────────── */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-bg px-4 py-3 md:hidden">
        <Link href={home} className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden">
            {logoPath ? (
              <img src={logoPath} alt={`${schoolName ?? "School"} logo`} className="size-10 object-contain" />
            ) : (
              <GraduationCap className="size-6" aria-hidden="true" />
            )}
          </span>
          {schoolName || "School LMS"}
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="inline-flex size-8 items-center justify-center border border-transparent text-text/60 hover:bg-surface"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? (
            <X className="size-5" aria-hidden="true" />
          ) : (
            <Menu className="size-5" aria-hidden="true" />
          )}
        </button>
      </header>

      {/* ─── Mobile drawer ─────────────────────────────────────── */}
      {mobileOpen && (
        <>
          {/* Backdrop / scrim — fades in */}
          <div
            className="fixed inset-0 z-30 bg-black/40 md:hidden"
            style={{ animation: "scrim-fade-in 150ms ease-out both" }}
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer — slides in from the right edge */}
          <aside
            className="fixed inset-y-0 right-0 z-40 flex w-64 flex-col border-l border-border bg-bg md:hidden"
            style={{ animation: "drawer-slide-in 200ms ease-out both" }}
          >
            {navContent}
          </aside>
        </>
      )}

      {/* ─── Desktop sidebar ───────────────────────────────────── */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-border bg-bg md:flex">
        {navContent}
      </aside>
    </>
  );
}
