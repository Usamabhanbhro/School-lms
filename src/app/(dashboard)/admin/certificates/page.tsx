import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { CertificateGeneration } from "@/components/certificates/certificate-generation";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "Certificates — Admin",
};

export default async function AdminCertificatesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN" && session.user.role !== "ACADEMICS")
    redirect("/login");

  return (
    <>
      <PageHeader
        title="Certificates"
        description="Generate Leaving and Character certificates for students."
      />
      <CertificateGeneration />
    </>
  );
}
