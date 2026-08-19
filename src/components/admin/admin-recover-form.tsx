"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, KeyRound, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Admin Recovery Form — client component.
 *
 * Supports two modes:
 *   1. Recovery: enter username/email + recovery code + new password
 *   2. Code generation: when code is expired/consumed/replaced, generate a new one
 */
export function AdminRecoverForm() {
  // ─── Form state ──────────────────────────────────────────────
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // ─── UI state ────────────────────────────────────────────────
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showCodeGenerator, setShowCodeGenerator] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);

  // ─── Recovery handler ───────────────────────────────────────
  async function handleRecover(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    // Client-side validation
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setPending(true);

    try {
      const res = await fetch("/api/admin/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernameOrEmail, recoveryCode, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error?.message ?? "Recovery failed.");
        return;
      }

      setSuccess(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPending(false);
    }
  }

  // ─── Code generation handler ─────────────────────────────────
  async function handleGenerateCode() {
    setGeneratingCode(true);
    setError(null);
    setGeneratedCode(null);

    try {
      const res = await fetch("/api/admin/recover/code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernameOrEmail }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error?.message ?? "Failed to generate recovery code.");
        return;
      }

      setGeneratedCode(data.data.recoveryCode);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setGeneratingCode(false);
    }
  }

  // ─── Success state ───────────────────────────────────────────
  if (success) {
    return (
      <div className="border border-border bg-bg p-8">
        <h1 className="text-xl font-bold">Password Reset Successful</h1>
        <div className="mt-4 flex items-start gap-3 border border-success/30 bg-success/5 p-4">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-success">
              Your password has been reset.
            </p>
            <p className="mt-1 text-sm text-text/60">
              You can now sign in with your new password.
            </p>
          </div>
        </div>
        <div className="mt-6 space-y-3">
          <Link href="/login" className="inline-flex h-10 w-full items-center justify-center gap-2 border border-primary bg-primary px-4 text-sm font-medium text-white transition-colors duration-150 ease-out hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            Sign in
          </Link>
          <Link
            href="/"
            className="inline-flex h-10 w-full items-center justify-center gap-2 border border-border bg-bg px-4 text-sm font-medium text-text transition-colors duration-150 ease-out hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  // ─── Generated code display ──────────────────────────────────
  if (generatedCode) {
    return (
      <div className="border border-border bg-bg p-8">
        <h1 className="text-xl font-bold">New Recovery Code</h1>
        <div className="mt-4 border border-success/30 bg-success/5 p-4">
          <p className="text-sm font-semibold text-success">
            Save your recovery code — you will not see it again.
          </p>
          <p className="mt-2 font-mono text-lg font-bold break-all">
            {generatedCode}
          </p>
          <p className="mt-2 text-xs text-text/60">
            This code can be used to recover your account if you forget your password.
            It expires in 24 hours.
          </p>
        </div>
        <div className="mt-6 space-y-3">
          <Button
            onClick={() => {
              setGeneratedCode(null);
              setShowCodeGenerator(false);
              setRecoveryCode("");
            }}
            className="w-full"
          >
            Use this code to recover
          </Button>
          <Link
            href="/login"
            className="inline-flex h-10 w-full items-center justify-center gap-2 border border-border bg-bg px-4 text-sm font-medium text-text transition-colors duration-150 ease-out hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Sign in instead
          </Link>
        </div>
      </div>
    );
  }

  // ─── Main form ───────────────────────────────────────────────
  return (
    <div className="border border-border bg-bg p-8">
      <h1 className="text-xl font-bold">Admin Account Recovery</h1>
      <p className="mt-1 text-sm text-text/60">
        Use your one-time recovery code to reset your password.
      </p>

      <form onSubmit={handleRecover} className="mt-6 space-y-4">
        <div className="space-y-2">
          <label htmlFor="usernameOrEmail" className="text-sm font-medium">
            Username or email
          </label>
          <Input
            id="usernameOrEmail"
            value={usernameOrEmail}
            onChange={(e) => setUsernameOrEmail(e.target.value)}
            placeholder="Enter your username or email"
            required
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="recoveryCode" className="text-sm font-medium">
            Recovery code
          </label>
          <Input
            id="recoveryCode"
            value={recoveryCode}
            onChange={(e) => setRecoveryCode(e.target.value)}
            placeholder="Enter your recovery code"
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="newPassword" className="text-sm font-medium">
            New password
          </label>
          <Input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Minimum 8 characters"
            required
            minLength={8}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="confirmPassword" className="text-sm font-medium">
            Confirm new password
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
          <div className="flex items-start gap-2 border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger" role="alert">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {error}
          </div>
        )}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Recovering…" : "Recover account"}
        </Button>
      </form>

      {/* Code generation section */}
      <div className="mt-6 border-t border-border pt-6">
        {!showCodeGenerator ? (
          <Button
            variant="ghost"
            onClick={() => setShowCodeGenerator(true)}
            className="w-full text-text/60"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Need a new recovery code?
          </Button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-text/60">
              Generate a new recovery code if your current code has expired, been used, or you need a fresh one.
            </p>
            <Button
              variant="secondary"
              onClick={handleGenerateCode}
              disabled={generatingCode || !usernameOrEmail}
              className="w-full"
            >
              {generatingCode ? (
                "Generating…"
              ) : (
                <>
                  <KeyRound className="size-4" aria-hidden="true" />
                  Generate new recovery code
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-text/50">
        <Link href="/login" className="font-medium text-primary underline underline-offset-2">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
