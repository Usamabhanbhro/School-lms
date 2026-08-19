"use client";

import { useCallback, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Toast {
  id: number;
  type: "success" | "error";
  message: string;
}

/**
 * Hook to manage toasts. Returns current toasts and helper functions.
 * Auto-dismisses after 4 seconds per DESIGN.md motion guidelines.
 */
export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: "success" | "error", message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, dismissToast };
}

/**
 * Toast container — render at the top of any page that uses useToast().
 * Renders toasts in the top-right corner per DESIGN.md (square, left accent bar).
 */
export function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss?: (id: number) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed right-4 top-4 z-50 flex flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "flex items-center gap-2 border px-4 py-3 text-sm font-medium",
            t.type === "success"
              ? "border-success/30 bg-success/10 text-success"
              : "border-danger/30 bg-danger/10 text-danger",
          )}
          role="status"
        >
          {t.type === "success" ? (
            <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
          ) : (
            <XCircle className="size-4 shrink-0" aria-hidden="true" />
          )}
          <span className="flex-1">{t.message}</span>
          {onDismiss && (
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              className="shrink-0 text-current opacity-50 hover:opacity-100"
              aria-label="Dismiss"
            >
              <XCircle className="size-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
