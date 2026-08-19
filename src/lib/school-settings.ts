import { prisma } from "@/lib/prisma";

/**
 * Server-side school settings accessor.
 *
 * Fetches school identity from the database (SchoolSettings singleton).
 * Falls back to placeholder values if no settings exist yet.
 *
 * Used by print layouts and any server component that needs school identity.
 */
export async function getSchoolSettings() {
  const settings = await prisma.schoolSettings.findFirst();

  if (!settings) {
    return {
      schoolName: "[SCHOOL NAME]",
      address: "",
      phone: "",
      email: "",
      principalName: "",
      logoPath: null,
    };
  }

  return {
    schoolName: settings.schoolName,
    address: settings.address,
    phone: settings.phone,
    email: settings.email,
    principalName: settings.principalName,
    logoPath: settings.logoPath,
  };
}

export type SchoolSettingsData = Awaited<ReturnType<typeof getSchoolSettings>>;
