import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSchoolSettings } from "@/lib/school-settings";
import { TemplateRenderer, NoTemplateFallback } from "@/components/templates/template-renderer";

/**
 * /print/fee-challans/:id
 *
 * Printable Fee Challan — uses template-based rendering if available.
 * The template is the FULL page with all three copies (Bank/Student/School)
 * manually laid out by Admin. Falls back to coded three-copy layout.
 *
 * Server component — fetches data directly from Prisma.
 */
const COPY_LABELS = ["Bank Copy", "Student Copy", "School Copy"] as const;

export default async function PrintFeeChallanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [challan, school] = await Promise.all([
    prisma.feeChallan.findUnique({
      where: { id },
      include: {
        lineItems: true,
        student: {
          select: { id: true, name: true },
        },
        generatedByUser: {
          select: { id: true, name: true },
        },
      },
    }),
    getSchoolSettings(),
  ]);

  if (!challan) {
    notFound();
  }

  const issuedDateStr = challan.issuedDate.toLocaleDateString("en-PK", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Try to load template — wrapped in try/catch because these are
  // separate DB calls that can fail independently.
  let template = null;
  try {
    if (challan.templateId) {
      template = await prisma.documentTemplate.findUnique({
        where: { id: challan.templateId },
        include: { fields: true, tableRegions: true },
      });
    }
    if (!template) {
      template = await prisma.documentTemplate.findFirst({
        where: { type: "FEE_CHALLAN" as any, isActive: true },
        include: { fields: true, tableRegions: true },
      });
    }
  } catch {
    template = null;
  }

  // If template exists, use template-based rendering
  if (template) {
    const fieldValues: Record<string, string> = {
      studentName: challan.studentNameSnapshot,
      guardianName: challan.guardianNameSnapshot,
      guardianCnic: challan.guardianCnicSnapshot,
      classSection: challan.classSectionSnapshot,
      bankName: challan.bankNameSnapshot,
      bankAccountNumber: challan.bankAccountNumberSnapshot,
      issueDate: issuedDateStr,
      total: challan.total.toLocaleString("en-PK"),
    };

    // Build line item rows for the table region
    const lineItemRows: Array<Record<string, string>> = challan.lineItems.map((item) => ({
      description: item.description,
      amount: item.amount.toLocaleString("en-PK"),
    }));

    return (
      <TemplateRenderer
        template={{
          backgroundImageUrl: template.backgroundImageUrl,
          fields: template.fields.map((f) => ({
            id: f.id,
            fieldKey: f.fieldKey,
            xPercent: f.xPercent,
            yPercent: f.yPercent,
            widthPercent: f.widthPercent,
            heightPercent: f.heightPercent,
            fontSize: f.fontSize,
            fontFamily: f.fontFamily,
            fontColor: f.fontColor,
            fontWeight: f.fontWeight,
            fontStyle: f.fontStyle,
            textDecoration: f.textDecoration,
            textAlign: f.textAlign,
          })),
          tableRegions: template.tableRegions.map((tr) => ({
            id: tr.id,
            anchorXPercent: tr.anchorXPercent,
            anchorYPercent: tr.anchorYPercent,
            rowHeightPercent: tr.rowHeightPercent,
            columns: tr.columns as any,
          })),
        }}
        fieldValues={fieldValues}
        tableData={{ 0: lineItemRows }}
      />
    );
  }

  // Fallback: coded three-copy layout
  return (
    <div className="mx-auto max-w-[700px]">
      {COPY_LABELS.map((label) => (
        <ChallanCopy
          key={label}
          copyLabel={label}
          challan={challan}
          issuedDateStr={issuedDateStr}
          school={school}
        />
      ))}
    </div>
  );
}

/**
 * Reusable challan copy component.
 */
function ChallanCopy({
  copyLabel,
  challan,
  issuedDateStr,
  school,
}: {
  copyLabel: string;
  challan: {
    id: string;
    studentNameSnapshot: string;
    guardianNameSnapshot: string;
    guardianCnicSnapshot: string;
    classSectionSnapshot: string;
    bankNameSnapshot: string;
    bankAccountNumberSnapshot: string;
    total: number;
    lineItems: { description: string; amount: number }[];
    generatedByUser: { name: string | null } | null;
  };
  issuedDateStr: string;
  school: {
    schoolName: string;
    address: string;
    logoPath: string | null;
  };
}) {
  return (
    <div className="challan-copy border border-border p-6">
      {/* Copy label */}
      <div className="mb-4 border-b-2 border-text pb-3 text-center">
        <h2 className="text-xs font-bold uppercase tracking-widest text-text/50">
          {copyLabel}
        </h2>
        {school.logoPath && (
          <img
            src={school.logoPath}
            alt="School logo"
            className="mx-auto my-2 h-10 object-contain"
          />
        )}
        <h1 className="text-lg font-bold uppercase tracking-wide">
          {school.schoolName} — Fee Challan
        </h1>
      </div>

      {/* Challan header info */}
      <div className="mb-4 grid grid-cols-2 gap-4 text-xs">
        <div className="space-y-1">
          <p>
            <span className="text-text/50">Student: </span>
            <strong>{challan.studentNameSnapshot}</strong>
          </p>
          <p>
            <span className="text-text/50">Guardian: </span>
            <strong>{challan.guardianNameSnapshot}</strong>
          </p>
          <p>
            <span className="text-text/50">CNIC: </span>
            <strong className="tabular-nums">{challan.guardianCnicSnapshot}</strong>
          </p>
        </div>
        <div className="space-y-1 text-right">
          <p>
            <span className="text-text/50">Class: </span>
            <strong>{challan.classSectionSnapshot}</strong>
          </p>
          <p>
            <span className="text-text/50">Date: </span>
            <strong>{issuedDateStr}</strong>
          </p>
          <p>
            <span className="text-text/50">Challan #: </span>
            <strong className="tabular-nums">{challan.id.slice(0, 8).toUpperCase()}</strong>
          </p>
        </div>
      </div>

      {/* Line items table */}
      <table className="mb-4 w-full border-collapse text-xs">
        <thead>
          <tr className="border-y border-border bg-surface">
            <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-text/60">
              Description
            </th>
            <th className="w-24 px-3 py-2 text-right font-semibold uppercase tracking-wide text-text/60">
              Amount (PKR)
            </th>
          </tr>
        </thead>
        <tbody>
          {challan.lineItems.map((item, i) => (
            <tr key={i} className="border-b border-border">
              <td className="px-3 py-2">{item.description}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {item.amount.toLocaleString("en-PK")}
              </td>
            </tr>
          ))}
          <tr className="border-t-2 border-text font-bold">
            <td className="px-3 py-2">Total</td>
            <td className="px-3 py-2 text-right tabular-nums">
              {challan.total.toLocaleString("en-PK")}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Bank details */}
      <div className="mb-4 border border-border p-3 text-xs">
        <p className="mb-1 font-semibold uppercase tracking-wide text-text/50">
          Bank Details
        </p>
        <p>
          <span className="text-text/50">Bank: </span>
          <strong>{challan.bankNameSnapshot}</strong>
        </p>
        <p>
          <span className="text-text/50">Account: </span>
          <strong className="tabular-nums">{challan.bankAccountNumberSnapshot}</strong>
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-end justify-between text-xs text-text/50">
        <p>Generated by: {challan.generatedByUser?.name ?? "System"}</p>
        <p>Issued: {issuedDateStr}</p>
      </div>
    </div>
  );
}
