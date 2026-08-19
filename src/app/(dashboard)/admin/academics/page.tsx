import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { UserManagement } from "@/components/admin/user-management";

export const metadata: Metadata = {
  title: "Academics — Admin",
};

export default async function AdminAcademicsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/login");

  // Reuse UserManagement which has tabs for teachers/academics
  return <UserManagement />;
}
