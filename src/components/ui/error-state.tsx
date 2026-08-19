import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Consistent error state with optional retry action.
 * Per DESIGN.md: "interface voice, not personified.
 * State what happened and how to fix it."
 */
export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      className="flex items-start gap-2 border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
      role="alert"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <Button
          variant="ghost"
          onClick={onRetry}
          className="h-8 shrink-0 px-2 text-xs"
        >
          Retry
        </Button>
      )}
    </div>
  );
}
