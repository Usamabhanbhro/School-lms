import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { roleHome } from "@/lib/rbac";
import { AdminStudentAttendance } from "@/components/attendance/admin-student-attendance";

export const metadata: Metadata = {
  title: "Student Attendance — Admin",
};

export default async function AdminStudentAttendancePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect(roleHome(session.user.role));

  return <AdminStudentAttendance />;
}
