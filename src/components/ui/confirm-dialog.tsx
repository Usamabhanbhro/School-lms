"use client";

import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useEffect } from "react";

/**
 * Reusable confirmation dialog for destructive or irreversible actions.
 * Follows DESIGN.md: square corners, 1px borders, minimal, accessible.
 *
 * Renders as a modal overlay with proper ARIA attributes.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  icon: Icon = AlertTriangle,
  iconVariant = "danger",
  title,
  description,
  confirmLabel = "Confirm",
  confirmVariant = "danger",
  loading = false,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon?: LucideIcon;
  iconVariant?: "danger" | "primary";
  title: string;
  description?: string;
  confirmLabel?: string;
  confirmVariant?: "danger" | "primary";
  loading?: boolean;
  onConfirm: () => void;
  children?: React.ReactNode;
}) {
  // Escape key handling
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  const iconBg =
    iconVariant === "danger" ? "border-danger/20 bg-danger/10" : "border-primary/20 bg-primary/10";
  const iconColor = iconVariant === "danger" ? "text-danger" : "text-primary";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      style={{ animation: "overlay-fade-in 150ms ease-out both" }}
      onClick={() => onOpenChange(false)}
      onKeyDown={(e) => e.key === "Escape" && onOpenChange(false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <Card
        className="mx-4 w-full max-w-md p-6"
        style={{ animation: "dialog-scale-in 200ms ease-out both" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center gap-3">
          <div className={`flex size-10 shrink-0 items-center justify-center border ${iconBg}`}>
            <Icon className={`size-5 ${iconColor}`} aria-hidden="true" />
          </div>
          <div>
            <h3 id="confirm-dialog-title" className="text-base font-semibold">
              {title}
            </h3>
            {description && (
              <p className="text-sm text-text/60">{description}</p>
            )}
          </div>
        </div>

        {children && <div className="mb-6 text-sm text-text/70">{children}</div>}

        <div className="flex gap-3">
          <Button
            variant={confirmVariant}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {confirmLabel}
          </Button>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
        </div>
      </Card>
    </div>
  );
}
