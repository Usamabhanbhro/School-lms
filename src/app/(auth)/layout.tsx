import type { ReactNode } from "react";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { getSchoolSettings } from "@/lib/school-settings";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const school = await getSchoolSettings();
  const schoolName = school.schoolName && school.schoolName !== "[SCHOOL NAME]" ? school.schoolName : null;
  const logoPath = school.logoPath;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      {/* /dashboard is role-aware — signed-in visitors go to their workspace
          instead of the public landing page. */}
      <Link href="/dashboard" className="mb-8 flex items-center gap-3 text-sm font-semibold">
        <span className="flex size-16 items-center justify-center border border-border bg-surface overflow-hidden">
          {logoPath ? (
            <img src={logoPath} alt={`${schoolName ?? "School"} logo`} className="size-14 object-contain" />
          ) : (
            <GraduationCap className="size-8" aria-hidden="true" />
          )}
        </span>
        {schoolName || "School LMS"}
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
