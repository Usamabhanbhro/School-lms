import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { UserManagement } from "@/components/admin/user-management";

export const metadata: Metadata = {
  title: "Teachers — Admin",
};

export default async function AdminTeachersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/login");

  return <UserManagement />;
}
