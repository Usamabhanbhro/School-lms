import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { roleHome } from "@/lib/rbac";
import { TeacherAgenda } from "@/components/agenda/teacher-agenda";

export const metadata: Metadata = {
  title: "Daily Agenda — Teacher",
};

export default async function TeacherAgendaPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "TEACHER") redirect(roleHome(session.user.role));

  return <TeacherAgenda />;
}
