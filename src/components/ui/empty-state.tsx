import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 border border-dashed border-border px-6 py-16 text-center",
        className,
      )}
    >
      {Icon ? (
        <div className="flex size-10 items-center justify-center border border-border bg-surface">
          <Icon className="size-5" aria-hidden="true" />
        </div>
      ) : null}
      <h3 className="text-base font-semibold">{title}</h3>
      {description ? <p className="max-w-md text-sm text-text/60">{description}</p> : null}
      {action}
    </div>
  );
}
