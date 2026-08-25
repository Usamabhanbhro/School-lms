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
