import type { Metadata } from "next";
import { Suspense } from "react";
import { MountAnimation } from "@/components/ui/mount-animation";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <MountAnimation>
      <Suspense>
        <LoginForm />
      </Suspense>
    </MountAnimation>
  );
}
