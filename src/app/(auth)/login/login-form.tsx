"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const rawReturnTo = searchParams.get("returnTo");
  const returnTo =
    rawReturnTo && rawReturnTo.startsWith("/") && !rawReturnTo.startsWith("//")
      ? rawReturnTo
      : "/dashboard";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const result = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });
      if (result?.error) {
        setError("Invalid username or password.");
        return;
      }
      router.push(returnTo);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="border border-border bg-bg p-8">
      <h1 className="text-xl font-bold">Sign in</h1>
      <p className="mt-1 text-sm text-text/60">
        Use the credentials your school administrator gave you.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="space-y-2">
          <label htmlFor="username" className="text-sm font-medium">
            Username or email
          </label>
          <Input
            id="username"
            name="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            required
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <Input
            id="password"
            name="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        {error ? (
          <p className="border border-danger/30 bg-danger/5 px-4 py-2 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-text/50">
        New here? Accounts are created by your school —{" "}
        <Link href="/register" className="font-medium text-primary underline underline-offset-2">
          learn more
        </Link>
      </p>
    </div>
  );
}
