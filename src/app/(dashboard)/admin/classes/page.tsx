import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { School } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "Classes & Sections — Admin",
};

export default async function AdminClassesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/login");

  return (
    <>
      <PageHeader
        title="Classes & Sections"
        description="Manage class sections and assign class teachers."
      />
      <EmptyState
        icon={School}
        title="Class section management"
        description="Class section CRUD, class teacher assignment, and subject teacher assignment are available via the API. A dedicated management UI is planned."
      />
    </>
  );
}
