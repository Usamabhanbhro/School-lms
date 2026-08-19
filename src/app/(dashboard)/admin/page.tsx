import { redirect } from "next/navigation";

/**
 * /admin redirects to the admin dashboard.
 * User management is at /admin/teachers and /admin/academics.
 */
export default function AdminPage() {
  redirect("/admin/dashboard");
}
