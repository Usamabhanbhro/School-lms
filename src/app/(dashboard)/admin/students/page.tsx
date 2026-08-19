import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "Students — Admin",
};

export default async function AdminStudentsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/login");

  return (
    <>
      <PageHeader
        title="Students"
        description="Manage student records and class allotments."
      />
      <EmptyState
        icon={Users}
        title="Student management"
        description="Student CRUD is available via the API. A dedicated management UI for enrolling, editing, and allotting students to classes is planned."
      />
    </>
  );
}
