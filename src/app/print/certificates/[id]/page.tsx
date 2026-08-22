import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSchoolSettings } from "@/lib/school-settings";
import { TemplateRenderer } from "@/components/templates/template-renderer";

/**
 * /print/certificates/:id
 *
 * Printable certificate page. Uses template-based rendering if a template
 * is available (either snapshot on the certificate or active for the type).
 * Falls back to coded layout if no template exists.
 *
 * Server component — fetches data directly from Prisma.
 */
export default async function PrintCertificatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let certificate;
  let school;
  try {
    [certificate, school] = await Promise.all([
      prisma.certificate.findUnique({
        where: { id },
        include: {
          student: {
            select: {
              id: true,
              name: true,
              guardianName: true,
              dateOfBirth: true,
              admissionDate: true,
              classSection: {
                select: { className: true, sectionName: true },
              },
            },
          },
          generatedByUser: {
            select: { id: true, name: true },
          },
        },
      }),
      getSchoolSettings(),
    ]);
  } catch {
    // Database connection issue — render a clean error page instead of crashing
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-text/60">
            Unable to load certificate. Please try again.
          </p>
        </div>
      </div>
    );
  }

  if (!certificate) {
    notFound();
  }

  // Try to load template: first from snapshot, then active for this type.
  // Wrapped in try/catch because these are separate DB calls that can fail
  // independently (e.g. Neon cold start on the second connection).
  let template = null;
  try {
    if (certificate.templateId) {
      template = await prisma.documentTemplate.findUnique({
        where: { id: certificate.templateId },
        include: { fields: true, tableRegions: true },
      });
    }
    if (!template) {
      const templateType = certificate.type === "LEAVING"
        ? "LEAVING_CERTIFICATE"
        : "CHARACTER_CERTIFICATE";
      template = await prisma.documentTemplate.findFirst({
        where: { type: templateType as any, isActive: true },
        include: { fields: true, tableRegions: true },
      });
    }
  } catch {
    // Template lookup failed — fall back to coded layout
    template = null;
  }

  const isLeaving = certificate.type === "LEAVING";
  const title = isLeaving ? "Certificate of School Leaving" : "Certificate of Character";
  const dateStr = certificate.issuedDate.toLocaleDateString("en-PK", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const dobStr = certificate.student.dateOfBirth.toLocaleDateString("en-PK", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const admissionStr = certificate.student.admissionDate.toLocaleDateString("en-PK", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const classSection = `${certificate.student.classSection.className} - ${certificate.student.classSection.sectionName}`;

  // If template exists, use template-based rendering
  if (template) {
    const fieldValues: Record<string, string> = {
      studentName: certificate.student.name,
      guardianName: certificate.student.guardianName,
      classSection,
      admissionDate: admissionStr,
      dateOfLeaving: dateStr,
      dob: dobStr,
      issueDate: dateStr,
      conductRemark: isLeaving ? "" : "exemplary conduct, good character, and a disciplined attitude",
    };

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
      />
    );
  }

  // Fallback: coded layout (no template configured)
  return (
    <div className="certificate-document mx-auto max-w-[700px]">
      {/* Document header */}
      <div className="mb-8 border-b-2 border-text pb-4 text-center">
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
        {school.address && (
          <p className="mt-1 text-xs text-text/60">
            {school.address}
          </p>
        )}
      </div>

      {/* Certificate title */}
      <h2 className="mb-6 text-center text-xl font-bold uppercase tracking-wider">
        {title}
      </h2>

      {/* Certificate body */}
      <div className="space-y-4 text-sm leading-relaxed">
        {isLeaving ? (
          <>
            <p>
              This is to certify that <strong>{certificate.student.name}</strong>,
              child of <strong>{certificate.student.guardianName}</strong>,
              was a student of this school in class <strong>{classSection}</strong> from{" "}
              <strong>{admissionStr}</strong> to <strong>{dateStr}</strong>.
            </p>
            <p>
              The student has completed the required course of study and has been
              found to have a satisfactory academic record. The school wishes the
              student all the best in future endeavors.
            </p>
            <p>
              Date of Birth: <strong>{dobStr}</strong>
            </p>
          </>
        ) : (
          <>
            <p>
              This is to certify that <strong>{certificate.student.name}</strong>,
              child of <strong>{certificate.student.guardianName}</strong>,
              was a student of this school in class <strong>{classSection}</strong>.
            </p>
            <p>
              During the period of study, the student has displayed exemplary
              conduct, good character, and a disciplined attitude towards studies
              and school activities. The school commends the student for their
              behavior and moral character.
            </p>
            <p>
              Date of Birth: <strong>{dobStr}</strong>
            </p>
          </>
        )}
      </div>

      {/* Footer with signature area */}
      <div className="mt-12 flex items-end justify-between text-sm">
        <div>
          <div className="mb-1 border-t border-text/40 pt-1 text-xs text-text/50">
            {school.principalName ? `${school.principalName}` : "Principal"}&apos;s Signature
          </div>
        </div>
        <div className="text-center">
          <p className="text-xs text-text/50">
            Certificate No. {certificate.id.slice(0, 8).toUpperCase()}
          </p>
          <p className="mt-1 text-xs text-text/50">
            Issued: {dateStr}
          </p>
        </div>
        <div className="text-right">
          <div className="mb-1 border-t border-text/40 pt-1 text-xs text-text/50">
            School Stamp
          </div>
        </div>
      </div>
    </div>
  );
}
