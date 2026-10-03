"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/toast";
import { EditorToolbar } from "./editor-toolbar";
import { FieldPalette } from "./field-palette";
import { EditorCanvas } from "./editor-canvas";
import { PropertyInspector } from "./property-inspector";
import type { EditorField, EditorStaticText, EditorSnapshot, Selection, TemplateTableRegion } from "./types";
import { DEFAULT_FIELD, DEFAULT_STATIC_TEXT } from "./utils";

interface TemplateTypeConfigItem {
  value: string;
  label: string;
  fieldKeys: readonly string[];
  hasTableRegion?: boolean;
  tableColumns?: readonly { fieldKey: string; label: string }[];
}

interface TemplateData {
  id: string;
  type: string;
  backgroundImageUrl: string;
  fields: Array<{
    fieldKey: string;
    xPercent: number;
    yPercent: number;
    widthPercent?: number | null;
    heightPercent?: number | null;
    fontSize: number;
    fontFamily?: string | null;
    fontColor?: string | null;
    fontWeight?: string | null;
    fontStyle?: string | null;
    textDecoration?: string | null;
    textAlign: string;
  }>;
  staticTexts?: Array<{
    content: string;
    xPercent: number;
    yPercent: number;
    widthPercent?: number | null;
    heightPercent?: number | null;
    fontSize: number;
    fontFamily?: string | null;
    fontColor?: string | null;
    fontWeight?: string | null;
    fontStyle?: string | null;
    textDecoration?: string | null;
    textAlign: string;
  }>;
  tableRegions: Array<{
    anchorXPercent: number;
    anchorYPercent: number;
    rowHeightPercent: number;
    columns: Array<{ fieldKey: string; xPercent: number; label: string }>;
  }>;
}

interface TemplateEditorProps {
  template: TemplateData;
  templateTypeConfig: TemplateTypeConfigItem;
  onClose: () => void;
}

function normalize(val: string | null | undefined): string {
  return val ?? "";
}

