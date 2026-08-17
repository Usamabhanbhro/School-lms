import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { RolePlaceholder } from "@/components/dashboard/role-placeholder";
import { authOptions } from "@/lib/auth";
import { roleHome } from "@/lib/rbac";

export const metadata: Metadata = {
  title: "Student",
};

export default async function StudentPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "STUDENT") redirect(roleHome(session.user.role));

  return (
    <RolePlaceholder
      icon={GraduationCap}
      title="Student"
      blurb="Courses, submissions, grades, and your timetable."
      planned={["Courses", "Assignment submissions", "Grades", "Timetable"]}
    />
  );
}
