"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Generic error boundary for the foundation shell. Interface voice per
 * DESIGN.md: states what happened and how to fix it, without product details.
 */
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm border border-border bg-bg p-8 text-center">
        <h1 className="text-xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-sm text-text/60">
          An unexpected error occurred while loading this page. Try again, or
          return to your dashboard.
        </p>
        <div className="mt-6 flex flex-col gap-4">
          <Button type="button" onClick={reset}>
            Try again
          </Button>
          {/* /dashboard is role-aware: signed-in users land on their workspace,
              anonymous users are redirected to /login. Linking to "/" instead
              dumped authenticated users onto the public landing page. */}
          <Link href="/dashboard" className="text-sm font-medium text-primary underline underline-offset-2">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
