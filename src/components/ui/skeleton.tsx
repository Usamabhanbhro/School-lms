import { cn } from "@/lib/utils";

/**
 * Skeleton must be sized to match the real content it stands in for
 * (table rows for a table, card blocks for a card) — never generic grey bars.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse bg-surface", className)} />;
}
