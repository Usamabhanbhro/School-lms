import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { roleHome } from "@/lib/rbac";
import { TestManagement } from "@/components/tests/test-management";

export const metadata: Metadata = {
  title: "Tests & Marks — Teacher",
};

export default async function TeacherTestsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "TEACHER") redirect(roleHome(session.user.role));

  return <TestManagement />;
}
