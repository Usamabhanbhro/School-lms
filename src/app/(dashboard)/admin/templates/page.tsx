import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { TemplateManagement } from "@/components/templates/template-management";

export const metadata = {
  title: "Document Templates",
};

export default async function AdminTemplatesPage() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  return <TemplateManagement />;
}
