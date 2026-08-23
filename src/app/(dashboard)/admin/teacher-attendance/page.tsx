import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { roleHome } from "@/lib/rbac";
import { AdminTeacherAttendance } from "@/components/attendance/admin-teacher-attendance";

export const metadata: Metadata = {
  title: "Teacher Attendance — Admin",
};

export default async function TeacherAttendancePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  // Admin + Academics (full parity per SRS amendment).
  if (session.user.role !== "ADMIN" && session.user.role !== "ACADEMICS")
    redirect(roleHome(session.user.role));

  return <AdminTeacherAttendance />;
}
