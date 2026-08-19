import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Banknote } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "Fees — Admin",
};

export default async function AdminFeesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/login");

  return (
    <>
      <PageHeader
        title="Fees & Challans"
        description="Manage bank settings and generate fee challans."
      />
      <EmptyState
        icon={Banknote}
        title="Fee management"
        description="Fee challans and bank settings are available via the API. A dedicated fee management UI is planned."
      />
    </>
  );
}
