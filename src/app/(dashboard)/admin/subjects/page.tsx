import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { BookMarked } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "Subjects — Admin",
};

export default async function AdminSubjectsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/login");

  return (
    <>
      <PageHeader
        title="Subjects"
        description="Manage the school's subject catalog."
      />
      <EmptyState
        icon={BookMarked}
        title="Subject management"
        description="Subject CRUD is available via the API. A dedicated management UI is planned."
      />
    </>
  );
}
