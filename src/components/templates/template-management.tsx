"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const TEMPLATE_TYPES = [
  {
    value: "LEAVING_CERTIFICATE",
    label: "Leaving Certificate",
    fieldKeys: [
      "studentName", "guardianName", "classSection",
      "admissionDate", "dateOfLeaving", "dob", "issueDate",
    ],
  },
  {
    value: "CHARACTER_CERTIFICATE",
    label: "Character Certificate",
    fieldKeys: [
      "studentName", "guardianName", "classSection",
      "dob", "conductRemark", "issueDate",
    ],
  },
  {
    value: "REPORT_CARD",
    label: "Report Card",
    fieldKeys: ["studentName", "classSection", "termName"],
    hasTableRegion: true,
    tableColumns: [
      { fieldKey: "subject", label: "Subject" },
      { fieldKey: "testTitle", label: "Test" },
      { fieldKey: "marksObtained", label: "Marks" },
      { fieldKey: "maxMarks", label: "Max" },
    ],
  },
  {
    value: "FEE_CHALLAN",
    label: "Fee Challan",
    fieldKeys: [
      "studentName", "guardianName", "guardianCnic", "classSection",
      "bankName", "bankAccountNumber", "issueDate", "total",
    ],
    hasTableRegion: true,
    tableColumns: [
      { fieldKey: "description", label: "Description" },
      { fieldKey: "amount", label: "Amount" },
    ],
  },
] as const;

type TemplateType = (typeof TEMPLATE_TYPES)[number]["value"];

interface TemplateField {
  id: string;
  templateId: string;
  fieldKey: string;
  xPercent: number;
  yPercent: number;
  fontSize: number;
  fontFamily?: string | null;
  fontColor?: string | null;
  fontWeight?: string | null;
  fontStyle?: string | null;
  textDecoration?: string | null;
  textAlign: string;
}

interface TemplateTableRegion {
  id: string;
  templateId: string;
  anchorXPercent: number;
  anchorYPercent: number;
  rowHeightPercent: number;
  columns: Array<{ fieldKey: string; xPercent: number; label: string }>;
}

interface Template {
  id: string;
  type: TemplateType;
  originalFileUrl: string;
  backgroundImageUrl: string;
  uploadedBy: string;
  isActive: boolean;
  fields: TemplateField[];
  tableRegions: TemplateTableRegion[];
  _count: { certificates: number; reportCards: number; feeChallans: number };
  createdAt: string;
}

