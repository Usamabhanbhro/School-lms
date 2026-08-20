"use client";

/**
 * TemplateRenderer — Shared print view for document types.
 *
 * Fetches the active template (or document-specific snapshot),
 * renders the background image, and absolutely positions text fields
 * and table regions at saved percentage coordinates.
 *
 * Used by:
 * - Certificate print view
 * - Report Card print view
 * - Fee Challan print view
 */

interface TemplateField {
  id: string;
  fieldKey: string;
  xPercent: number;
  yPercent: number;
  fontSize: number;
  textAlign: string;
}

interface TemplateTableRegion {
  id: string;
  anchorXPercent: number;
  anchorYPercent: number;
  rowHeightPercent: number;
  columns: Array<{ fieldKey: string; xPercent: number; label: string }>;
}

interface TemplateData {
  backgroundImageUrl: string;
  fields: TemplateField[];
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

      {/* Single field values */}
      {template.fields.map((field) => {
        const value = fieldValues[field.fieldKey];
        if (value === undefined || value === null) return null;

        return (
          <div
            key={field.id}
            className="absolute"
            style={{
              left: `${field.xPercent}%`,
              top: `${field.yPercent}%`,
              transform: "translate(-50%, -50%)",
              fontSize: `${field.fontSize}px`,
              fontFamily: "inherit",
              textAlign: field.textAlign as "left" | "center" | "right",
              lineHeight: 1.2,
              color: "#000",
              whiteSpace: "pre-wrap",
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

        return (
          <div key={region.id} className="absolute inset-0">
            {rows.map((row, rowIndex) => (
              <div key={rowIndex} className="absolute" style={{ width: "100%", height: "100%" }}>
                {region.columns.map((col) => {
                  const value = row[col.fieldKey];
                  if (value === undefined || value === null) return null;

                  return (
                    <div
                      key={col.fieldKey}
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
    <div className="flex h-64 items-center justify-center border border-dashed border-zinc-300 bg-zinc-50">
      <div className="text-center">
        <svg
          className="mx-auto h-12 w-12 text-zinc-400"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
          />
        </svg>
        <p className="mt-2 text-sm text-zinc-600">
          No template configured — ask your Admin to upload one in Settings.
        </p>
        <p className="mt-1 text-xs text-zinc-400">
          Document type: {documentType.replace(/_/g, " ")}
        </p>
      </div>
    </div>
  );
}
