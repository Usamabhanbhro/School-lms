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
      "Attendance, gradebooks, certificates, fee challans, and salary slips — a web-based school management system for Admin, Academics, and Teacher roles.",
    robots: {
      index: false,
      follow: false,
      noarchive: true,
      nosnippet: true,
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#2563EB" />
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
