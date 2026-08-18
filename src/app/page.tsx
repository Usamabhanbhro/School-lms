import Link from "next/link";
import {
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Megaphone,
  Printer,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { buttonClasses } from "@/components/ui/button";

const modules = [
  {
    icon: ClipboardCheck,
    title: "Attendance",
    body: "Roll-call marking from any device — built for teachers marking attendance on the go.",
  },
  {
    icon: BookOpen,
    title: "Gradebooks",
    body: "Scores by assignment, exam, and term, with report cards that print cleanly.",
  },
  {
    icon: FileText,
    title: "Assignments",
    body: "Post work to a class, collect submissions, and grade them in one place.",
  },
  {
    icon: CalendarDays,
    title: "Timetables",
    body: "Weekly schedules per class, subject, and teacher.",
  },
  {
    icon: Megaphone,
    title: "Announcements",
    body: "Notices scoped to the whole school or a single class.",
  },
  {
    icon: Printer,
    title: "Reports & print",
    body: "Dedicated print stylesheets for attendance registers and report cards.",
  },
];

const roles = [
  { icon: ShieldCheck, name: "Admin", body: "School setup, teacher management, class/subject assignment, and reporting." },
  { icon: UserCheck, name: "Teacher", body: "Attendance, tests, marks, and report cards — scoped to assigned classes." },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 md:px-8">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex size-8 items-center justify-center border border-border bg-surface">
              <GraduationCap className="size-4" aria-hidden="true" />
            </span>
            School LMS
          </span>
          <Link href="/login" className={buttonClasses("secondary")}>
            Sign in
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-border">
          <div className="mx-auto w-full max-w-5xl px-4 py-16 md:px-8 md:py-24">
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-text/50">
              School operations platform
            </p>
            <h1 className="max-w-2xl text-3xl font-bold leading-tight md:text-5xl">
              Attendance, grades, and timetables — one quiet system for your whole school.
            </h1>
            <p className="mt-4 max-w-xl text-base text-text/70 md:text-lg">
              A web-based learning management system for school admins and teachers.
              Fast on a phone for the classroom, comfortable on a desktop for the office.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/login" className={buttonClasses("primary")}>
                Sign in to your school
              </Link>
              <a href="#modules" className={buttonClasses("secondary")}>
                See the modules
              </a>
            </div>
          </div>
        </section>

        {/* Modules */}
        <section id="modules" className="border-b border-border">
          <div className="mx-auto w-full max-w-5xl px-4 py-16 md:px-8">
            <h2 className="text-2xl font-bold">Modules</h2>
            <p className="mt-2 text-sm text-text/60">
              Built incrementally on a shared skeleton — each module lands with its own
              role-aware routes, API endpoints, and print support.
            </p>
            <div className="mt-8 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
              {modules.map(({ icon: Icon, title, body }) => (
                <div key={title} className="flex flex-col gap-4 bg-bg p-6">
                  <span className="flex size-10 items-center justify-center border border-border bg-surface">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="text-base font-semibold">{title}</h3>
                  <p className="text-sm text-text/60">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Roles */}
        <section className="border-b border-border">
          <div className="mx-auto w-full max-w-5xl px-4 py-16 md:px-8">
            <h2 className="text-2xl font-bold">Built for Admin &amp; Teacher</h2>
            <p className="mt-2 text-sm text-text/60">
              Role-based access control at every API boundary; navigation adapts per role.
            </p>
            <div className="mt-8 grid gap-px border border-border bg-border sm:grid-cols-2">
              {roles.map(({ icon: Icon, name, body }) => (
                <div key={name} className="flex flex-col gap-4 bg-bg p-6">
                  <Icon className="size-5 text-text/60" aria-hidden="true" />
                  <h3 className="text-base font-semibold">{name}</h3>
                  <p className="text-sm text-text/60">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section>
          <div className="mx-auto w-full max-w-5xl px-4 py-16 md:px-8">
            <div className="flex flex-col items-start justify-between gap-6 border border-border p-8 md:flex-row md:items-center">
              <div>
                <h2 className="text-2xl font-bold">Ready to get started?</h2>
                <p className="mt-2 text-sm text-text/60">
                  Sign in with the credentials your school administrator gives you.
                </p>
              </div>
              <Link href="/login" className={buttonClasses("primary")}>
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-6 text-xs text-text/40 md:px-8">
          <span>School LMS</span>
          <span>Developed by Usama Bhanbhro</span>
        </div>
      </footer>
    </div>
  );
}
