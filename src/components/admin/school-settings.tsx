"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  Save,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ToastContainer, useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────

interface SchoolSettingsData {
  id: string;
  schoolName: string;
  address: string;
  phone: string;
  email: string;
  principalName: string;
  logoPath: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Component ──────────────────────────────────────────────────────

export function SchoolSettings() {
  const [settings, setSettings] = useState<SchoolSettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toasts, addToast, dismissToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Recovery code state
  const [regeneratingCode, setRegeneratingCode] = useState(false);
  const [newRecoveryCode, setNewRecoveryCode] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);

  // Form state
  const [schoolName, setSchoolName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [principalName, setPrincipalName] = useState("");

  // ─── Load settings ──────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/settings/school");
        if (!res.ok) throw new Error("Failed to load settings");
        const json = await res.json();
        const data = json.data;
        setSettings(data);
        setSchoolName(data.schoolName ?? "");
        setAddress(data.address ?? "");
        setPhone(data.phone ?? "");
        setEmail(data.email ?? "");
        setPrincipalName(data.principalName ?? "");
      } catch {
        setError("Failed to load school settings.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ─── Save settings ─────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/settings/school", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolName,
          address,
          phone,
          email,
          principalName,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        addToast("error", json.error?.message ?? "Failed to save settings.");
        return;
      }

      const json = await res.json();
      setSettings(json.data);
      addToast("success", "School settings saved.");
    } catch {
      addToast("error", "Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [schoolName, address, phone, email, principalName, addToast]);

  // ─── Logo upload ───────────────────────────────────────────────

  const handleLogoUpload = useCallback(async (file: File) => {
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("logo", file);

      const res = await fetch("/api/settings/school/logo", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const json = await res.json();
        addToast("error", json.error?.message ?? "Failed to upload logo.");
        return;
      }

      const json = await res.json();
      setSettings((prev) => prev ? { ...prev, logoPath: json.data.logoPath } : prev);
      addToast("success", "Logo uploaded successfully.");
    } catch {
      addToast("error", "Network error. Please try again.");
    } finally {
      setUploading(false);
    }
  }, [addToast]);

  const handleLogoRemove = useCallback(async () => {
    setUploading(true);

    try {
      const res = await fetch("/api/settings/school/logo", {
        method: "DELETE",
      });

      if (!res.ok) {
        const json = await res.json();
        addToast("error", json.error?.message ?? "Failed to remove logo.");
        return;
      }

      setSettings((prev) => prev ? { ...prev, logoPath: null } : prev);
      addToast("success", "Logo removed.");
    } catch {
      addToast("error", "Network error. Please try again.");
    } finally {
      setUploading(false);
    }
  }, [addToast]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleLogoUpload(file);
    }
    // Reset input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [handleLogoUpload]);

  // ─── Render ────────────────────────────────────────────────────

  // ─── Recovery code regeneration ─────────────────────────

  const handleRegenerateCode = useCallback(async () => {
    setRegeneratingCode(true);
    setNewRecoveryCode(null);

    try {
      const res = await fetch("/api/admin/recovery-code/regenerate", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        addToast("error", data.error?.message ?? "Failed to generate recovery code.");
        return;
      }

      setNewRecoveryCode(data.data.recoveryCode);
      addToast("success", "New recovery code generated. Save it now — you will not see it again.");
    } catch {
      addToast("error", "Network error. Please try again.");
    } finally {
      setRegeneratingCode(false);
    }
  }, [addToast]);

  const handleCopyCode = useCallback(async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      // Fallback: select text
    }
  }, []);

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <PageHeader
        title="School Settings"
        description="Configure your school identity and contact information."
      />

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          {error}
          <Button variant="ghost" onClick={() => window.location.reload()} className="ml-auto h-8 px-2 text-xs">
            Retry
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* General Section */}
          <Card className="p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-text/70">
              General
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="schoolName" className="text-sm font-medium">
                  School Name
                </label>
                <Input
                  id="schoolName"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder="e.g. ABC Public School"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="principalName" className="text-sm font-medium">
                  Principal Name
                </label>
                <Input
                  id="principalName"
                  value={principalName}
                  onChange={(e) => setPrincipalName(e.target.value)}
                  placeholder="e.g. Mr. Muhammad Khan"
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <label htmlFor="address" className="text-sm font-medium">
                  Address
                </label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. 123 Education Street, Karachi"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="phone" className="text-sm font-medium">
                  Phone
                </label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 021-1234567"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. info@school.edu"
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                <Save className="size-4" aria-hidden="true" />
                Save Settings
              </Button>
            </div>
          </Card>

          {/* Recovery Code Section */}
          <Card className="p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-text/70">
              Admin Recovery Code
            </h2>

            <p className="mb-4 text-sm text-text/60">
              Your one-time recovery code is used to reset your password if you forget it.
              Regenerating invalidates the previous code.
            </p>

            {newRecoveryCode ? (
              <div className="border border-success/30 bg-success/5 p-4">
                <p className="text-sm font-semibold text-success">
                  Save this code — you will not see it again.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <p className="flex-1 font-mono text-lg font-bold break-all select-all">
                    {newRecoveryCode}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleCopyCode(newRecoveryCode)}
                    className="shrink-0 border border-border bg-surface p-2 text-text/60 transition-colors hover:bg-border hover:text-text"
                    title="Copy recovery code"
                  >
                    <Copy className="size-4" aria-hidden="true" />
                  </button>
                </div>
                {codeCopied && (
                  <p className="mt-1 text-xs text-success">Copied to clipboard.</p>
                )}
                <p className="mt-2 text-xs text-text/60">
                  Your previous recovery code is no longer valid. This code remains valid until used or regenerated.
                </p>
              </div>
            ) : (
              <Button
                variant="secondary"
                onClick={handleRegenerateCode}
                disabled={regeneratingCode}
              >
                {regeneratingCode ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <KeyRound className="size-4" aria-hidden="true" />
                )}
                Regenerate Recovery Code
              </Button>
            )}
          </Card>

          {/* Logo Section */}
          <Card className="p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-text/70">
              School Logo
            </h2>

            <div className="flex items-start gap-6">
              {/* Logo preview */}
              <div className="flex h-32 w-32 shrink-0 items-center justify-center border border-border bg-surface">
                {settings?.logoPath ? (
                  <img
                    src={settings.logoPath}
                    alt="School logo"
                    className="h-full w-full object-contain p-2"
                  />
                ) : (
                  <span className="text-xs text-text/40">No logo</span>
                )}
              </div>

              {/* Upload controls */}
              <div className="flex-1 space-y-3">
                <p className="text-sm text-text/60">
                  Upload a PNG, JPEG, SVG, or WebP image. Maximum size: 2MB.
                </p>

                <div className="flex gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    onChange={handleFileChange}
                    className="hidden"
                    aria-label="Upload school logo"
                  />
                  <Button
                    variant="secondary"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Upload className="size-4" aria-hidden="true" />
                    )}
                    Upload Logo
                  </Button>

                  {settings?.logoPath && (
                    <Button
                      variant="ghost"
                      onClick={handleLogoRemove}
                      disabled={uploading}
                    >
                      <X className="size-4" aria-hidden="true" />
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
