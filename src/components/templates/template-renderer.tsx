"use client";

import { FileQuestion } from "lucide-react";

interface TemplateField {
  id: string;
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
}

interface TemplateTableRegion {
  id: string;
  anchorXPercent: number;
  anchorYPercent: number;
  rowHeightPercent: number;
  columns: unknown;
}

/**
 * Defensive validation for table region columns shape.
 * Returns validated columns or null if malformed.
 * A malformed columns shape from the database Json field would
 * silently produce blank cells at print time without this check.
 */
function validateColumns(columns: unknown): Array<{ fieldKey: string; xPercent: number; label: string }> | null {
  if (!Array.isArray(columns)) return null;
  if (columns.length === 0) return null;
  return columns.every(
    (c) =>
      typeof c === "object" &&
      c !== null &&
      typeof (c as any).fieldKey === "string" &&
      typeof (c as any).xPercent === "number" &&
      typeof (c as any).label === "string",
  )
    ? (columns as Array<{ fieldKey: string; xPercent: number; label: string }>)
    : null;
}

interface StaticText {
  id: string;
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
}

interface TemplateData {
  backgroundImageUrl: string;
  fields: TemplateField[];
  staticTexts?: StaticText[];
  tableRegions: TemplateTableRegion[];
}

interface TemplateRendererProps {
  template: TemplateData;
  /** Map of fieldKey → display value for single fields */
  fieldValues: Record<string, string>;
  /**
   * Map of table region index → array of row data.
   * Each row is a Record of fieldKey → display value.
   * The renderer lays out N rows starting at the anchor,
   * incrementing y by rowHeightPercent per row.
   */
  tableData?: Record<number, Array<Record<string, string>>>;
  /** Print page dimensions — defaults to A4 portrait (210mm × 297mm) */
  width?: string;
  height?: string;
  className?: string;
}

export function TemplateRenderer({
  template,
  fieldValues,
  tableData = {},
  width = "210mm",
  height = "297mm",
  className = "",
}: TemplateRendererProps) {
  return (
    <div
      className={`relative bg-white ${className}`}
      style={{ width, height, aspectRatio: "210/297" }}
    >
      {/* Background image */}
      <img
        src={template.backgroundImageUrl}
        alt="Document template"
        className="pointer-events-none absolute inset-0 h-full w-full object-contain"
        draggable={false}
      />

      {/* Static text labels */}
      {(template.staticTexts ?? []).map((st) => {
        const hasExplicitSize = st.widthPercent != null && st.heightPercent != null;

        return (
          <div
            key={`st-${st.id}`}
            className="absolute"
            style={{
              left: `${st.xPercent}%`,
              top: `${st.yPercent}%`,
              ...(hasExplicitSize
                ? {
                    width: `${st.widthPercent}%`,
                    height: `${st.heightPercent}%`,
                    transform: "translate(-50%, -50%)",
                  }
                : {
                    transform: "translate(-50%, -50%)",
                  }),
              fontSize: `${st.fontSize}px`,
              fontFamily: st.fontFamily || "inherit",
              fontWeight: (st.fontWeight as React.CSSProperties['fontWeight']) || undefined,
              fontStyle: (st.fontStyle as React.CSSProperties['fontStyle']) || undefined,
              textDecoration: (st.textDecoration as React.CSSProperties['textDecoration']) || undefined,
              textAlign: st.textAlign as "left" | "center" | "right",
              lineHeight: 1.2,
              color: st.fontColor || "#000",
              whiteSpace: "pre-wrap",
              overflow: "hidden",
            }}
          >
            {st.content}
          </div>
        );
      })}

      {/* Single field values */}
      {template.fields.map((field) => {
        const value = fieldValues[field.fieldKey];
        if (value === undefined || value === null) return null;

        const hasExplicitSize = field.widthPercent != null && field.heightPercent != null;

        return (
          <div
            key={field.id}
            className="absolute"
            style={{
              left: `${field.xPercent}%`,
              top: `${field.yPercent}%`,
              ...(hasExplicitSize
                ? {
                    width: `${field.widthPercent}%`,
                    height: `${field.heightPercent}%`,
                    transform: "translate(-50%, -50%)",
                  }
                : {
                    transform: "translate(-50%, -50%)",
                  }),
              fontSize: `${field.fontSize}px`,
              fontFamily: field.fontFamily || "inherit",
              fontWeight: (field.fontWeight as React.CSSProperties['fontWeight']) || undefined,
              fontStyle: (field.fontStyle as React.CSSProperties['fontStyle']) || undefined,
              textDecoration: (field.textDecoration as React.CSSProperties['textDecoration']) || undefined,
              textAlign: field.textAlign as "left" | "center" | "right",
              lineHeight: 1.2,
              color: field.fontColor || "#000",
              whiteSpace: "pre-wrap",
              overflow: "hidden",
            }}
          >
            {value}
          </div>
        );
      })}

      {/* Table regions */}
      {template.tableRegions.map((region, regionIndex) => {
        const rows = tableData[regionIndex] ?? [];
        if (rows.length === 0) return null;

        const validColumns = validateColumns(region.columns);
        if (!validColumns) {
          return (
            <div
              key={region.id}
              className="absolute border border-dashed border-red-400 bg-red-50 p-2 text-[10px] text-red-600"
              style={{
                left: `${region.anchorXPercent}%`,
                top: `${region.anchorYPercent}%`,
              }}
            >
              ⚠ Table region has invalid column configuration — ask your Admin to re-save field positions.
            </div>
          );
        }

        return (
          <div key={region.id} className="absolute inset-0">
            {rows.map((row, rowIndex) => (
              <div key={rowIndex} className="absolute" style={{ width: "100%", height: "100%" }}>
                {validColumns.map((col) => {
                  const value = row[col.fieldKey];
                  if (value === undefined || value === null) return null;

                  return (
                    <div
                      key={`${region.id}-${rowIndex}-${col.fieldKey}`}
                      className="absolute"
                      style={{
                        left: `${col.xPercent}%`,
                        top: `${region.anchorYPercent + rowIndex * region.rowHeightPercent}%`,
                        fontSize: "11px",
                        fontFamily: "inherit",
                        textAlign: "left",
                        lineHeight: 1.2,
                        color: "#000",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {value}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/**
 * No-template fallback component.
 * Shown when no active template is configured for a document type.
 */
export function NoTemplateFallback({ documentType }: { documentType: string }) {
  return (
    <div className="flex h-64 items-center justify-center border border-dashed border-border bg-surface">
      <div className="text-center">
        <FileQuestion
          className="mx-auto size-10 text-text/40"
          aria-hidden="true"
        />
        <p className="mt-2 text-sm text-text/70">
          No template configured — ask your Admin to upload one in Settings.
        </p>
        <p className="mt-1 text-xs text-text/50">
          Document type: {documentType.replace(/_/g, " ")}
        </p>
      </div>
    </div>
  );
}
