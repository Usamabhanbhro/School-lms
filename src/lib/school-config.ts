/**
 * School Identity Configuration
 *
 * Centralized configuration for school identity used across all
 * printable documents (certificates, fee challans, report cards).
 *
 * To update the school name or details, change the values below
 * and they will propagate to all documents automatically.
 */

export const schoolConfig = {
  /** School name — replace placeholder with actual school name */
  name: "[SCHOOL NAME]",

  /** School subtitle / tagline */
  subtitle: "School Management System",

  /** Full address */
  address: "[School Address]",

  /** Phone number */
  phone: "[Phone Number]",

  /** Email address */
  email: "[email@school.edu]",

  /** Principal / Head of Institution */
  principalName: "[Principal Name]",

  /** Document-specific labels */
  documents: {
    leavingCertificate: {
      title: "Leaving Certificate",
      heading: "Certificate of School Leaving",
    },
    characterCertificate: {
      title: "Character Certificate",
      heading: "Certificate of Character",
    },
    feeChallan: {
      title: "Fee Challan",
      heading: "Fee Challan",
    },
    reportCard: {
      title: "Report Card",
      heading: "Report Card",
    },
  },

  /** Signature area labels */
  signatures: {
    principal: "Principal",
    schoolStamp: "School Stamp",
    classTeacher: "Class Teacher",
    date: "Date",
  },
} as const;

export type SchoolConfig = typeof schoolConfig;
