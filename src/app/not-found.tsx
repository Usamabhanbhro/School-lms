import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";

/**
 * Generic not-found state for the foundation shell, per DESIGN.md (plain,
 * instructional, no illustrations). Not feature-specific — the SRS decides
 * what content the app eventually ships.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
        <span className="flex size-8 items-center justify-center border border-border bg-surface">
          <GraduationCap className="size-4" aria-hidden="true" />
        </span>
        School LMS
      </Link>
      <div className="mt-8 w-full max-w-sm border border-border bg-bg p-8 text-center">
        <h1 className="text-xl font-bold">Page not found</h1>
        <p className="mt-2 text-sm text-text/60">
          The page you are looking for does not exist or has moved.
        </p>
        <Link href="/" className={buttonClasses("primary", "mt-6 w-full")}>
          Back to home
        </Link>
      </div>
    </div>
  );
}
