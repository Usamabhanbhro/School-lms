import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Register",
};

export default function RegisterPage() {
  return (
    <div className="border border-border bg-bg p-8">
      <h1 className="text-xl font-bold">School LMS</h1>
      <p className="mt-4 text-sm text-text/60">
        School LMS does not allow self-registration. Your school administrator
        creates accounts for teachers and academics staff — you&apos;ll
        receive your username and password from them.
      </p>

      <div className="mt-6 space-y-3">
        <Link href="/login" className={buttonClasses("primary", "w-full")}>
          Sign in
        </Link>
        <Link
          href="/admin/signup"
          className={buttonClasses("secondary", "w-full")}
        >
          First time? Set up admin account
        </Link>
      </div>
    </div>
  );
}
