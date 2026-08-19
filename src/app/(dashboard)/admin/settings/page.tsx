import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { roleHome } from "@/lib/rbac";
import { SchoolSettings } from "@/components/admin/school-settings";

export const metadata: Metadata = {
  title: "School Settings — Admin",
};

export default async function AdminSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect(roleHome(session.user.role));

  return <SchoolSettings />;
}
