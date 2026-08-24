import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { FeeLedger } from "@/components/fees/fee-ledger";
import { authOptions } from "@/lib/auth";

export const metadata = {
  title: "Fee Ledger · School LMS",
};

export default async function FeeLedgerPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !["ADMIN", "ACADEMICS"].includes(session.user.role)) {
    redirect("/login");
  }

  return (
    <div>
      <PageHeader
        title="Fee Ledger"
        description="Track challan payments, derived balances, and outstanding school fees."
      />
      <FeeLedger />
    </div>
  );
}
