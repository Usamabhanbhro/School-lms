import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { roleHome } from "@/lib/rbac";
import { TeacherAttendance } from "@/components/attendance/teacher-attendance";

export const metadata: Metadata = {
  title: "Attendance — Teacher",
};

export default async function TeacherAttendancePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "TEACHER") redirect(roleHome(session.user.role));

  return <TeacherAttendance />;
}
