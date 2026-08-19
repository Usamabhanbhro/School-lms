import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { StudentManagement } from "@/components/students/student-management";

export const metadata: Metadata = {
  title: "Students — Admin",
};

export default async function AdminStudentsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/login");

  return <StudentManagement />;
}
