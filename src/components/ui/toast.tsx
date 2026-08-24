"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const TOAST_DURATION_MS = 4000;

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
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), TOAST_DURATION_MS);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, dismissToast };
}

/**
 * Single toast with animated progress bar that drains over TOAST_DURATION_MS.
 * The bar width is driven by a CSS animation rather than JS interval for
 * smooth, jank-free rendering.
 */
function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss?: (id: number) => void;
}) {
  const accentColor = toast.type === "success" ? "bg-success" : "bg-danger";
  const barColor = toast.type === "success" ? "bg-success/40" : "bg-danger/40";

  return (
    <div
      className={cn(
        "relative flex items-center gap-2 overflow-hidden border text-sm font-medium",
        toast.type === "success"
          ? "border-success/30 bg-success/10 text-success"
          : "border-danger/30 bg-danger/10 text-danger",
      )}
      role="status"
    >
      {/* Left accent bar */}
      <div className={cn("absolute inset-y-0 left-0 w-1 shrink-0", accentColor)} />

      <div className="flex flex-1 items-center gap-2 pl-3 pr-4 py-3">
        {toast.type === "success" ? (
          <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
        ) : (
          <XCircle className="size-4 shrink-0" aria-hidden="true" />
        )}
        <span className="flex-1">{toast.message}</span>
        {onDismiss && (
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            className="inline-flex size-8 shrink-0 items-center justify-center text-current opacity-60 transition-opacity duration-150 hover:bg-current/10 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current motion-reduce:transition-none"
            aria-label="Dismiss notification"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Progress bar — CSS animation drains from 100% to 0% over TOAST_DURATION_MS */}
      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-current/10">
        <div
          className={cn("h-full origin-left", barColor)}
          style={{
            animation: `toast-progress ${TOAST_DURATION_MS}ms linear forwards`,
          }}
        />
      </div>
    </div>
  );
}

/**
 * Toast container — render at the top of any page that uses useToast().
 * Renders toasts in the top-right corner per DESIGN.md (square, left accent bar, progress bar).
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
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
