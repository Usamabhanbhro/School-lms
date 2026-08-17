import type { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { authOptions } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen">
      <Sidebar role={session.user.role} name={session.user.name ?? ""} />
      <main className="md:pl-64">
        <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">{children}</div>
      </main>
    </div>
  );
}
