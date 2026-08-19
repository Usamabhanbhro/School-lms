import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { SubjectManagement } from "@/components/subjects/subject-management";

export const metadata: Metadata = {
  title: "Subjects — Admin",
};

export default async function AdminSubjectsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/login");

  return <SubjectManagement />;
}
