import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "Certificates — Admin",
};

export default async function AdminCertificatesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/login");

  return (
    <>
      <PageHeader
        title="Certificates"
        description="Generate and manage student certificates."
      />
      <EmptyState
        icon={FileText}
        title="Certificate generation"
        description="Certificates (Leaving, Character) can be generated via the API. A dedicated generation UI is planned."
      />
    </>
  );
}
