"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Upload,
} from "lucide-react";
import { TemplateEditor } from "./editor/template-editor";

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
        <div className="space-y-6 p-6">
          {TEMPLATE_TYPES.map((t) => (
            <div key={t.value} className="border border-border bg-bg">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-5 w-24" />
                </div>
                <Skeleton className="h-8 w-32" />
              </div>
              <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-80 max-w-full" />
              </div>
            </div>
          ))}
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
              className="border border-border bg-bg"
            >
              {/* Section header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-text">
                    {typeInfo.label}
                  </h3>
                  {activeTemplate ? (
                    <Badge variant="success" icon={<CheckCircle2 className="size-3" aria-hidden="true" />}>
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="neutral" icon={<AlertTriangle className="size-3" aria-hidden="true" />}>
                      No active template
                    </Badge>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => triggerUpload(typeInfo.value)}
                  disabled={uploading}
                >
                  {uploading && uploadingType === typeInfo.value ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="size-3.5" aria-hidden="true" />
                      Upload Template
                    </>
                  )}
                </Button>
              </div>

              {/* Template list */}
              {typeTemplates.length === 0 ? (
                <EmptyState
                  title="No templates uploaded"
                  description={`Upload a template image (PNG/JPG) or PDF for ${typeInfo.label}. The file will be converted to an image and used as the background for document generation.`}
                  action={
                    <button
                      onClick={() => triggerUpload(typeInfo.value)}
                      disabled={uploading}
                      className="mt-2 inline-flex items-center gap-1.5 border border-primary bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
                    >
                      {uploading && uploadingType === typeInfo.value ? "Uploading..." : "Upload Template"}
                    </button>
                  }
                />
              ) : (
                <div className="divide-y divide-border">
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
                        className="flex flex-col items-start gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex items-center gap-4">
                          {/* Thumbnail preview */}
                          <div className="h-24 w-16 sm:h-32 sm:w-24 shrink-0 overflow-hidden border border-border bg-surface">
                            <img
                              src={template.backgroundImageUrl}
                              alt={`Template for ${typeInfo.label}`}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-text">
                                {new Date(template.createdAt).toLocaleDateString()}
                              </span>
                              {template.isActive && (
                                <Badge
                                  variant="success"
                                  icon={<CheckCircle2 className="size-2.5" aria-hidden="true" />}
                                  className="text-[10px] py-0 px-1.5"
                                >
                                  ACTIVE
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-text/60">
                              {template.fields.length} fields ·{" "}
                              {template.tableRegions.length} table regions ·{" "}
                              {docCount} document(s) generated
                            </p>
                          </div>
                        </div>

                        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                          <Button
                            size="xs"
                            variant="secondary"
                            onClick={() => setEditingTemplate(template)}
                          >
                            Edit Fields
                          </Button>
                          {!template.isActive && (
                            <Button
                              size="xs"
                              variant="secondary"
                              onClick={() => handleActivate(template)}
                            >
                              Activate
                            </Button>
                          )}
                          <Button
                            size="xs"
                            variant="danger"
                            onClick={() => setDeleteTarget(template)}
                          >
                            Delete
                          </Button>
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
        <p className="text-xs text-text/60">
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
