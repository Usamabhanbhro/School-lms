import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

/**
 * /print/fee-challans/:id
 *
 * Printable Fee Challan — renders EXACTLY THREE copies on one page:
 *   1. Bank Copy
 *   2. Student Copy
 *   3. School Copy
 *
 * All three copies use the same underlying FeeChallan data.
 * The reusable ChallanCopy component receives `copyLabel` and `challan`
 * and is rendered exactly three times by the parent.
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

  const challan = await prisma.feeChallan.findUnique({
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
  });

  if (!challan) {
    notFound();
  }

  const issuedDateStr = challan.issuedDate.toLocaleDateString("en-PK", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="mx-auto max-w-[700px]">
      {COPY_LABELS.map((label) => (
        <ChallanCopy
          key={label}
          copyLabel={label}
          challan={challan}
          issuedDateStr={issuedDateStr}
        />
      ))}
    </div>
  );
}

/**
 * Reusable challan copy component.
 * Receives the copy label and the full challan data.
 * Rendered exactly three times by the parent page.
 */
function ChallanCopy({
  copyLabel,
  challan,
  issuedDateStr,
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
}) {
  return (
    <div className="challan-copy border border-border p-6">
      {/* Copy label — prominently displayed */}
      <div className="mb-4 border-b-2 border-text pb-3 text-center">
        <h2 className="text-xs font-bold uppercase tracking-widest text-text/50">
          {copyLabel}
        </h2>
        <h1 className="mt-2 text-lg font-bold uppercase tracking-wide">
          School LMS — Fee Challan
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
