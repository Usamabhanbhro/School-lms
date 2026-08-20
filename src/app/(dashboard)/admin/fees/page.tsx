import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { FeeChallanGeneration } from "@/components/fees/fee-challan-generation";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "Fees — Admin",
};

export default async function AdminFeesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN" && session.user.role !== "ACADEMICS")
    redirect("/login");

  return (
    <>
      <PageHeader
        title="Fees & Challans"
        description="Generate fee challans with editable line items and print three-copy layouts."
      />
      <FeeChallanGeneration />
    </>
  );
}
