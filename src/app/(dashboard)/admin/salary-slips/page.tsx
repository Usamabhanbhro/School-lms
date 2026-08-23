import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { roleHome } from "@/lib/rbac";
import { SalarySlipGeneration } from "@/components/salary/salary-slip-generation";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "Salary Slips",
};

export default async function SalarySlipsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  // Generation is Admin + Academics; rate configuration stays Admin-only
  // (enforced server-side by PATCH /api/teachers, which is Admin-only).
  if (session.user.role !== "ADMIN" && session.user.role !== "ACADEMICS")
    redirect(roleHome(session.user.role));

  return (
    <>
      <PageHeader
        title="Salary Slips"
        description="Compute a teacher's pay for a period from attendance, waive specific deductions, and generate an immutable slip."
      />
      <SalarySlipGeneration />
    </>
  );
}