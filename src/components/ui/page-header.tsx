import type { ReactNode } from "react";

/**
 * Consistent page header pattern for all authenticated pages.
 * Follows DESIGN.md typography: page title 700 weight, 24–28px;
 * description 400 weight, 14–16px, muted.
 *
 * @param title - Page title (rendered as h1)
 * @param description - Optional subtitle/description
 * @param actions - Optional action buttons rendered on the right
 */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-text/60">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
