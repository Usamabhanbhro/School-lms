import { cn } from "@/lib/utils";

/**
 * Skeleton must be sized to match the real content it stands in for
 * (table rows for a table, card blocks for a card) — never generic grey bars.
 *
 * Uses a left-to-right shimmer sweep (~1.6s loop) rather than a generic pulse,
 * per DESIGN.md motion spec. Respects prefers-reduced-motion via the global
 * CSS rule that sets animation-duration to 0.01ms.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("bg-surface", className)}
      style={{
        backgroundImage:
          "linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.04) 40%, rgba(0,0,0,0.04) 60%, transparent 100%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.6s ease-in-out infinite",
      }}
    />
  );
}

/**
 * Table loading skeleton that renders a header bar and ruled rows,
 * matching real ledger/table layouts and avoiding jarring layout shift.
 */
export function TableSkeleton({
  rows = 5,
  columns = 4,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={cn("border border-border bg-bg overflow-hidden", className)}>
      <div className="border-b border-border bg-surface px-4 py-3 flex items-center gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1 max-w-[140px]" />
        ))}
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="px-4 py-3.5 flex items-center gap-4">
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton
                key={c}
                className={cn(
                  "h-4 flex-1",
                  c === 0 ? "max-w-[180px]" : c === columns - 1 ? "max-w-[80px]" : "max-w-[120px]",
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