export function TemplateEditor({ template, templateTypeConfig, onClose }: TemplateEditorProps) {
  const { addToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);

  // Unified history
  const [history, setHistory] = useState<EditorSnapshot[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Derive present state
  const present: EditorSnapshot = history[historyIndex] ?? { fields: [], staticTexts: [], tableRegions: [] };

  function pushSnapshot(snap: EditorSnapshot) {
    setHistory((prev) => {
      const trimmed = prev.slice(0, historyIndex + 1);
      return [...trimmed, snap];
    });
    setHistoryIndex((i) => i + 1);
  }

  // Initialize from template data — no auto-place, just map existing
  useEffect(() => {
    const fields: EditorField[] = template.fields.map((f) => ({
      fieldKey: f.fieldKey,
      xPercent: f.xPercent,
      yPercent: f.yPercent,
      widthPercent: f.widthPercent ?? null,
      heightPercent: f.heightPercent ?? null,
      fontSize: f.fontSize,
      fontFamily: normalize(f.fontFamily),
      fontColor: normalize(f.fontColor),
      fontWeight: normalize(f.fontWeight),
      fontStyle: normalize(f.fontStyle),
      textDecoration: normalize(f.textDecoration),
      textAlign: (f.textAlign as "left" | "center" | "right") ?? "left",
    }));

    const staticTexts: EditorStaticText[] = (template.staticTexts ?? []).map((st) => ({
      content: st.content,
      xPercent: st.xPercent,
      yPercent: st.yPercent,
      widthPercent: st.widthPercent ?? null,
      heightPercent: st.heightPercent ?? null,
      fontSize: st.fontSize,
      fontFamily: normalize(st.fontFamily),
      fontColor: normalize(st.fontColor),
      fontWeight: normalize(st.fontWeight),
      fontStyle: normalize(st.fontStyle),
      textDecoration: normalize(st.textDecoration),
      textAlign: (st.textAlign as "left" | "center" | "right") ?? "left",
    }));

    const tableRegions: TemplateTableRegion[] = template.tableRegions.map((tr) => ({
      anchorXPercent: tr.anchorXPercent,
      anchorYPercent: tr.anchorYPercent,
      rowHeightPercent: tr.rowHeightPercent,
      columns: tr.columns,
    }));

    const initial: EditorSnapshot = { fields, staticTexts, tableRegions };
    setHistory([initial]);
    setHistoryIndex(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      } else if (e.key === "Escape") {
        setSelection(null);
      } else if ((e.key === "Delete" || e.key === "Backspace") && selection) {
        e.preventDefault();
        if (selection.type === "FIELD") removeField(selection.index);
        else if (selection.type === "STATIC_TEXT") removeStatic(selection.index);
        setSelection(null);
      } else if (selection?.type === "FIELD" && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
        e.preventDefault();
        const nudge = e.shiftKey ? 2 : 0.5;
        const f = present.fields[selection.index];
        if (!f) return;
        const dx = e.key === "ArrowLeft" ? -nudge : e.key === "ArrowRight" ? nudge : 0;
        const dy = e.key === "ArrowUp" ? -nudge : e.key === "ArrowDown" ? nudge : 0;
        updateField(selection.index, "xPercent", Math.min(100, Math.max(0, f.xPercent + dx)));
        updateField(selection.index, "yPercent", Math.min(100, Math.max(0, f.yPercent + dy)));
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  function undo() {
    if (historyIndex > 0) setHistoryIndex((i) => i - 1);
  }
  function redo() {
    if (historyIndex < history.length - 1) setHistoryIndex((i) => i + 1);
  }

  // Mutate helpers — always produce a new snapshot and push it
  function mutate(fn: (snap: EditorSnapshot) => EditorSnapshot) {
    const next = fn(present);
    pushSnapshot(next);
    return next;
  }

  function addField(fieldKey: string) {
    mutate((s) => ({
      ...s,
      fields: [...s.fields, { ...DEFAULT_FIELD, fieldKey }],
    }));
    setSelection({ type: "FIELD", index: present.fields.length });
  }

  function addStaticText() {
    mutate((s) => ({
      ...s,
      staticTexts: [...s.staticTexts, { ...DEFAULT_STATIC_TEXT, content: "Label" }],
    }));
    setSelection({ type: "STATIC_TEXT", index: present.staticTexts.length });
  }

  function addTableRegion() {
    if (!templateTypeConfig.hasTableRegion) return;
    mutate((s) => ({
      ...s,
      tableRegions: [
        ...s.tableRegions,
        {
          anchorXPercent: 10,
          anchorYPercent: 50,
          rowHeightPercent: 5,
          columns: (templateTypeConfig.tableColumns ?? []).map((c) => ({ ...c, xPercent: 10 })),
        },
      ],
    }));
    setSelection({ type: "TABLE_REGION", index: present.tableRegions.length });
  }

  function updateField(index: number, key: string, value: string | number | null) {
    mutate((s) => ({
      ...s,
      fields: s.fields.map((f, i) => (i === index ? { ...f, [key]: value } : f)),
    }));
  }

  function updateStatic(index: number, key: string, value: string | number | null) {
    mutate((s) => ({
      ...s,
      staticTexts: s.staticTexts.map((st, i) => (i === index ? { ...st, [key]: value } : st)),
    }));
  }

  function updateRegion(index: number, key: string, value: number) {
    mutate((s) => ({
      ...s,
      tableRegions: s.tableRegions.map((tr, i) => (i === index ? { ...tr, [key]: value } : tr)),
    }));
  }

  function updateRegionColumn(regionIdx: number, colIdx: number, key: string, value: number) {
    mutate((s) => ({
      ...s,
      tableRegions: s.tableRegions.map((tr, i) =>
        i === regionIdx
          ? { ...tr, columns: tr.columns.map((c, ci) => (ci === colIdx ? { ...c, [key]: value } : c)) }
          : tr,
      ),
    }));
  }

  function addDuplicate(index: number) {
    const orig = present.fields[index];
    mutate((s) => ({
      ...s,
      fields: [
        ...s.fields,
        { ...orig, xPercent: Math.min(100, orig.xPercent + 5), yPercent: Math.min(100, orig.yPercent + 5) },
      ],
    }));
    setSelection({ type: "FIELD", index: present.fields.length });
  }

  function removeField(index: number) {
    mutate((s) => ({ ...s, fields: s.fields.filter((_, i) => i !== index) }));
    setSelection(null);
  }

  function removeStatic(index: number) {
    mutate((s) => ({ ...s, staticTexts: s.staticTexts.filter((_, i) => i !== index) }));
    setSelection(null);
  }

  // Drag callbacks — inline updates (no history push during drag, pushed on drag end)
  const [liveSnap, setLiveSnap] = useState<EditorSnapshot | null>(null);
  const live = liveSnap ?? present;

  function onFieldDrag(index: number, x: number, y: number) {
    setLiveSnap((prev) => {
      const base = prev ?? present;
      return { ...base, fields: base.fields.map((f, i) => (i === index ? { ...f, xPercent: x, yPercent: y } : f)) };
    });
  }

  function onStaticDrag(index: number, x: number, y: number) {
    setLiveSnap((prev) => {
      const base = prev ?? present;
      return { ...base, staticTexts: base.staticTexts.map((st, i) => (i === index ? { ...st, xPercent: x, yPercent: y } : st)) };
    });
  }

  function onRegionDrag(index: number, x: number, y: number) {
    setLiveSnap((prev) => {
      const base = prev ?? present;
      return { ...base, tableRegions: base.tableRegions.map((tr, i) => (i === index ? { ...tr, anchorXPercent: x, anchorYPercent: y } : tr)) };
    });
  }

  function onFieldResize(index: number, w: number, h: number, x: number, y: number) {
    setLiveSnap((prev) => {
      const base = prev ?? present;
      return { ...base, fields: base.fields.map((f, i) => (i === index ? { ...f, widthPercent: w, heightPercent: h, xPercent: x, yPercent: y } : f)) };
    });
  }

  function onDragEnd() {
    if (liveSnap) {
      pushSnapshot(liveSnap);
      setLiveSnap(null);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/templates/${template.id}/fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: live.fields,
          staticTexts: live.staticTexts,
          tableRegions: live.tableRegions,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Save failed");
      addToast("success", "Field positions saved");
      onClose();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-bg"
      style={{ animation: "overlay-fade-in 150ms ease-out both" }}
      role="dialog"
      aria-modal="true"
      aria-label={`Edit Fields — ${templateTypeConfig.label}`}
    >
      <EditorToolbar
        title={templateTypeConfig.label}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        saving={saving}
        onUndo={undo}
        onRedo={redo}
        onSave={handleSave}
        onClose={onClose}
      />

      <div className="flex flex-1 overflow-hidden">
        <FieldPalette
          allFieldKeys={templateTypeConfig.fieldKeys}
          placedFields={live.fields}
          hasTableRegion={!!templateTypeConfig.hasTableRegion}
          tableRegionCount={live.tableRegions.length}
          onAddField={addField}
          onAddStaticText={addStaticText}
          onAddTableRegion={addTableRegion}
          onSelectField={(i) => setSelection({ type: "FIELD", index: i })}
          selectedFieldIdx={selection?.type === "FIELD" ? selection.index : null}
        />

        <EditorCanvas
          backgroundImageUrl={template.backgroundImageUrl}
          fields={live.fields}
          staticTexts={live.staticTexts}
          tableRegions={live.tableRegions}
          selection={selection}
          onSelect={setSelection}
          onFieldDrag={onFieldDrag}
          onStaticDrag={onStaticDrag}
          onRegionDrag={onRegionDrag}
          onFieldResize={onFieldResize}
          onDragEnd={onDragEnd}
        />

        <PropertyInspector
          selection={selection}
          fields={live.fields}
          staticTexts={live.staticTexts}
          tableRegions={live.tableRegions}
          onUpdateField={updateField}
          onUpdateStatic={updateStatic}
          onUpdateRegion={updateRegion}
          onUpdateRegionColumn={updateRegionColumn}
          onAddDuplicate={addDuplicate}
          onRemoveField={removeField}
          onRemoveStatic={removeStatic}
        />
      </div>
    </div>
  );
}
