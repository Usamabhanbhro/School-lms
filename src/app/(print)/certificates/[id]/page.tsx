import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { schoolConfig } from "@/lib/school-config";

/**
 * /print/certificates/:id
 *
 * Printable certificate page. Renders either a Leaving Certificate
 * or a Character Certificate based on the `type` field from the
 * database. Both share the same layout structure per DESIGN.md.
 *
 * Server component — fetches data directly from Prisma.
 */
export default async function PrintCertificatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const certificate = await prisma.certificate.findUnique({
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
  });

  if (!certificate) {
    notFound();
  }

  const isLeaving = certificate.type === "LEAVING";
  const title = isLeaving
    ? schoolConfig.documents.leavingCertificate.heading
    : schoolConfig.documents.characterCertificate.heading;
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

  return (
    <div className="certificate-document mx-auto max-w-[700px]">
      {/* Document header */}
      <div className="mb-8 border-b-2 border-text pb-4 text-center">
        <h1 className="text-lg font-bold uppercase tracking-wide">
          {schoolConfig.name}
        </h1>
        <p className="mt-1 text-xs text-text/60">
          {schoolConfig.address}
        </p>
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
            {schoolConfig.signatures.principal}&apos;s Signature
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
            {schoolConfig.signatures.schoolStamp}
          </div>
        </div>
      </div>
    </div>
  );
}
