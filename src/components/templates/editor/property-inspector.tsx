"use client";

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Copy,
  Italic,
  Plus,
  Trash2,
  Type,
  Underline,
} from "lucide-react";
import type {
  EditorField,
  EditorStaticText,
  Selection,
  TemplateTableRegion,
  TextAlign,
} from "./types";

interface PropertyInspectorProps {
  selection: Selection | null;
  fields: EditorField[];
  staticTexts: EditorStaticText[];
  tableRegions: TemplateTableRegion[];
  onUpdateField: (index: number, key: string, value: string | number | null) => void;
  onUpdateStatic: (index: number, key: string, value: string | number | null) => void;
  onUpdateRegion: (index: number, key: string, value: number) => void;
  onUpdateRegionColumn: (regionIdx: number, colIdx: number, key: string, value: number) => void;
  onAddDuplicate: (index: number) => void;
  onRemoveField: (index: number) => void;
  onRemoveStatic: (index: number) => void;
}

const FONT_FAMILIES = [
  { value: "", label: "Default (System / Sans)" },
  { value: "Inter, sans-serif", label: "Inter (Clean Sans)" },
  { value: "Arial, sans-serif", label: "Arial (Standard Sans)" },
  { value: "Georgia, serif", label: "Georgia (Classic Serif)" },
  { value: "Times New Roman, serif", label: "Times New Roman (Formal Serif)" },
  { value: "Playfair Display, serif", label: "Playfair Display (Editorial)" },
  { value: "Courier New, monospace", label: "Courier New (Monospace)" },
];

function SectionHeading({ title }: { title: string }) {
  return (
    <div className="border-b border-border pb-1 pt-2">
      <span className="text-[10px] font-bold uppercase tracking-wider text-text/50">
        {title}
      </span>
    </div>
  );
}

function CoordinateField({
  label,
  value,
  onChange,
  placeholder = "auto",
  min = 0,
  max = 100,
  step = 0.5,
  unit = "%",
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}) {
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between text-[11px] font-medium text-text/70">
        <span>{label}</span>
        <span className="text-[10px] font-mono text-text/40">{unit}</span>
      </div>
      <input
        type="number"
        value={value != null ? Math.round(value * 10) / 10 : ""}
        placeholder={placeholder}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : parseFloat(e.target.value) || null)
        }
        className="block w-full border border-border bg-bg px-2 py-1 font-mono text-xs tabular-nums text-text transition-colors focus:border-primary focus:outline-none"
        min={min}
        max={max}
        step={step}
      />
    </div>
  );
}

