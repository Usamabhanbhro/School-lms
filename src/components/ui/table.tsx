import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Table density modes per DESIGN.md:
 * - compact: admin desktop views (attendance registers, gradebooks)
 * - comfortable: teacher mobile views (larger tap targets)
 */
export type TableDensity = "compact" | "comfortable";

/**
 * Ruled-table primitives (ledger/roll-call feel per DESIGN.md). Numeric
 * columns should add `tabular-nums` at the call site.
 *
 * Pass `density` on the <Table> element to cascade padding to all cells.
 */
export function Table({
  density = "compact",
  className,
  ...props
}: HTMLAttributes<HTMLTableElement> & { density?: TableDensity }) {
  return (
    <table
      className={cn(
        "w-full border-collapse text-sm",
        // Cascade density padding to th/td descendants
        density === "comfortable"
          ? "[*:where(th,td)]:px-4 [*:where(th,td)]:py-3"
          : "[*:where(th,td)]:px-3 [*:where(th,td)]:py-1.5",
        className,
      )}
      {...props}
    />
  );
}

export function THead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn("border-b border-border bg-surface text-left text-xs font-semibold uppercase tracking-wide text-text/60", className)}
      {...props}
    />
  );
}

export function TBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-y divide-border", className)} {...props} />;
}

export function TR({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("transition-colors duration-150 ease-out hover:bg-surface/60", className)} {...props} />;
}

export function TH({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("font-semibold", className)} {...props} />;
}

export function TD({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("align-middle", className)} {...props} />;
}
