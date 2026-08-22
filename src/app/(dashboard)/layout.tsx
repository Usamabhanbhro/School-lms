import type { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { MountAnimation } from "@/components/ui/mount-animation";
import { authOptions } from "@/lib/auth";
import { getSchoolSettings } from "@/lib/school-settings";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }

  const school = await getSchoolSettings();

  return (
    <div className="min-h-screen bg-bg">
      <Sidebar role={session.user.role} name={session.user.name ?? ""} schoolName={school.schoolName} logoPath={school.logoPath} />
      <main className="md:pl-64">
        <MountAnimation>
          <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">{children}</div>
        </MountAnimation>
      </main>
    </div>
  );
}
