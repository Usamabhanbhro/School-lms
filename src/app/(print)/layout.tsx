import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSchoolSettings } from "@/lib/school-settings";

/**
 * Print layout — minimal wrapper for printable documents.
 *
 * No sidebar, no navigation, no dashboard chrome.
 * Only authenticates the session; all visual structure lives in
 * individual print page components.
 *
 * The `print:hidden` class on the screen-only header ensures
 * interactive controls are hidden during printing.
 */
export default async function PrintLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }

  const school = await getSchoolSettings();

  return (
    <div className="min-h-screen bg-bg text-text">
      {/* Screen-only toolbar — hidden during printing */}
      <header className="print:hidden border-b border-border">
        <div className="mx-auto flex h-12 max-w-5xl items-center justify-between px-4 text-xs text-text/50 md:px-8">
          <span className="font-medium">{school.schoolName} — Print Preview</span>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex h-8 items-center gap-1 border border-border bg-bg px-3 text-xs font-medium text-text hover:bg-surface"
          >
            Print
          </button>
        </div>
      </header>
      <main className="print:mx-0 print:p-0 mx-auto max-w-5xl px-4 py-8 md:px-8">
        {children}
      </main>
    </div>
  );
}