export function TemplateManagement() {
  const { addToast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingType, setUploadingType] = useState<TemplateType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingTypeRef = useRef<TemplateType | null>(null);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/templates");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to load templates");
      setTemplates(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  /**
   * Convert PDF to PNG using pdf.js canvas rendering (client-side).
   * Falls back to direct upload if pdf.js is unavailable.
   */
  async function convertPdfToImage(file: File): Promise<File> {
    try {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(1); // First page only

      // Scale for reasonable quality (not too large for blob storage)
      const scale = 2;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const ctx = canvas.getContext("2d")!;
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;

      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Canvas toBlob failed"))),
          "image/png",
        );
      });

      // Wrap as File
      const convertedName = file.name.replace(/\.pdf$/i, ".png");
      return new File([blob], convertedName, { type: "image/png" });
    } catch {
      // If pdf.js fails, still attempt upload — the server will reject if type is wrong
      return file;
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const type = pendingTypeRef.current;
    if (!file || !type) return;

    try {
      setUploading(true);
      setUploadingType(type);

      // If PDF, convert to image client-side first
      let uploadFile = file;
      if (file.type === "application/pdf") {
        addToast("success", "Converting PDF...");
        uploadFile = await convertPdfToImage(file);
      }

      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("type", type);

      const res = await fetch("/api/templates", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Upload failed");

      addToast("success", "Template uploaded successfully");
      fetchTemplates();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      setUploadingType(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function triggerUpload(type: TemplateType) {
    pendingTypeRef.current = type;
    fileInputRef.current?.click();
  }

  async function handleActivate(template: Template) {
    try {
      const res = await fetch(`/api/templates/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to activate");
      addToast("success", `${getLabel(template.type)} template activated`);
      fetchTemplates();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Activation failed");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/templates/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to delete");
      addToast("success", "Template deleted");
      setDeleteTarget(null);
      fetchTemplates();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  function getLabel(type: TemplateType): string {
    return TEMPLATE_TYPES.find((t) => t.value === type)?.label ?? type;
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Document Templates" description="Manage print templates for certificates, report cards, and fee challans" />
        <div className="space-y-4 p-6">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Document Templates" description="Manage print templates for certificates, report cards, and fee challans" />
        <ErrorState message={error} onRetry={fetchTemplates} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Document Templates"
        description="Manage print templates for certificates, report cards, and fee challans"
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,application/pdf"
        className="hidden"
        onChange={handleUpload}
      />

      <div className="space-y-6 p-6">
        {TEMPLATE_TYPES.map((typeInfo) => {
          const typeTemplates = templates.filter(
            (t) => t.type === typeInfo.value,
          );
          const activeTemplate = typeTemplates.find((t) => t.isActive);

          return (
            <div
              key={typeInfo.value}
              className="border border-zinc-200 bg-white"
            >
              {/* Section header */}
              <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-zinc-900">
                    {typeInfo.label}
                  </h3>
                  {activeTemplate ? (
                    <Badge variant="success">Active</Badge>
                  ) : (
                    <Badge variant="danger">No active template</Badge>
                  )}
                </div>
                <button
                  onClick={() => triggerUpload(typeInfo.value)}
                  disabled={uploading}
                  className="inline-flex items-center gap-1.5 border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  {uploading && uploadingType === typeInfo.value ? (
                    "Uploading..."
                  ) : (
                    <>
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                      Upload Template
                    </>
                  )}
                </button>
              </div>

              {/* Template list */}
              {typeTemplates.length === 0 ? (
                <EmptyState
                  title="No templates uploaded"
                  description={`Upload a template image (PNG/JPG) or PDF for ${typeInfo.label}. The file will be converted to an image and used as the background for document generation.`}
                />
              ) : (
                <div className="divide-y divide-zinc-200">
                  {typeTemplates.map((template) => {
                    const docCount =
                      template.type === "REPORT_CARD"
                        ? template._count.reportCards
                        : template.type === "FEE_CHALLAN"
                          ? template._count.feeChallans
                          : template._count.certificates;

                    return (
                      <div
                        key={template.id}
                        className="flex items-center justify-between px-4 py-3"
                      >
                        <div className="flex items-center gap-4">
                          {/* Thumbnail preview */}
                          <div className="h-12 w-16 overflow-hidden border border-zinc-200 bg-zinc-100">
                            <img
                              src={template.backgroundImageUrl}
                              alt={`Template for ${typeInfo.label}`}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-zinc-900">
                                {new Date(template.createdAt).toLocaleDateString()}
                              </span>
                              {template.isActive && (
                                <span className="inline-flex items-center rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-800">
                                  ACTIVE
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-zinc-500">
                              {template.fields.length} fields ·{" "}
                              {template.tableRegions.length} table regions ·{" "}
                              {docCount} document(s) generated
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setEditingTemplate(template)}
                            className="border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                          >
                            Edit Fields
                          </button>
                          {!template.isActive && (
                            <button
                              onClick={() => handleActivate(template)}
                              className="border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                            >
                              Activate
                            </button>
                          )}
                          <button
                            onClick={() => setDeleteTarget(template)}
                            className="border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Fallback note */}
        <p className="text-xs text-zinc-500">
          If no active template exists for a document type, the print view will show
          &ldquo;No template configured — ask your Admin to upload one in Settings&rdquo;
          instead of rendering blank.
        </p>
      </div>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Template"
        description={
          deleteTarget
            ? `Delete the ${getLabel(deleteTarget.type)} template from ${new Date(deleteTarget.createdAt).toLocaleDateString()}? This cannot be undone.`
            : ""
        }
        confirmLabel={deleting ? "Deleting..." : "Delete"}
        onConfirm={handleDelete}
      />

      {/* Visual editor modal */}
      {editingTemplate && (
        <TemplateEditor
          template={editingTemplate}
          templateTypeConfig={
            TEMPLATE_TYPES.find((t) => t.value === editingTemplate.type)!
          }
          onClose={() => {
            setEditingTemplate(null);
            fetchTemplates();
          }}
        />
      )}
    </div>
  );
}

/* ─── Visual Editor (inline modal) ─────────────────────────────── */

interface TemplateTypeConfigItem {
  value: string;
  label: string;
  fieldKeys: readonly string[];
  hasTableRegion?: boolean;
  tableColumns?: readonly { fieldKey: string; label: string }[];
}

interface TemplateEditorProps {
  template: Template;
  templateTypeConfig: TemplateTypeConfigItem;
  onClose: () => void;
}

function TemplateEditor({
  template,
  templateTypeConfig,
  onClose,
}: TemplateEditorProps) {
  const { addToast } = useToast();
  const canvasRef = useRef<HTMLDivElement>(null);

  type EditorField = {
    fieldKey: string;
    xPercent: number;
    yPercent: number;
    widthPercent: number | null;
    heightPercent: number | null;
    fontSize: number;
    fontFamily: string;
    fontColor: string;
    fontWeight: string;
    fontStyle: string;
    textDecoration: string;
    textAlign: "left" | "center" | "right";
  };

  const [fields, setFields] = useState<EditorField[]>(
    template.fields.map((f) => ({
      fieldKey: f.fieldKey,
      xPercent: f.xPercent,
      yPercent: f.yPercent,
      widthPercent: (f as any).widthPercent ?? null,
      heightPercent: (f as any).heightPercent ?? null,
      fontSize: f.fontSize,
      fontFamily: (f as any).fontFamily || "",
      fontColor: (f as any).fontColor || "",
      fontWeight: (f as any).fontWeight || "",
      fontStyle: (f as any).fontStyle || "",
      textDecoration: (f as any).textDecoration || "",
      textAlign: f.textAlign as "left" | "center" | "right",
    })),
  );

  // Static text state
  type EditorStaticText = {
    content: string;
    xPercent: number;
    yPercent: number;
    widthPercent: number | null;
    heightPercent: number | null;
    fontSize: number;
    fontFamily: string;
    fontColor: string;
    fontWeight: string;
    fontStyle: string;
    textDecoration: string;
    textAlign: "left" | "center" | "right";
  };

  const [staticTexts, setStaticTexts] = useState<EditorStaticText[]>(
    (template as any).staticTexts?.map((st: any) => ({
      content: st.content,
      xPercent: st.xPercent,
      yPercent: st.yPercent,
      widthPercent: st.widthPercent ?? null,
      heightPercent: st.heightPercent ?? null,
      fontSize: st.fontSize,
      fontFamily: st.fontFamily || "",
      fontColor: st.fontColor || "",
      fontWeight: st.fontWeight || "",
      fontStyle: st.fontStyle || "",
      textDecoration: st.textDecoration || "",
      textAlign: st.textAlign as "left" | "center" | "right",
    })) ?? [],
  );

  // Undo/redo state
  const [history, setHistory] = useState<EditorField[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [selectedFieldIdx, setSelectedFieldIdx] = useState<number | null>(null);
  const [selectedStaticIdx, setSelectedStaticIdx] = useState<number | null>(null);

  // Interaction state
  type InteractionMode = "idle" | "dragging" | "resizing";
  const [mode, setMode] = useState<InteractionMode>("idle");
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const interactionStart = useRef<{ x: number; y: number; field: EditorField } | null>(null);

  function pushHistory(newFields: EditorField[]) {
    setHistory((prev) => {
      const trimmed = prev.slice(0, historyIndex + 1);
      return [...trimmed, newFields];
    });
    setHistoryIndex((prev) => prev + 1);
  }

  function undo() {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setFields(prev);
      setHistoryIndex((prev) => prev - 1);
    }
  }

  function redo() {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setFields(next);
      setHistoryIndex((prev) => prev + 1);
    }
  }

  const [tableRegions, setTableRegions] = useState<
    Array<{
      anchorXPercent: number;
      anchorYPercent: number;
      rowHeightPercent: number;
      columns: Array<{ fieldKey: string; xPercent: number; label: string }>;
    }>
  >(
    template.tableRegions.map((tr) => ({
      anchorXPercent: tr.anchorXPercent,
      anchorYPercent: tr.anchorYPercent,
      rowHeightPercent: tr.rowHeightPercent,
      columns: tr.columns,
    })),
  );
  const [saving, setSaving] = useState(false);
  const [draggingRegion, setDraggingRegion] = useState<number | null>(null);

  // Initialize missing fields
  useEffect(() => {
    const existingKeys = new Set(fields.map((f) => f.fieldKey));
    const missing = templateTypeConfig.fieldKeys.filter(
      (k) => !existingKeys.has(k),
    );
    if (missing.length > 0) {
      const newFields = [
        ...fields,
        ...missing.map((key, i) => ({
          fieldKey: key,
          xPercent: 10 + i * 5,
          yPercent: 10 + i * 5,
          widthPercent: null as number | null,
          heightPercent: null as number | null,
          fontSize: 12,
          fontFamily: "",
          fontColor: "",
          fontWeight: "",
          fontStyle: "",
          textDecoration: "",
          textAlign: "left" as const,
        })),
      ];
      setFields(newFields);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateTypeConfig.fieldKeys]);

  // Convert screen coordinates to canvas percentage coordinates
  function screenToCanvas(clientX: number, clientY: number) {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100)),
    };
  }

  // Pointer event handlers for field interaction
  function handleFieldPointerDown(e: React.PointerEvent, index: number) {
    e.stopPropagation();
    e.preventDefault();
    setSelectedFieldIdx(index);
    setMode("dragging");
    const f = fields[index];
    interactionStart.current = { x: e.clientX, y: e.clientY, field: { ...f } };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handleResizePointerDown(e: React.PointerEvent, index: number, handle: string) {
    e.stopPropagation();
    e.preventDefault();
    setSelectedFieldIdx(index);
    setMode("resizing");
    setResizeHandle(handle);
    const f = fields[index];
    interactionStart.current = { x: e.clientX, y: e.clientY, field: { ...f } };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const dxPx = e.clientX - (interactionStart.current?.x ?? e.clientX);
    const dyPx = e.clientY - (interactionStart.current?.y ?? e.clientY);
    const dxPercent = (dxPx / rect.width) * 100;
    const dyPercent = (dyPx / rect.height) * 100;

    // Handle field drag/resize
    if ((mode === "dragging" || mode === "resizing") && interactionStart.current !== null && selectedFieldIdx !== null) {
      const start = interactionStart.current;

      if (mode === "dragging") {
        const newX = Math.min(100, Math.max(0, start.field.xPercent + dxPercent));
        const newY = Math.min(100, Math.max(0, start.field.yPercent + dyPercent));
        setFields((prev) =>
          prev.map((f, i) =>
            i === selectedFieldIdx ? { ...f, xPercent: newX, yPercent: newY } : f,
          ),
        );
      } else if (mode === "resizing" && resizeHandle) {
        const origW = start.field.widthPercent ?? 20;
        const origH = start.field.heightPercent ?? 5;
        let newW = origW;
        let newH = origH;
        let newX = start.field.xPercent;
        let newY = start.field.yPercent;

        if (resizeHandle.includes("right")) newW = Math.max(2, Math.min(80, origW + dxPercent));
        if (resizeHandle.includes("left")) newW = Math.max(2, Math.min(80, origW - dxPercent));
        if (resizeHandle.includes("bottom")) newH = Math.max(1, Math.min(50, origH + dyPercent));
        if (resizeHandle.includes("top")) newH = Math.max(1, Math.min(50, origH - dyPercent));

        if (resizeHandle.includes("left")) {
          newX = start.field.xPercent + (origW - newW) / 2;
        }
        if (resizeHandle.includes("top")) {
          newY = start.field.yPercent + (origH - newH) / 2;
        }

        newX = Math.min(100, Math.max(0, newX));
        newY = Math.min(100, Math.max(0, newY));

        setFields((prev) =>
          prev.map((f, i) =>
            i === selectedFieldIdx
              ? { ...f, widthPercent: newW, heightPercent: newH, xPercent: newX, yPercent: newY }
              : f,
          ),
        );
      }
    }

    // Handle static text drag/resize
    if (interactionStartStatic.current !== null && selectedStaticIdx !== null) {
      const start = interactionStartStatic.current;
      const origW = start.text.widthPercent ?? 15;
      const origH = start.text.heightPercent ?? 3;

      // Determine which handle is being dragged (stored in resizeHandle during static resize)
      if (resizeHandle && mode !== "resizing") {
        // This is a static text resize — resizeHandle is set via data attribute
      }

      // For static text, we always do drag (no resize handle tracking yet)
      // Check if this is a resize by looking at what initiated it
      const newX = Math.min(100, Math.max(0, start.text.xPercent + dxPercent));
      const newY = Math.min(100, Math.max(0, start.text.yPercent + dyPercent));
      setStaticTexts((prev) =>
        prev.map((st, i) =>
          i === selectedStaticIdx ? { ...st, xPercent: newX, yPercent: newY } : st,
        ),
      );
    }
  }

  function handlePointerUp() {
    if (mode !== "idle" && interactionStart.current !== null && selectedFieldIdx !== null) {
      setFields((current) => {
        pushHistory(current);
        return current;
      });
    }
    if (interactionStartStatic.current !== null && selectedStaticIdx !== null) {
      // Static text move done — no history needed
    }
    setMode("idle");
    setResizeHandle(null);
    interactionStart.current = null;
    interactionStartStatic.current = null;
  }

  // Static text pointer handlers for drag and resize
  type InteractionModeExtended = InteractionMode | "draggingStatic" | "resizingStatic";
  const interactionStartStatic = useRef<{ x: number; y: number; text: EditorStaticText } | null>(null);

  function handleStaticPointerDown(e: React.PointerEvent, index: number) {
    e.stopPropagation();
    e.preventDefault();
    setSelectedStaticIdx(index);
    setSelectedFieldIdx(null);
    setMode("idle");
    const st = staticTexts[index];
    interactionStartStatic.current = { x: e.clientX, y: e.clientY, text: { ...st } };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handleStaticResizePointerDown(e: React.PointerEvent, index: number, handle: string) {
    e.stopPropagation();
    e.preventDefault();
    setSelectedStaticIdx(index);
    setSelectedFieldIdx(null);
    setMode("idle");
    const st = staticTexts[index];
    interactionStartStatic.current = { x: e.clientX, y: e.clientY, text: { ...st } };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  // Canvas click — deselect or place unplaced field
  function handleCanvasClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
    const yPercent = ((e.clientY - rect.top) / rect.height) * 100;

    // If there's an unplaced field, place it
    const unplacedIndex = fields.findIndex(
      (f) => f.xPercent === 0 && f.yPercent === 0,
    );
    if (unplacedIndex >= 0) {
      const newFields = fields.map((f, i) =>
        i === unplacedIndex ? { ...f, xPercent, yPercent } : f,
      );
      setFields(newFields);
      pushHistory(newFields);
    } else {
      setSelectedFieldIdx(null);
    }
  }

  // Table region drag
  function handleCanvasMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (draggingRegion === null) return;
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const xPercent = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const yPercent = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));

    const idx = draggingRegion;
    setTableRegions((prev) =>
      prev.map((tr, i) =>
        i === idx ? { ...tr, anchorXPercent: xPercent, anchorYPercent: yPercent } : tr,
      ),
    );
  }

  function handleCanvasMouseUp() {
    setDraggingRegion(null);
  }

  function addTableRegion() {
    if (!templateTypeConfig.hasTableRegion) return;
    setTableRegions((prev) => [
      ...prev,
      {
        anchorXPercent: 10,
        anchorYPercent: 50,
        rowHeightPercent: 5,
        columns: (templateTypeConfig.tableColumns ?? []).map((c) => ({
          ...c,
          xPercent: 10,
        })),
      },
    ]);
  }

  function updateField(
    index: number,
    key: string,
    value: string | number | null,
  ) {
    const newFields = fields.map((f, i) =>
      i === index ? { ...f, [key]: value } : f,
    );
    setFields(newFields);
    pushHistory(newFields);
  }

  function addDuplicateField(index: number) {
    const original = fields[index];
    const newFields = [
      ...fields,
      {
        fieldKey: original.fieldKey,
        xPercent: Math.min(100, original.xPercent + 5),
        yPercent: Math.min(100, original.yPercent + 5),
        widthPercent: original.widthPercent,
        heightPercent: original.heightPercent,
        fontSize: original.fontSize,
        fontFamily: original.fontFamily,
        fontColor: original.fontColor,
        fontWeight: original.fontWeight,
        fontStyle: original.fontStyle,
        textDecoration: original.textDecoration,
        textAlign: original.textAlign,
      },
    ];
    setFields(newFields);
    pushHistory(newFields);
  }

  function removeField(index: number) {
    const newFields = fields.filter((_, i) => i !== index);
    setFields(newFields);
    pushHistory(newFields);
    if (selectedFieldIdx === index) setSelectedFieldIdx(null);
    else if (selectedFieldIdx !== null && selectedFieldIdx > index) {
      setSelectedFieldIdx(selectedFieldIdx - 1);
    }
  }

  function updateTableRegion(
    index: number,
    key: string,
    value: number,
  ) {
    setTableRegions((prev) =>
      prev.map((tr, i) =>
        i === index ? { ...tr, [key]: value } : tr,
      ),
    );
  }

  function updateTableRegionColumn(
    regionIndex: number,
    colIndex: number,
    key: string,
    value: number,
  ) {
    setTableRegions((prev) =>
      prev.map((tr, i) =>
        i === regionIndex
          ? {
              ...tr,
              columns: tr.columns.map((c, ci) =>
                ci === colIndex ? { ...c, [key]: value } : c,
              ),
            }
          : tr,
      ),
    );
  }

  async function handleSave() {
    try {
      setSaving(true);
      const res = await fetch(`/api/templates/${template.id}/fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields, tableRegions, staticTexts }),
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
    <div className="fixed inset-0 z-50 flex bg-black/50">
      <div className="flex h-full w-full flex-col bg-white">
        {/* Editor toolbar */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">
              Edit Fields — {templateTypeConfig.label}
            </h2>
            <p className="text-xs text-zinc-500">
              Drag fields on the canvas to position them. Use the formatting controls to style each field.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Undo/Redo */}
            <div className="flex items-center border border-zinc-300">
              <button
                onClick={undo}
                disabled={historyIndex <= 0}
                className="px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50 disabled:text-zinc-300 disabled:cursor-not-allowed border-r border-zinc-300"
                title="Undo"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 10h10a5 5 0 015 5v2M3 10l5 5M3 10l5-5"/></svg>
              </button>
              <button
                onClick={redo}
                disabled={historyIndex >= history.length - 1}
                className="px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50 disabled:text-zinc-300 disabled:cursor-not-allowed"
                title="Redo"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10H11a5 5 0 00-5 5v2M21 10l-5 5M21 10l-5-5"/></svg>
              </button>
            </div>
            <button
              onClick={() => {
                const newText: EditorStaticText = {
                  content: "New Label",
                  xPercent: 50,
                  yPercent: 50,
                  widthPercent: null,
                  heightPercent: null,
                  fontSize: 14,
                  fontFamily: "",
                  fontColor: "",
                  fontWeight: "",
                  fontStyle: "",
                  textDecoration: "",
                  textAlign: "left",
                };
                setStaticTexts((prev) => [...prev, newText]);
              }}
              className="border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
            >
              + Add Text Label
            </button>
            {templateTypeConfig.hasTableRegion && (
              <button
                onClick={addTableRegion}
                className="border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
              >
                + Add Table Region
              </button>
            )}
            <button
              onClick={onClose}
              className="border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Positions"}
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Canvas area */}
          <div className="flex-1 overflow-auto bg-zinc-100 p-8">
            <div
              ref={canvasRef}
              className="relative mx-auto bg-white shadow-sm border border-zinc-200"
              style={{ width: "700px", height: "990px", aspectRatio: "210/297" }}
              onClick={handleCanvasClick}
              onPointerMove={(e) => {
                handlePointerMove(e);
                // Also handle table region drag via mouse events
                if (draggingRegion !== null) {
                  handleCanvasMouseMove(e as any);
                }
              }}
              onPointerUp={() => {
                handlePointerUp();
                handleCanvasMouseUp();
              }}
              onPointerLeave={() => {
                handlePointerUp();
                handleCanvasMouseUp();
              }}
            >
              {/* Background image */}
              <img
                src={template.backgroundImageUrl}
                alt="Template background"
                className="pointer-events-none absolute inset-0 h-full w-full object-contain"
                draggable={false}
              />

              {/* Field markers — disambiguate duplicates */}
              {(() => {
                const keyCounts: Record<string, number> = {};
                fields.forEach((f) => {
                  keyCounts[f.fieldKey] = (keyCounts[f.fieldKey] ?? 0) + 1;
                });
                const keyIndices: Record<string, number> = {};
                return fields.map((field, i) => {
                  const count = keyCounts[field.fieldKey];
                  const idx = (keyIndices[field.fieldKey] ?? 0);
                  keyIndices[field.fieldKey] = idx + 1;
                  const label = count > 1 ? `${field.fieldKey} (${idx + 1})` : field.fieldKey;
                  const isSelected = selectedFieldIdx === i;
                  const hasSize = field.widthPercent != null && field.heightPercent != null;

                  return (
                    <div
                      key={`${field.fieldKey}-${i}`}
                      className="absolute select-none"
                      style={{
                        left: `${field.xPercent}%`,
                        top: `${field.yPercent}%`,
                        transform: "translate(-50%, -50%)",
                        ...(hasSize
                          ? {
                              width: `${field.widthPercent}%`,
                              height: `${field.heightPercent}%`,
                            }
                          : {}),
                        zIndex: isSelected ? 20 : 10,
                        cursor: mode === "dragging" && isSelected ? "grabbing" : "grab",
                      }}
                      onPointerDown={(e) => handleFieldPointerDown(e, i)}
                    >
                      {/* Field content box */}
                      <div
                        className={`h-full w-full border px-1 py-0.5 text-[10px] font-mono whitespace-nowrap overflow-hidden ${
                          isSelected
                            ? "border-blue-600 bg-blue-500/15 text-blue-800"
                            : "border-blue-400 bg-blue-500/10 text-blue-700"
                        }`}
                        style={{
                          fontSize: `${Math.min(field.fontSize, 14)}px`,
                          fontFamily: field.fontFamily || "monospace",
                          fontWeight: field.fontWeight || undefined,
                          fontStyle: field.fontStyle || undefined,
                          textAlign: field.textAlign,
                        }}
                      >
                        {label}
                      </div>

                      {/* Selection outline + resize handles */}
                      {isSelected && (
                        <>
                          {/* Corner handles */}
                          {(["top-left", "top-right", "bottom-left", "bottom-right"] as const).map((handle) => (
                            <div
                              key={handle}
                              className="absolute z-30"
                              style={{
                                width: "8px",
                                height: "8px",
                                background: "#2563eb",
                                border: "1px solid white",
                                ...(
                                  handle.includes("top") ? { top: "-4px" } : { bottom: "-4px" }
                                ),
                                ...(
                                  handle.includes("left") ? { left: "-4px" } : { right: "-4px" }
                                ),
                                cursor:
                                  handle === "top-left" || handle === "bottom-right"
                                    ? "nwse-resize"
                                    : "nesw-resize",
                              }}
                              onPointerDown={(e) => handleResizePointerDown(e, i, handle)}
                            />
                          ))}
                          {/* Edge handles */}
                          {(["top", "bottom", "left", "right"] as const).map((handle) => (
                            <div
                              key={handle}
                              className="absolute z-30"
                              style={{
                                background: "#2563eb",
                                border: "1px solid white",
                                ...(
                                  handle === "top"
                                    ? { top: "-4px", left: "50%", transform: "translateX(-50%)", width: "20px", height: "6px", cursor: "ns-resize" }
                                    : handle === "bottom"
                                    ? { bottom: "-4px", left: "50%", transform: "translateX(-50%)", width: "20px", height: "6px", cursor: "ns-resize" }
                                    : handle === "left"
                                    ? { left: "-4px", top: "50%", transform: "translateY(-50%)", width: "6px", height: "20px", cursor: "ew-resize" }
                                    : { right: "-4px", top: "50%", transform: "translateY(-50%)", width: "6px", height: "20px", cursor: "ew-resize" }
                                ),
                              }}
                              onPointerDown={(e) => handleResizePointerDown(e, i, handle)}
                            />
                          ))}
                        </>
                      )}
                    </div>
                  );
                });
              })()}

              {/* Static text markers on canvas */}
              {staticTexts.map((st, i) => {
                const isSelected = selectedStaticIdx === i;
                const hasSize = st.widthPercent != null && st.heightPercent != null;
                return (
                  <div
                    key={`st-canvas-${i}`}
                    className="absolute select-none"
                    style={{
                      left: `${st.xPercent}%`,
                      top: `${st.yPercent}%`,
                      transform: "translate(-50%, -50%)",
                      ...(hasSize
                        ? {
                            width: `${st.widthPercent}%`,
                            height: `${st.heightPercent}%`,
                          }
                        : {}),
                      zIndex: isSelected ? 20 : 10,
                      cursor: "grab",
                    }}
                    onPointerDown={(e) => handleStaticPointerDown(e, i)}
                  >
                    <div
                      className={`h-full w-full border px-1 py-0.5 text-[10px] whitespace-nowrap overflow-hidden ${
                        isSelected
                          ? "border-green-600 bg-green-500/15 text-green-800"
                          : "border-green-400 bg-green-500/10 text-green-700"
                      }`}
                      style={{
                        fontSize: `${Math.min(st.fontSize, 14)}px`,
                        fontFamily: st.fontFamily || "serif",
                        fontWeight: st.fontWeight || undefined,
                        fontStyle: st.fontStyle || undefined,
                        textAlign: st.textAlign,
                      }}
                    >
                      {st.content}
                    </div>
                    {isSelected && (
                      <>
                        {(["top-left", "top-right", "bottom-left", "bottom-right"] as const).map((handle) => (
                          <div
                            key={handle}
                            className="absolute z-30"
                            style={{
                              width: "8px",
                              height: "8px",
                              background: "#16a34a",
                              border: "1px solid white",
                              ...(handle.includes("top") ? { top: "-4px" } : { bottom: "-4px" }),
                              ...(handle.includes("left") ? { left: "-4px" } : { right: "-4px" }),
                              cursor: handle === "top-left" || handle === "bottom-right" ? "nwse-resize" : "nesw-resize",
                            }}
                          />
                        ))}
                        {(["top", "bottom", "left", "right"] as const).map((handle) => (
                          <div
                            key={handle}
                            className="absolute z-30"
                            style={{
                              background: "#16a34a",
                              border: "1px solid white",
                              ...(handle === "top"
                                ? { top: "-4px", left: "50%", transform: "translateX(-50%)", width: "20px", height: "6px", cursor: "ns-resize" }
                                : handle === "bottom"
                                ? { bottom: "-4px", left: "50%", transform: "translateX(-50%)", width: "20px", height: "6px", cursor: "ns-resize" }
                                : handle === "left"
                                ? { left: "-4px", top: "50%", transform: "translateY(-50%)", width: "6px", height: "20px", cursor: "ew-resize" }
                                : { right: "-4px", top: "50%", transform: "translateY(-50%)", width: "6px", height: "20px", cursor: "ew-resize" })
                            }}
                          />
                        ))}
                      </>
                    )}
                  </div>
                );
              })}

              {/* Table region markers */}
              {tableRegions.map((region, i) => (
                <div
                  key={`tr-${i}`}
                  className="absolute cursor-move border border-dashed border-orange-400 bg-orange-400/10"
                  style={{
                    left: `${region.anchorXPercent}%`,
                    top: `${region.anchorYPercent}%`,
                    width: "60%",
                    height: `${region.rowHeightPercent * 3}%`,
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setDraggingRegion(i);
                  }}
                >
                  <span className="absolute -top-4 left-0 text-[10px] font-mono text-orange-600">
                    Table Region {i + 1}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Field properties panel */}
          <div className="w-80 overflow-y-auto border-l border-zinc-200 p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase text-zinc-500">
              Single Fields
            </h3>
            <div className="space-y-2">
              {(() => {
                const keyCounts: Record<string, number> = {};
                fields.forEach((f) => {
                  keyCounts[f.fieldKey] = (keyCounts[f.fieldKey] ?? 0) + 1;
                });
                const keyIndices: Record<string, number> = {};
                return fields.map((field, i) => {
                  const count = keyCounts[field.fieldKey];
                  const idx = (keyIndices[field.fieldKey] ?? 0);
                  keyIndices[field.fieldKey] = idx + 1;
                  const label = count > 1 ? `${field.fieldKey} (${idx + 1})` : field.fieldKey;
                  return (
                    <div key={`${field.fieldKey}-${i}`} className="border border-zinc-200 p-2">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-[11px] font-medium text-zinc-700">
                          {label}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => addDuplicateField(i)}
                            className="text-[10px] text-blue-600 hover:text-blue-800"
                            title="Add another position for this field"
                          >
                            + Position
                          </button>
                          {count > 1 && (
                            <button
                              onClick={() => removeField(i)}
                              className="text-[10px] text-red-500 hover:text-red-700"
                              title="Remove this position"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </div>
                  <div className="grid grid-cols-2 gap-1">
                    <label className="text-[10px] text-zinc-500">
                      X%
                      <input
                        type="number"
                        value={Math.round(field.xPercent * 10) / 10}
                        onChange={(e) =>
                          updateField(i, "xPercent", parseFloat(e.target.value) || 0)
                        }
                        className="mt-0.5 block w-full border border-zinc-300 px-1.5 py-0.5 text-[11px] font-mono"
                        min={0}
                        max={100}
                        step={0.5}
                      />
                    </label>
                    <label className="text-[10px] text-zinc-500">
                      Y%
                      <input
                        type="number"
                        value={Math.round(field.yPercent * 10) / 10}
                        onChange={(e) =>
                          updateField(i, "yPercent", parseFloat(e.target.value) || 0)
                        }
                        className="mt-0.5 block w-full border border-zinc-300 px-1.5 py-0.5 text-[11px] font-mono"
                        min={0}
                        max={100}
                        step={0.5}
                      />
                    </label>
                    <label className="text-[10px] text-zinc-500">
                      Width%
                      <input
                        type="number"
                        value={field.widthPercent != null ? Math.round(field.widthPercent * 10) / 10 : ""}
                        placeholder="auto"
                        onChange={(e) =>
                          updateField(i, "widthPercent", e.target.value === "" ? null : parseFloat(e.target.value) || null)
                        }
                        className="mt-0.5 block w-full border border-zinc-300 px-1.5 py-0.5 text-[11px] font-mono"
                        min={2}
                        max={80}
                        step={0.5}
                      />
                    </label>
                    <label className="text-[10px] text-zinc-500">
                      Height%
                      <input
                        type="number"
                        value={field.heightPercent != null ? Math.round(field.heightPercent * 10) / 10 : ""}
                        placeholder="auto"
                        onChange={(e) =>
                          updateField(i, "heightPercent", e.target.value === "" ? null : parseFloat(e.target.value) || null)
                        }
                        className="mt-0.5 block w-full border border-zinc-300 px-1.5 py-0.5 text-[11px] font-mono"
                        min={1}
                        max={50}
                        step={0.5}
                      />
                    </label>
                    <label className="text-[10px] text-zinc-500">
                      Size
                      <input
                        type="number"
                        value={field.fontSize}
                        onChange={(e) =>
                          updateField(i, "fontSize", parseInt(e.target.value) || 12)
                        }
                        className="mt-0.5 block w-full border border-zinc-300 px-1.5 py-0.5 text-[11px] font-mono"
                        min={6}
                        max={72}
                      />
                    </label>
                    <label className="text-[10px] text-zinc-500">
                      Align
                      <select
                        value={field.textAlign}
                        onChange={(e) => updateField(i, "textAlign", e.target.value)}
                        className="mt-0.5 block w-full border border-zinc-300 px-1.5 py-0.5 text-[11px]"
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </label>
                  </div>
                  {/* Formatting controls */}
                  <div className="mt-1 grid grid-cols-2 gap-1">
                    <label className="text-[10px] text-zinc-500">
                      Font
                      <select
                        value={field.fontFamily}
                        onChange={(e) => updateField(i, "fontFamily", e.target.value)}
                        className="mt-0.5 block w-full border border-zinc-300 px-1.5 py-0.5 text-[11px]"
                      >
                        <option value="">Default</option>
                        <option value="Inter, sans-serif">Inter (Sans)</option>
                        <option value="Arial, sans-serif">Arial (Sans)</option>
                        <option value="Georgia, serif">Georgia (Serif)</option>
                        <option value="Times New Roman, serif">Times New Roman (Serif)</option>
                        <option value="Merriweather, serif">Merriweather (Serif)</option>
                        <option value="Playfair Display, serif">Playfair Display (Formal)</option>
                        <option value="Crimson Pro, serif">Crimson Pro (Serif)</option>
                        <option value="Courier New, monospace">Courier New (Mono)</option>
                      </select>
                    </label>
                    <label className="text-[10px] text-zinc-500">
                      Color
                      <input
                        type="color"
                        value={field.fontColor || "#000000"}
                        onChange={(e) => updateField(i, "fontColor", e.target.value)}
                        className="mt-0.5 block h-5 w-full border border-zinc-300 px-0.5 py-0"
                      />
                    </label>
                  </div>
                  {/* Style toggles */}
                  <div className="mt-1 flex gap-1">
                    <button
                      type="button"
                      onClick={() => updateField(i, "fontWeight", field.fontWeight === "bold" ? "" : "bold")}
                      className={`border px-1.5 py-0.5 text-[11px] font-bold ${field.fontWeight === "bold" ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"}`}
                      title="Bold"
                    >
                      B
                    </button>
                    <button
                      type="button"
                      onClick={() => updateField(i, "fontStyle", field.fontStyle === "italic" ? "" : "italic")}
                      className={`border px-1.5 py-0.5 text-[11px] italic ${field.fontStyle === "italic" ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"}`}
                      title="Italic"
                    >
                      I
                    </button>
                    <button
                      type="button"
                      onClick={() => updateField(i, "textDecoration", field.textDecoration === "underline" ? "" : "underline")}
                      className={`border px-1.5 py-0.5 text-[11px] underline ${field.textDecoration === "underline" ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"}`}
                      title="Underline"
                    >
                      U
                    </button>
                  </div>
                </div>
                  );
                });
              })()}
            </div>

            {/* Static Text Labels */}
            {staticTexts.length > 0 && (
              <>
                <h3 className="mb-3 mt-4 text-xs font-semibold uppercase text-zinc-500">
                  Text Labels
                </h3>
                <div className="space-y-2">
                  {staticTexts.map((st, i) => (
                    <div
                      key={`stp-${i}`}
                      className={`border p-2 ${selectedStaticIdx === i ? "border-green-500 bg-green-50" : "border-zinc-200"}`}
                      onClick={() => setSelectedStaticIdx(i)}
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-[11px] font-medium text-green-700">
                          Label {i + 1}
                        </span>
                        <button
                          onClick={() => {
                            setStaticTexts((prev) => prev.filter((_, idx) => idx !== i));
                            if (selectedStaticIdx === i) setSelectedStaticIdx(null);
                          }}
                          className="text-[10px] text-red-500 hover:text-red-700"
                        >
                          ×
                        </button>
                      </div>
                      <textarea
                        value={st.content}
                        onChange={(e) => {
                          const newSTs = staticTexts.map((s, idx) => idx === i ? { ...s, content: e.target.value } : s);
                          setStaticTexts(newSTs);
                        }}
                        className="mt-0.5 block w-full border border-zinc-300 px-1.5 py-0.5 text-[11px]"
                        rows={2}
                      />
                      <div className="mt-1 grid grid-cols-2 gap-1">
                        <label className="text-[10px] text-zinc-500">
                          X%
                          <input type="number" value={Math.round(st.xPercent * 10) / 10}
                            onChange={(e) => {
                              const newSTs = staticTexts.map((s, idx) => idx === i ? { ...s, xPercent: parseFloat(e.target.value) || 0 } : s);
                              setStaticTexts(newSTs);
                            }}
                            className="mt-0.5 block w-full border border-zinc-300 px-1.5 py-0.5 text-[11px] font-mono"
                            min={0} max={100} step={0.5}
                          />
                        </label>
                        <label className="text-[10px] text-zinc-500">
                          Y%
                          <input type="number" value={Math.round(st.yPercent * 10) / 10}
                            onChange={(e) => {
                              const newSTs = staticTexts.map((s, idx) => idx === i ? { ...s, yPercent: parseFloat(e.target.value) || 0 } : s);
                              setStaticTexts(newSTs);
                            }}
                            className="mt-0.5 block w-full border border-zinc-300 px-1.5 py-0.5 text-[11px] font-mono"
                            min={0} max={100} step={0.5}
                          />
                        </label>
                        <label className="text-[10px] text-zinc-500">
                          Width%
                          <input type="number" value={st.widthPercent != null ? Math.round(st.widthPercent * 10) / 10 : ""}
                            placeholder="auto"
                            onChange={(e) => {
                              const newSTs = staticTexts.map((s, idx) => idx === i ? { ...s, widthPercent: e.target.value === "" ? null : parseFloat(e.target.value) || null } : s);
                              setStaticTexts(newSTs);
                            }}
                            className="mt-0.5 block w-full border border-zinc-300 px-1.5 py-0.5 text-[11px] font-mono"
                            min={2} max={80} step={0.5}
                          />
                        </label>
                        <label className="text-[10px] text-zinc-500">
                          Height%
                          <input type="number" value={st.heightPercent != null ? Math.round(st.heightPercent * 10) / 10 : ""}
                            placeholder="auto"
                            onChange={(e) => {
                              const newSTs = staticTexts.map((s, idx) => idx === i ? { ...s, heightPercent: e.target.value === "" ? null : parseFloat(e.target.value) || null } : s);
                              setStaticTexts(newSTs);
                            }}
                            className="mt-0.5 block w-full border border-zinc-300 px-1.5 py-0.5 text-[11px] font-mono"
                            min={1} max={50} step={0.5}
                          />
                        </label>
                      </div>
                      {/* Font + Size + Align */}
                      <div className="mt-1 grid grid-cols-3 gap-1">
                        <label className="text-[10px] text-zinc-500">
                          Font
                          <select value={st.fontFamily}
                            onChange={(e) => {
                              const newSTs = staticTexts.map((s, idx) => idx === i ? { ...s, fontFamily: e.target.value } : s);
                              setStaticTexts(newSTs);
                            }}
                            className="mt-0.5 block w-full border border-zinc-300 px-1.5 py-0.5 text-[11px]"
                          >
                            <option value="">Default</option>
                            <option value="Inter, sans-serif">Inter (Sans)</option>
                            <option value="Arial, sans-serif">Arial (Sans)</option>
                            <option value="Georgia, serif">Georgia (Serif)</option>
                            <option value="Times New Roman, serif">Times New Roman (Serif)</option>
                            <option value="Merriweather, serif">Merriweather (Serif)</option>
                            <option value="Playfair Display, serif">Playfair Display (Formal)</option>
                            <option value="Crimson Pro, serif">Crimson Pro (Serif)</option>
                            <option value="Courier New, monospace">Courier New (Mono)</option>
                          </select>
                        </label>
                        <label className="text-[10px] text-zinc-500">
                          Size
                          <input type="number" value={st.fontSize}
                            onChange={(e) => {
                              const newSTs = staticTexts.map((s, idx) => idx === i ? { ...s, fontSize: parseInt(e.target.value) || 12 } : s);
                              setStaticTexts(newSTs);
                            }}
                            className="mt-0.5 block w-full border border-zinc-300 px-1.5 py-0.5 text-[11px] font-mono"
                            min={6} max={72}
                          />
                        </label>
                        <label className="text-[10px] text-zinc-500">
                          Align
                          <select value={st.textAlign}
                            onChange={(e) => {
                              const newSTs = staticTexts.map((s, idx) => idx === i ? { ...s, textAlign: e.target.value as any } : s);
                              setStaticTexts(newSTs);
                            }}
                            className="mt-0.5 block w-full border border-zinc-300 px-1.5 py-0.5 text-[11px]"
                          >
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                          </select>
                        </label>
                      </div>
                      <div className="mt-1 flex gap-1">
                        <button type="button"
                          onClick={() => {
                            const newSTs = staticTexts.map((s, idx) => idx === i ? { ...s, fontWeight: s.fontWeight === "bold" ? "" : "bold" } : s);
                            setStaticTexts(newSTs);
                          }}
                          className={`border px-1.5 py-0.5 text-[11px] font-bold ${st.fontWeight === "bold" ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"}`}
                        >B</button>
                        <button type="button"
                          onClick={() => {
                            const newSTs = staticTexts.map((s, idx) => idx === i ? { ...s, fontStyle: s.fontStyle === "italic" ? "" : "italic" } : s);
                            setStaticTexts(newSTs);
                          }}
                          className={`border px-1.5 py-0.5 text-[11px] italic ${st.fontStyle === "italic" ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"}`}
                        >I</button>
                        <button type="button"
                          onClick={() => {
                            const newSTs = staticTexts.map((s, idx) => idx === i ? { ...s, textDecoration: s.textDecoration === "underline" ? "" : "underline" } : s);
                            setStaticTexts(newSTs);
                          }}
                          className={`border px-1.5 py-0.5 text-[11px] underline ${st.textDecoration === "underline" ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"}`}
                        >U</button>
                        <label className="text-[10px] text-zinc-500 ml-2">
                          Color
                          <input type="color" value={st.fontColor || "#000000"}
                            onChange={(e) => {
                              const newSTs = staticTexts.map((s, idx) => idx === i ? { ...s, fontColor: e.target.value } : s);
                              setStaticTexts(newSTs);
                            }}
                            className="mt-0.5 block h-5 w-8 border border-zinc-300 px-0.5 py-0"
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {tableRegions.length > 0 && (
              <>
                <h3 className="mb-3 mt-4 text-xs font-semibold uppercase text-zinc-500">
                  Table Regions
                </h3>
                <div className="space-y-3">
                  {tableRegions.map((region, ri) => (
                    <div
                      key={`trp-${ri}`}
                      className="border border-orange-200 bg-orange-50/50 p-2"
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-[11px] font-medium text-orange-700">
                          Region {ri + 1}
                        </span>
                        <button
                          onClick={() =>
                            setTableRegions((prev) =>
                              prev.filter((_, i) => i !== ri),
                            )
                          }
                          className="text-[10px] text-red-500 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        <label className="text-[10px] text-zinc-500">
                          Anchor X%
                          <input
                            type="number"
                            value={Math.round(region.anchorXPercent * 10) / 10}
                            onChange={(e) =>
                              updateTableRegion(
                                ri,
                                "anchorXPercent",
                                parseFloat(e.target.value) || 0,
                              )
                            }
                            className="mt-0.5 block w-full border border-zinc-300 px-1.5 py-0.5 text-[11px] font-mono"
                            min={0}
                            max={100}
                            step={0.5}
                          />
                        </label>
                        <label className="text-[10px] text-zinc-500">
                          Anchor Y%
                          <input
                            type="number"
                            value={Math.round(region.anchorYPercent * 10) / 10}
                            onChange={(e) =>
                              updateTableRegion(
                                ri,
                                "anchorYPercent",
                                parseFloat(e.target.value) || 0,
                              )
                            }
                            className="mt-0.5 block w-full border border-zinc-300 px-1.5 py-0.5 text-[11px] font-mono"
                            min={0}
                            max={100}
                            step={0.5}
                          />
                        </label>
                        <label className="text-[10px] text-zinc-500">
                          Row Height %
                          <input
                            type="number"
                            value={Math.round(region.rowHeightPercent * 10) / 10}
                            onChange={(e) =>
                              updateTableRegion(
                                ri,
                                "rowHeightPercent",
                                parseFloat(e.target.value) || 1,
                              )
                            }
                            className="mt-0.5 block w-full border border-zinc-300 px-1.5 py-0.5 text-[11px] font-mono"
                            min={0.5}
                            max={50}
                            step={0.5}
                          />
                        </label>
                      </div>

                      {/* Column positions */}
                      <div className="mt-2 space-y-1">
                        <span className="text-[10px] text-zinc-500">Column X%:</span>
                        {region.columns.map((col, ci) => (
                          <div
                            key={col.fieldKey}
                            className="flex items-center gap-1"
                          >
                            <span className="w-20 truncate text-[10px] text-zinc-600">
                              {col.label}
                            </span>
                            <input
                              type="number"
                              value={Math.round(col.xPercent * 10) / 10}
                              onChange={(e) =>
                                updateTableRegionColumn(
                                  ri,
                                  ci,
                                  "xPercent",
                                  parseFloat(e.target.value) || 0,
                                )
                              }
                              className="w-16 border border-zinc-300 px-1 py-0.5 text-[11px] font-mono"
                              min={0}
                              max={100}
                              step={0.5}
                            />
                            <span className="text-[10px] text-zinc-400">%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
