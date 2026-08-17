import type { ReactNode } from "react";
import Link from "next/link";
import { GraduationCap } from "lucide-react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2 text-sm font-semibold">
        <span className="flex size-8 items-center justify-center border border-border bg-surface">
          <GraduationCap className="size-4" aria-hidden="true" />
        </span>
        School LMS
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
