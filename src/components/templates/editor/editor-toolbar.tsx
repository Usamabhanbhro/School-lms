"use client";

import { Loader2, Redo2, Save, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EditorToolbarProps {
  title: string;
  canUndo: boolean;
  canRedo: boolean;
  saving: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onClose: () => void;
}

export function EditorToolbar({
  title,
  canUndo,
  canRedo,
  saving,
  onUndo,
  onRedo,
  onSave,
  onClose,
}: EditorToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2">
      <div>
        <h2 className="text-sm font-semibold text-text">
          Edit Fields — {title}
        </h2>
        <p className="text-xs text-text/60">
          Add fields from the left palette, drag to position, edit properties on
          the right.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center border border-border bg-bg">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className="flex size-8 items-center justify-center border-r border-border text-text/60 transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:text-text/30"
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
          >
            <Undo2 className="size-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            className="flex size-8 items-center justify-center text-text/60 transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:text-text/30"
            title="Redo (Ctrl+Y)"
            aria-label="Redo"
          >
            <Redo2 className="size-3.5" aria-hidden="true" />
          </button>
        </div>
        <Button size="sm" variant="secondary" type="button" onClick={onClose}>
          <X className="size-3.5" aria-hidden="true" />
          Cancel
        </Button>
        <Button
          size="sm"
          variant="primary"
          type="button"
          onClick={onSave}
          disabled={saving}
        >
          {saving ? (
            <>
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              Saving…
            </>
          ) : (
            <>
              <Save className="size-3.5" aria-hidden="true" />
              Save Positions
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
