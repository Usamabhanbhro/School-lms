import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { getSchoolSettings } from "@/lib/school-settings";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const school = await getSchoolSettings();
  const schoolName =
    school.schoolName && school.schoolName !== "[SCHOOL NAME]"
      ? school.schoolName
      : "School LMS";

  return {
    title: {
      default: schoolName,
      template: `%s · ${schoolName}`,
    },
    description:
      "Attendance, gradebooks, assignments, timetables, and communication for schools — built for admin, teacher, student, and parent roles.",
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Merriweather:wght@300;400;700&family=Playfair+Display:wght@400;700&family=Crimson+Pro:wght@400;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-bg text-text antialiased">{children}</body>
    </html>
  );
}
