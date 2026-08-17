import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { UserCheck } from "lucide-react";
import { RolePlaceholder } from "@/components/dashboard/role-placeholder";
import { authOptions } from "@/lib/auth";
import { roleHome } from "@/lib/rbac";

export const metadata: Metadata = {
  title: "Teacher",
};

export default async function TeacherPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "TEACHER") redirect(roleHome(session.user.role));

  return (
    <RolePlaceholder
      icon={UserCheck}
      title="Teacher"
      blurb="Attendance, grades, assignments, and class materials."
      planned={["Attendance marking", "Gradebook", "Assignments", "Timetable"]}
    />
  );
}
