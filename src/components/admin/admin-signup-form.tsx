"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Admin Signup Form — client component.
 * Creates the first administrator account for the school.
 * Only rendered when no Admin exists (checked by the parent server component).
 *
 * On success, displays the one-time recovery code with a copy button
 * and a strong warning to save it securely.
 */
export function AdminSignupForm() {
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
  const [copied, setCopied] = useState(false);

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

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the text so the user can Ctrl+C
    }
  }

  // Show recovery code after successful signup
  if (success && recoveryCode) {
    return (
      <div className="border border-border bg-bg p-8">
        <h1 className="text-xl font-bold">Admin Account Created</h1>

        <div className="mt-4 border border-border bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-text/50">
            About this recovery system
          </p>
          <p className="mt-1 text-sm text-text/70">
            This system does not send recovery codes by email. Your recovery code is
            your offline recovery credential — keep it somewhere secure.
          </p>
        </div>

        <div className="mt-4 border border-success/30 bg-success/5 p-4">
          <p className="text-sm font-semibold text-success">
            Save your recovery code — you will not see it again.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <p className="flex-1 font-mono text-lg font-bold break-all select-all">
              {recoveryCode}
            </p>
            <button
              type="button"
              onClick={() => copyToClipboard(recoveryCode)}
              className="shrink-0 border border-border bg-surface p-2 text-text/60 transition-colors hover:bg-border hover:text-text"
              title="Copy recovery code"
            >
              <Copy className="size-4" aria-hidden="true" />
            </button>
          </div>
          {copied && (
            <p className="mt-1 text-xs text-success">Copied to clipboard.</p>
          )}
          <p className="mt-2 text-xs text-text/60">
            This code can be used to recover your account if you forget your
            password. It remains valid until you use it or regenerate a new one.
            Write it down or save it in a password manager — you will only see
            it once.
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

      <div className="mt-4 border border-border bg-surface p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-text/50">
          About recovery
        </p>
        <p className="mt-1 text-sm text-text/70">
          After creating your account, you will receive a one-time recovery code.
          This system does not send recovery codes by email — save your code
          somewhere secure.
        </p>
      </div>

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
          <p
            className="border border-danger/30 bg-danger/5 px-4 py-2 text-sm text-danger"
            role="alert"
          >
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Creating account…" : "Create Admin Account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-text/50">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-primary underline underline-offset-2"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
