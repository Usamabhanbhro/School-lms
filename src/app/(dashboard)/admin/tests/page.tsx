import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { TestOverview } from "@/components/tests/test-overview";

export const metadata: Metadata = {
  title: "Tests & Marks — Admin",
};

export default async function AdminTestsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN" && session.user.role !== "ACADEMICS") redirect("/login");

  return <TestOverview />;
}
