"use client";

/**
 * Client component for the print toolbar button.
 * Separated from the print layout because server components cannot
 * contain event handlers (onClick).
 */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-8 items-center gap-1 border border-border bg-bg px-3 text-xs font-medium text-text hover:bg-surface"
    >
      Print
    </button>
  );
}
