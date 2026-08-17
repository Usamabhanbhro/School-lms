import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Register",
};

export default function RegisterPage() {
  return (
    <div className="border border-border bg-bg p-8">
      <h1 className="text-xl font-bold">Accounts are created by your school</h1>
      <p className="mt-4 text-sm text-text/60">
        School LMS does not allow self-registration. Your school administrator
        creates accounts for teachers, students, and parents — you&apos;ll
        receive your username and password from them.
      </p>
      <Link href="/login" className={buttonClasses("primary", "mt-6 w-full")}>
        Back to sign in
      </Link>
    </div>
  );
}
