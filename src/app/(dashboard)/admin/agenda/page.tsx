import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AdminAgenda } from "@/components/agenda/admin-agenda";

export const metadata: Metadata = {
  title: "Daily Agenda — Admin",
};

export default async function AdminAgendaPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  // Admin only — Academics deliberately excluded from this feature (see SRS §1A.2)
  if (session.user.role !== "ADMIN") redirect("/login");

  return <AdminAgenda />;
}
