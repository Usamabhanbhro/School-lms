import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { roleHome } from "@/lib/rbac";
import { UserManagement } from "@/components/admin/user-management";

export const metadata: Metadata = {
  title: "Admin — User Management",
};

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect(roleHome(session.user.role));

  return <UserManagement />;
}
