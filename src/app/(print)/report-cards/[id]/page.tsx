import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSchoolSettings } from "@/lib/school-settings";

/**
 * /print/report-cards/:id
 *
 * Printable Report Card — aggregated term report showing all tests
 * selected during report card generation, grouped by subject.
 *
 * Server component — fetches data directly from Prisma.
 *
 * Layout follows DESIGN.md: industrial, minimal, functional.
 * Tables use ruled-table styling. Numerical columns use tabular figures.
 * Print CSS prevents awkward page splits.
 */
export default async function PrintReportCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [reportCard, school] = await Promise.all([
    prisma.reportCard.findUnique({
      where: { id },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            guardianName: true,
          },
        },
        classSection: {
          select: { className: true, sectionName: true },
        },
        term: {
          select: { name: true },
        },
        generatedByTeacher: {
          select: { name: true },
        },
        reportCardTests: {
          include: {
            test: {
              select: {
                id: true,
                title: true,
                date: true,
                maxMarks: true,
                subject: { select: { name: true } },
              },
            },
          },
        },
      },
    }),
    getSchoolSettings(),
  ]);

  if (!reportCard) {
    notFound();
  }

  // Group tests by subject
  const subjectGroups = new Map<
    string,
    {
      subjectName: string;
      tests: {
        id: string;
        title: string;
        date: Date;
        maxMarks: number;
        marksObtained: number | null;
      }[];
    }
  >();

  // Fetch marks for all tests in this report card
  const testIds = reportCard.reportCardTests.map((rct) => rct.testId);
  const allMarks = await prisma.mark.findMany({
    where: {
      testId: { in: testIds },
      studentId: reportCard.studentId,
    },
    select: {
      testId: true,
      marksObtained: true,
    },
  });

  const marksMap = new Map(allMarks.map((m) => [m.testId, m.marksObtained]));

  // Build subject groups with marks
  for (const rct of reportCard.reportCardTests) {
    const subjectName = rct.test.subject.name;
    if (!subjectGroups.has(subjectName)) {
      subjectGroups.set(subjectName, { subjectName, tests: [] });
    }
    subjectGroups.get(subjectName)!.tests.push({
      id: rct.test.id,
      title: rct.test.title,
      date: rct.test.date,
      maxMarks: rct.test.maxMarks,
      marksObtained: marksMap.get(rct.test.id) ?? null,
    });
  }

  // Compute aggregates
  const totalMaxMarks = reportCard.reportCardTests.reduce(
    (sum, rct) => sum + rct.test.maxMarks,
    0,
  );
  const totalMarksObtained = reportCard.reportCardTests.reduce((sum, rct) => {
    const marks = marksMap.get(rct.test.id);
    return sum + (marks ?? 0);
  }, 0);
  const percentage = totalMaxMarks > 0
    ? ((totalMarksObtained / totalMaxMarks) * 100).toFixed(1)
    : "0.0";

  const dateStr = reportCard.createdAt.toLocaleDateString("en-PK", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const classSection = `${reportCard.classSection.className} - ${reportCard.classSection.sectionName}`;

  // Determine grade/remark based on percentage
  const pct = parseFloat(percentage);
  let grade: string;
  let remark: string;
  if (pct >= 80) {
    grade = "A";
    remark = "Excellent";
  } else if (pct >= 70) {
    grade = "B";
    remark = "Very Good";
  } else if (pct >= 60) {
    grade = "C";
    remark = "Good";
  } else if (pct >= 50) {
    grade = "D";
    remark = "Satisfactory";
  } else if (pct >= 40) {
    grade = "E";
    remark = "Needs Improvement";
  } else {
    grade = "F";
    remark = "Below Requirements";
  }

  return (
    <div className="report-card-document mx-auto max-w-[700px]">
      {/* Document header */}
      <div className="mb-6 border-b-2 border-text pb-4 text-center">
        {school.logoPath && (
          <img
            src={school.logoPath}
            alt="School logo"
            className="mx-auto mb-2 h-16 object-contain"
          />
        )}
        <h1 className="text-lg font-bold uppercase tracking-wide">
          {school.schoolName}
        </h1>
        <h2 className="mt-1 text-xl font-bold uppercase tracking-wider">
          Report Card
        </h2>
      </div>

      {/* Student info header */}
      <div className="mb-6 grid grid-cols-2 gap-4 border border-border p-4 text-sm">
        <div className="space-y-1">
          <p>
            <span className="text-text/50">Student: </span>
            <strong>{reportCard.student.name}</strong>
          </p>
          <p>
            <span className="text-text/50">Guardian: </span>
            <strong>{reportCard.student.guardianName}</strong>
          </p>
        </div>
        <div className="space-y-1 text-right">
          <p>
            <span className="text-text/50">Class: </span>
            <strong>{classSection}</strong>
          </p>
          <p>
            <span className="text-text/50">Term: </span>
            <strong>{reportCard.term.name}</strong>
          </p>
        </div>
      </div>

      {/* Subject-wise results */}
      <div className="space-y-6">
        {Array.from(subjectGroups.values()).map((group) => (
          <div key={group.subjectName} className="print-break-inside-avoid">
            <h3 className="mb-2 border-b border-border pb-1 text-sm font-semibold uppercase tracking-wide text-text/70">
              {group.subjectName}
            </h3>
            <table className="report-table w-full border-collapse text-xs">
              <thead>
                <tr className="border-y border-border bg-surface">
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-text/60">
                    Test
                  </th>
                  <th className="w-20 px-3 py-2 text-center font-semibold uppercase tracking-wide text-text/60">
                    Date
                  </th>
                  <th className="w-20 px-3 py-2 text-right font-semibold uppercase tracking-wide text-text/60">
                    Max
                  </th>
                  <th className="w-20 px-3 py-2 text-right font-semibold uppercase tracking-wide text-text/60">
                    Obtained
                  </th>
                </tr>
              </thead>
              <tbody>
                {group.tests.map((test) => (
                  <tr key={test.id} className="border-b border-border">
                    <td className="px-3 py-2">{test.title}</td>
                    <td className="px-3 py-2 text-center tabular-nums">
                      {test.date.toLocaleDateString("en-PK", {
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {test.maxMarks}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {test.marksObtained ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {/* Summary / Totals */}
      <div className="mt-6 border-t-2 border-text pt-4">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-text/50">Total Marks</p>
            <p className="text-lg font-bold tabular-nums">
              {totalMarksObtained} <span className="text-xs font-normal text-text/50">/ {totalMaxMarks}</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-text/50">Percentage</p>
            <p className="text-lg font-bold tabular-nums">{percentage}%</p>
          </div>
          <div>
            <p className="text-xs text-text/50">Grade</p>
            <p className="text-lg font-bold">{grade}</p>
            <p className="text-xs text-text/50">{remark}</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-10 flex items-end justify-between text-xs text-text/50">
        <div>
          <div className="mb-1 border-t border-text/40 pt-1">
            Class Teacher&apos;s Signature
          </div>
        </div>
        <div className="text-center">
          <p>Report generated by: {reportCard.generatedByTeacher.name}</p>
          <p className="mt-1">{dateStr}</p>
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
