import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSchoolSettings } from "@/lib/school-settings";

/**
 * /print/salary-slips/:id
 *
 * Coded print layout for a saved Salary Slip (immutable snapshot).
 * Per the SRS assumption, Salary Slip ships with a coded layout rather than
 * requiring an uploaded template (like certs/challans, a SALARY_SLIP template
 * type can be added to the document template system later — the model already
 * has templateId-ready immutability via snapshotting).
 */
export default async function PrintSalarySlipPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [slip, school] = await Promise.all([
    prisma.salarySlip.findUnique({
      where: { id },
      include: {
        teacher: { select: { id: true, name: true, phone: true } },
        generatedByUser: { select: { id: true, name: true } },
        deductions: { orderBy: { date: "asc" } },
      },
    }),
    getSchoolSettings(),
  ]);

  if (!slip) notFound();

  const dateStr = (d: Date) =>
    d.toLocaleDateString("en-PK", { year: "numeric", month: "long", day: "numeric" });

  const deductionTotal = slip.deductions.reduce((sum, d) => sum + d.amount, 0);
  const issuedStr = slip.issuedDate.toLocaleDateString("en-PK", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="salary-slip-document mx-auto max-w-[700px] print-break-inside-avoid">
      {/* Header */}
      <div className="mb-6 border-b-2 border-text pb-4 text-center">
        {school.logoPath && (
          <img src={school.logoPath} alt="School logo" className="mx-auto mb-2 h-16 object-contain" />
        )}
        <h1 className="text-lg font-bold uppercase tracking-wide">{school.schoolName}</h1>
        {school.address && <p className="text-xs text-text/60">{school.address}</p>}
        <h2 className="mt-2 text-xl font-bold uppercase tracking-wider">Salary Slip</h2>
      </div>

      {/* Teacher + period */}
      <div className="mb-6 grid grid-cols-2 gap-4 border border-border p-4 text-sm">
        <div className="space-y-1">
          <p>
            <span className="text-text/50">Teacher: </span>
            <strong>{slip.teacher.name}</strong>
          </p>
          <p>
            <span className="text-text/50">Period: </span>
            <strong>
              {dateStr(slip.periodFrom)} — {dateStr(slip.periodTo)}
            </strong>
          </p>
        </div>
        <div className="space-y-1 text-right">
          <p>
            <span className="text-text/50">Per-day salary: </span>
            <strong>Rs. {slip.perDaySalary.toLocaleString()}</strong>
          </p>
          <p>
            <span className="text-text/50">Late deduction: </span>
            <strong>
              {slip.lateDeductionType === "AMOUNT"
                ? `Rs. ${slip.lateDeductionValue.toLocaleString()}`
                : `${slip.lateDeductionValue}% of daily pay`}
            </strong>
          </p>
        </div>
      </div>

      {/* Deductions */}
      {slip.deductions.length > 0 ? (
        <div className="mb-6">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text/70">
            Deductions
          </h3>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-y border-border bg-surface">
                <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-text/60">Date</th>
                <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-text/60">Type</th>
                <th className="w-24 px-3 py-2 text-right font-semibold uppercase tracking-wide text-text/60">Amount</th>
              </tr>
            </thead>
            <tbody>
              {slip.deductions.map((d) => (
                <tr key={d.id} className="border-b border-border">
                  <td className="px-3 py-2 tabular-nums">{dateStr(d.date)}</td>
                  <td className="px-3 py-2">
                    {d.type === "ABSENT" ? "Absent (unpaid day)" : "Late"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">Rs. {d.amount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mb-6 text-sm text-text/60">No deductions for this period.</p>
      )}

      {/* Totals */}
      <div className="border-t-2 border-text pt-4">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-text/50">Base amount</span>
            <span className="tabular-nums">Rs. {slip.baseAmount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text/50">Deductions ({slip.deductions.length})</span>
            <span className="tabular-nums text-danger">− Rs. {deductionTotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
            <span>Net payable</span>
            <span className="tabular-nums">Rs. {slip.netAmount.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-10 flex items-end justify-between text-xs text-text/50">
        <div>
          <p>Generated by: {slip.generatedByUser.name}</p>
          <p className="mt-1">Issued: {issuedStr}</p>
        </div>
        <div className="text-right">
          <div className="mb-1 border-t border-text/40 pt-1">
            {school.principalName ? school.principalName : "Principal"}&apos;s Signature
          </div>
        </div>
      </div>
    </div>
  );
}