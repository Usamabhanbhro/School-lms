import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { RolePlaceholder } from "@/components/dashboard/role-placeholder";
import { authOptions } from "@/lib/auth";
import { roleHome } from "@/lib/rbac";

export const metadata: Metadata = {
  title: "Admin",
};

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect(roleHome(session.user.role));

  return (
    <RolePlaceholder
      icon={ShieldCheck}
      title="Admin"
      blurb="School setup, user management, and reporting."
      planned={["User management", "Classes & subjects", "Attendance reports", "Report cards"]}
    />
  );
}