function TypographyControls({
  fontSize,
  fontFamily,
  fontColor,
  fontWeight,
  fontStyle,
  textDecoration,
  textAlign,
  onChange,
}: {
  fontSize: number;
  fontFamily: string;
  fontColor: string;
  fontWeight: string;
  fontStyle: string;
  textDecoration: string;
  textAlign: TextAlign;
  onChange: (key: string, value: string | number | null) => void;
}) {
  return (
    <div className="space-y-2.5">
      {/* Font Family */}
      <div>
        <label className="mb-1 block text-[11px] font-medium text-text/70">
          Font Family
        </label>
        <select
          value={fontFamily}
          onChange={(e) => onChange("fontFamily", e.target.value)}
          className="block w-full border border-border bg-bg px-2 py-1.5 text-xs text-text transition-colors focus:border-primary focus:outline-none"
        >
          {FONT_FAMILIES.map((ff) => (
            <option key={ff.value} value={ff.value}>
              {ff.label}
            </option>
          ))}
        </select>
      </div>

      {/* Size & Color */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-text/70">
            Font Size
          </label>
          <div className="relative">
            <input
              type="number"
              value={fontSize}
              onChange={(e) =>
                onChange("fontSize", Math.max(6, parseInt(e.target.value) || 12))
              }
              min={6}
              max={72}
              className="block w-full border border-border bg-bg px-2 py-1 font-mono text-xs tabular-nums text-text focus:border-primary focus:outline-none"
            />
            <span className="pointer-events-none absolute right-2 top-1 text-[10px] text-text/40">
              px
            </span>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium text-text/70">
            Text Color
          </label>
          <div className="flex items-center gap-1.5">
            <input
              type="color"
              value={fontColor || "#000000"}
              onChange={(e) => onChange("fontColor", e.target.value)}
              className="size-7 shrink-0 cursor-pointer border border-border bg-bg p-0.5"
            />
            <span className="font-mono text-[11px] uppercase text-text/60">
              {fontColor || "#000000"}
            </span>
          </div>
        </div>
      </div>

      {/* Text Styles & Alignment */}
      <div>
        <label className="mb-1 block text-[11px] font-medium text-text/70">
          Style & Alignment
        </label>
        <div className="flex items-center justify-between gap-1">
          {/* Style toggles */}
          <div className="flex items-center border border-border bg-bg">
            <button
              type="button"
              onClick={() =>
                onChange("fontWeight", fontWeight === "bold" ? "normal" : "bold")
              }
              className={`flex size-7 items-center justify-center transition-colors ${
                fontWeight === "bold"
                  ? "bg-text text-bg"
                  : "text-text/70 hover:bg-surface"
              }`}
              title="Bold"
              aria-label="Bold"
            >
              <Bold className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() =>
                onChange("fontStyle", fontStyle === "italic" ? "normal" : "italic")
              }
              className={`flex size-7 items-center justify-center border-l border-border transition-colors ${
                fontStyle === "italic"
                  ? "bg-text text-bg"
                  : "text-text/70 hover:bg-surface"
              }`}
              title="Italic"
              aria-label="Italic"
            >
              <Italic className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() =>
                onChange(
                  "textDecoration",
                  textDecoration === "underline" ? "none" : "underline",
                )
              }
              className={`flex size-7 items-center justify-center border-l border-border transition-colors ${
                textDecoration === "underline"
                  ? "bg-text text-bg"
                  : "text-text/70 hover:bg-surface"
              }`}
              title="Underline"
              aria-label="Underline"
            >
              <Underline className="size-3.5" />
            </button>
          </div>

          {/* Alignment buttons */}
          <div className="flex items-center border border-border bg-bg">
            <button
              type="button"
              onClick={() => onChange("textAlign", "left")}
              className={`flex size-7 items-center justify-center transition-colors ${
                textAlign === "left"
                  ? "bg-primary text-white"
                  : "text-text/70 hover:bg-surface"
              }`}
              title="Align Left"
              aria-label="Align Left"
            >
              <AlignLeft className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onChange("textAlign", "center")}
              className={`flex size-7 items-center justify-center border-l border-border transition-colors ${
                textAlign === "center"
                  ? "bg-primary text-white"
                  : "text-text/70 hover:bg-surface"
              }`}
              title="Align Center"
              aria-label="Align Center"
            >
              <AlignCenter className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onChange("textAlign", "right")}
              className={`flex size-7 items-center justify-center border-l border-border transition-colors ${
                textAlign === "right"
                  ? "bg-primary text-white"
                  : "text-text/70 hover:bg-surface"
              }`}
              title="Align Right"
              aria-label="Align Right"
            >
              <AlignRight className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PropertyInspector({
  selection,
  fields,
  staticTexts,
  tableRegions,
  onUpdateField,
  onUpdateStatic,
  onUpdateRegion,
  onUpdateRegionColumn,
  onAddDuplicate,
  onRemoveField,
  onRemoveStatic,
}: PropertyInspectorProps) {
  if (!selection) {
    return (
      <div className="flex w-72 shrink-0 flex-col border-l border-border bg-bg p-4">
        <div className="border-b border-border pb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text/60">
            Inspector
          </h3>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
          <div className="mb-2 flex size-10 items-center justify-center border border-border bg-surface text-text/40">
            <Type className="size-5" />
          </div>
          <p className="text-xs font-medium text-text/70">No Element Selected</p>
          <p className="mt-1 max-w-[180px] text-[11px] text-text/40">
            Click on any field on the canvas or pick one from the left palette to edit.
          </p>
        </div>
      </div>
    );
  }

  // ─── Dynamic Field Selected ──────────────────────────────────────────
  if (selection.type === "FIELD") {
    const f = fields[selection.index];
    if (!f) return null;

    return (
      <div className="flex w-72 shrink-0 flex-col overflow-y-auto border-l border-border bg-bg p-4">
        {/* Header with actions */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <span className="border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
            Dynamic Field
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onAddDuplicate(selection.index)}
              className="inline-flex items-center gap-1 border border-border bg-bg px-2 py-1 text-[11px] font-medium text-text transition-colors hover:bg-surface"
              title="Duplicate this field"
            >
              <Copy className="size-3 text-text/60" /> Duplicate
            </button>
            <button
              type="button"
              onClick={() => onRemoveField(selection.index)}
              className="inline-flex size-7 items-center justify-center border border-danger/30 text-danger transition-colors hover:bg-danger/10"
              title="Delete field"
              aria-label="Delete field"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>

        <div className="space-y-4 pt-3">
          {/* Editable Field Name / Key */}
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-text">
              Field Variable Name
            </label>
            <input
              type="text"
              value={f.fieldKey}
              onChange={(e) =>
                onUpdateField(selection.index, "fieldKey", e.target.value)
              }
              className="block w-full border border-border bg-bg px-2.5 py-1.5 font-mono text-xs font-semibold text-primary transition-colors focus:border-primary focus:outline-none"
              placeholder="e.g. studentName, rollNumber"
            />
            <p className="mt-1 text-[10px] text-text/50">
              Matches database/document key when generating prints.
            </p>
          </div>

          {/* Position Section */}
          <div className="space-y-2">
            <SectionHeading title="Position on Page" />
            <div className="grid grid-cols-2 gap-2">
              <CoordinateField
                label="Left (X)"
                value={f.xPercent}
                onChange={(v) => onUpdateField(selection.index, "xPercent", v ?? 0)}
              />
              <CoordinateField
                label="Top (Y)"
                value={f.yPercent}
                onChange={(v) => onUpdateField(selection.index, "yPercent", v ?? 0)}
              />
            </div>
          </div>

          {/* Sizing Section */}
          <div className="space-y-2">
            <SectionHeading title="Box Size (Optional)" />
            <div className="grid grid-cols-2 gap-2">
              <CoordinateField
                label="Width"
                value={f.widthPercent}
                placeholder="auto"
                min={2}
                max={90}
                onChange={(v) => onUpdateField(selection.index, "widthPercent", v)}
              />
              <CoordinateField
                label="Height"
                value={f.heightPercent}
                placeholder="auto"
                min={1}
                max={50}
                onChange={(v) => onUpdateField(selection.index, "heightPercent", v)}
              />
            </div>
          </div>

          {/* Typography Section */}
          <div className="space-y-2">
            <SectionHeading title="Typography & Styling" />
            <TypographyControls
              fontSize={f.fontSize}
              fontFamily={f.fontFamily}
              fontColor={f.fontColor}
              fontWeight={f.fontWeight}
              fontStyle={f.fontStyle}
              textDecoration={f.textDecoration}
              textAlign={f.textAlign}
              onChange={(key, val) => onUpdateField(selection.index, key, val)}
            />
          </div>
        </div>
      </div>
    );
  }

  // ─── Static Text Selected ──────────────────────────────────────────
  if (selection.type === "STATIC_TEXT") {
    const st = staticTexts[selection.index];
    if (!st) return null;

    return (
      <div className="flex w-72 shrink-0 flex-col overflow-y-auto border-l border-border bg-bg p-4">
        {/* Header with actions */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <span className="border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-success">
            Custom Text Label
          </span>
          <button
            type="button"
            onClick={() => onRemoveStatic(selection.index)}
            className="inline-flex size-7 items-center justify-center border border-danger/30 text-danger transition-colors hover:bg-danger/10"
            title="Delete text label"
            aria-label="Delete text label"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>

        <div className="space-y-4 pt-3">
          {/* Editable Text Content */}
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-text">
              Text Content
            </label>
            <textarea
              value={st.content}
              onChange={(e) =>
                onUpdateStatic(selection.index, "content", e.target.value)
              }
              rows={2}
              className="block w-full border border-border bg-bg px-2.5 py-1.5 text-xs text-text transition-colors focus:border-primary focus:outline-none"
              placeholder="Enter text to print..."
            />
          </div>

          {/* Position Section */}
          <div className="space-y-2">
            <SectionHeading title="Position on Page" />
            <div className="grid grid-cols-2 gap-2">
              <CoordinateField
                label="Left (X)"
                value={st.xPercent}
                onChange={(v) => onUpdateStatic(selection.index, "xPercent", v ?? 0)}
              />
              <CoordinateField
                label="Top (Y)"
                value={st.yPercent}
                onChange={(v) => onUpdateStatic(selection.index, "yPercent", v ?? 0)}
              />
            </div>
          </div>

          {/* Sizing Section */}
          <div className="space-y-2">
            <SectionHeading title="Box Size (Optional)" />
            <div className="grid grid-cols-2 gap-2">
              <CoordinateField
                label="Width"
                value={st.widthPercent}
                placeholder="auto"
                min={2}
                max={90}
                onChange={(v) => onUpdateStatic(selection.index, "widthPercent", v)}
              />
              <CoordinateField
                label="Height"
                value={st.heightPercent}
                placeholder="auto"
                min={1}
                max={50}
                onChange={(v) => onUpdateStatic(selection.index, "heightPercent", v)}
              />
            </div>
          </div>

          {/* Typography Section */}
          <div className="space-y-2">
            <SectionHeading title="Typography & Styling" />
            <TypographyControls
              fontSize={st.fontSize}
              fontFamily={st.fontFamily}
              fontColor={st.fontColor}
              fontWeight={st.fontWeight}
              fontStyle={st.fontStyle}
              textDecoration={st.textDecoration}
              textAlign={st.textAlign}
              onChange={(key, val) => onUpdateStatic(selection.index, key, val)}
            />
          </div>
        </div>
      </div>
    );
  }

  // ─── Table Region Selected ──────────────────────────────────────────
  if (selection.type === "TABLE_REGION") {
    const tr = tableRegions[selection.index];
    if (!tr) return null;

    return (
      <div className="flex w-72 shrink-0 flex-col overflow-y-auto border-l border-border bg-bg p-4">
        <div className="border-b border-border pb-3">
          <span className="border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-600">
            Table Region {selection.index + 1}
          </span>
        </div>

        <div className="space-y-4 pt-3">
          <div className="space-y-2">
            <SectionHeading title="Table Anchor" />
            <div className="grid grid-cols-2 gap-2">
              <CoordinateField
                label="Anchor X"
                value={tr.anchorXPercent}
                onChange={(v) => onUpdateRegion(selection.index, "anchorXPercent", v ?? 0)}
              />
              <CoordinateField
                label="Anchor Y"
                value={tr.anchorYPercent}
                onChange={(v) => onUpdateRegion(selection.index, "anchorYPercent", v ?? 0)}
              />
            </div>
            <CoordinateField
              label="Row Height"
              value={tr.rowHeightPercent}
              min={0.5}
              max={20}
              onChange={(v) => onUpdateRegion(selection.index, "rowHeightPercent", v ?? 5)}
            />
          </div>

          <div className="space-y-2">
            <SectionHeading title="Table Columns" />
            <div className="space-y-2">
              {tr.columns.map((col, ci) => (
                <div key={ci} className="border border-border bg-surface/50 p-2">
                  <span className="block text-[11px] font-semibold text-text">
                    {col.label}{" "}
                    <span className="font-mono font-normal text-text/50">
                      ({col.fieldKey})
                    </span>
                  </span>
                  <div className="mt-1">
                    <CoordinateField
                      label="Column Left (X)"
                      value={col.xPercent}
                      onChange={(v) =>
                        onUpdateRegionColumn(selection.index, ci, "xPercent", v ?? 0)
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
