"use client";

import { useState } from "react";
import { Plus, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EditorField } from "./types";

interface FieldPaletteProps {
  allFieldKeys: readonly string[];
  placedFields: EditorField[];
  hasTableRegion: boolean;
  tableRegionCount: number;
  onAddField: (fieldKey: string) => void;
  onAddStaticText: () => void;
  onAddTableRegion: () => void;
  onSelectField: (index: number) => void;
  selectedFieldIdx: number | null;
}

export function FieldPalette({
  allFieldKeys,
  placedFields,
  hasTableRegion,
  tableRegionCount,
  onAddField,
  onAddStaticText,
  onAddTableRegion,
  onSelectField,
  selectedFieldIdx,
}: FieldPaletteProps) {
  const [customKey, setCustomKey] = useState("");

  const placedKeys = new Set(placedFields.map((f) => f.fieldKey));
  const unplacedKeys = allFieldKeys.filter((k) => !placedKeys.has(k));

  function handleAddCustom() {
    const trimmed = customKey.trim();
    if (!trimmed) return;
    onAddField(trimmed);
    setCustomKey("");
  }

  return (
    <div className="flex w-64 shrink-0 flex-col overflow-y-auto border-r border-border bg-bg p-3">
      {/* Add Custom Field Input */}
      <div className="mb-4">
        <h3 className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-text/50">
          Add Custom Field
        </h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAddCustom();
          }}
          className="flex gap-1"
        >
          <input
            type="text"
            value={customKey}
            onChange={(e) => setCustomKey(e.target.value)}
            placeholder="Field variable name…"
            className="block w-full border border-border bg-bg px-2 py-1 font-mono text-xs text-text transition-colors focus:border-primary focus:outline-none"
          />
          <Button
            size="sm"
            variant="secondary"
            type="submit"
            disabled={!customKey.trim()}
            className="shrink-0 px-2.5"
            title="Add field to canvas"
          >
            <Plus className="size-3.5" aria-hidden="true" />
          </Button>
        </form>
      </div>

      {/* Unplaced Suggested fields */}
      {unplacedKeys.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-text/50">
            Suggested Fields
          </h3>
          <div className="space-y-1">
            {unplacedKeys.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => onAddField(key)}
                className="flex w-full items-center justify-between border border-dashed border-primary/40 bg-primary/5 px-2.5 py-1.5 font-mono text-xs font-medium text-primary transition-colors hover:bg-primary/10 active:bg-primary/15"
              >
                <span>{key}</span>
                <Plus className="size-3 shrink-0 opacity-60" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Placed fields list */}
      <div className="mb-4">
        <h3 className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-text/50">
          Placed Elements ({placedFields.length})
        </h3>
        {placedFields.length === 0 ? (
          <p className="text-[11px] text-text/40">
            No dynamic fields placed on canvas yet.
          </p>
        ) : (
          <div className="space-y-0.5">
            {placedFields.map((f, i) => (
              <button
                key={`${f.fieldKey}-${i}`}
                type="button"
                onClick={() => onSelectField(i)}
                className={`flex w-full items-center justify-between px-2.5 py-1.5 font-mono text-xs transition-colors ${
                  selectedFieldIdx === i
                    ? "border border-primary bg-primary/10 font-semibold text-primary"
                    : "border border-transparent text-text/75 hover:bg-surface"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="size-1.5 shrink-0 bg-primary" />
                  <span className="truncate">{f.fieldKey}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-auto space-y-2 border-t border-border pt-3">
        <Button
          size="sm"
          variant="secondary"
          type="button"
          onClick={onAddStaticText}
          className="w-full justify-start text-xs"
        >
          <Type className="size-3.5" aria-hidden="true" />
          Add Custom Text Label
        </Button>
        {hasTableRegion && (
          <Button
            size="sm"
            variant="secondary"
            type="button"
            onClick={onAddTableRegion}
            className="w-full justify-start text-xs"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            Add Table Region
          </Button>
        )}
      </div>
    </div>
  );
}
