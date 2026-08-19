import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "success" | "danger" | "primary" | "neutral";

const variantStyles: Record<BadgeVariant, string> = {
  success: "border-success/30 bg-success/10 text-success",
  danger: "border-danger/30 bg-danger/10 text-danger",
  primary: "border-primary/30 bg-primary/10 text-primary",
  neutral: "border-border bg-surface text-text/60",
};

/**
 * Inline badge for status indicators.
 * Per DESIGN.md: pair color with an icon or shape for accessibility.
 * Never rely on color alone.
 */
export function Badge({
  variant = "neutral",
  icon,
  children,
  className,
}: {
  variant?: BadgeVariant;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 border px-2 py-0.5 text-xs font-medium",
        variantStyles[variant],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
