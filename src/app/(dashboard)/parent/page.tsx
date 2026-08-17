import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { RolePlaceholder } from "@/components/dashboard/role-placeholder";
import { authOptions } from "@/lib/auth";
import { roleHome } from "@/lib/rbac";

export const metadata: Metadata = {
  title: "Parent",
};

export default async function ParentPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "PARENT") redirect(roleHome(session.user.role));

  return (
    <RolePlaceholder
      icon={Users}
      title="Parent"
      blurb="Follow your child's progress, attendance, and notices."
      planned={["Child progress", "Attendance view", "Notices"]}
    />
  );
}
