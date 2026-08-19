"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Admin Signup Page — First Admin Provisioning
 *
 * Public route. Only works if no Admin account exists.
 * Collects: name, email, password, password confirmation.
 * Creates the admin account and establishes a session.
 */
export default function AdminSignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    // Client-side validation
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setPending(true);

    try {
      const res = await fetch("/api/admin/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, confirmPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error?.message ?? "Failed to create admin account.");
        return;
      }

      // Store recovery code for display
      setRecoveryCode(data.data.recoveryCode);
      setSuccess(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function handleSignIn() {
    setSigningIn(true);
    try {
      await signIn("credentials", {
        username: email,
        password,
        redirect: false,
      });
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Failed to sign in. Please go to the login page.");
      setSigningIn(false);
    }
  }

  // Show recovery code after successful signup
  if (success && recoveryCode) {
    return (
      <div className="border border-border bg-bg p-8">
        <h1 className="text-xl font-bold">Admin Account Created</h1>
        <div className="mt-4 border border-success/30 bg-success/5 p-4">
          <p className="text-sm font-semibold text-success">
            Save your recovery code — you will not see it again.
          </p>
          <p className="mt-2 font-mono text-lg font-bold break-all">
            {recoveryCode}
          </p>
          <p className="mt-2 text-xs text-text/60">
            This code can be used to recover your account if you forget your password.
          </p>
        </div>
        <div className="mt-4 flex gap-2">
          <Button onClick={handleSignIn} disabled={signingIn} className="flex-1">
            {signingIn ? "Signing in…" : "Go to Dashboard"}
          </Button>
          <Link
            href="/login"
            className="flex items-center justify-center border border-border bg-bg px-4 py-2 text-sm font-medium text-text hover:bg-surface"
          >
            Sign in later
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-border bg-bg p-8">
      <h1 className="text-xl font-bold">School Admin Setup</h1>
      <p className="mt-1 text-sm text-text/60">
        Create the first administrator account for your school.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium">
            Full Name
          </label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Muhammad Khan"
            required
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">
            Email Address
          </label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@school.edu"
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 8 characters"
            required
            minLength={8}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="confirmPassword" className="text-sm font-medium">
            Confirm Password
          </label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter password"
            required
          />
        </div>

        {error && (
          <p className="border border-danger/30 bg-danger/5 px-4 py-2 text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Creating account…" : "Create Admin Account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-text/50">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </div>
  );
}
