"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Edit3,
  Key,
  Loader2,
  ShieldCheck,
  Trash2,
  UserPlus,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { cnicRegex, phoneRegex } from "@/lib/validations";

// ─── Types ──────────────────────────────────────────────────────────

interface UserProfile {
  id: string;
  name: string;
  cnic: string;
  phone: string;
  email: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    username: string;
    email: string | null;
    isActive: boolean;
    role: string;
  };
}

type Tab = "teachers" | "academics";
type View = "list" | "create" | "edit";

interface Toast {
  id: number;
  type: "success" | "error";
  message: string;
}

// ─── Validation helpers ─────────────────────────────────────────────

function validateCNIC(value: string): string | null {
  if (!value) return "CNIC is required.";
  if (!cnicRegex.test(value)) return "Must be in format xxxxx-xxxxxxx-x (e.g. 35202-1234567-1).";
  return null;
}

function validatePhone(value: string): string | null {
  if (!value) return "Phone is required.";
  if (!phoneRegex.test(value)) return "Must be in format 03xx-xxxxxxx (e.g. 0321-1234567).";
  return null;
}

function validateEmail(value: string): string | null {
  if (!value) return null; // optional
  // Basic email check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Invalid email format.";
  return null;
}

function validateRequired(value: string, label: string): string | null {
  if (!value.trim()) return `${label} is required.`;
  return null;
}

function validatePassword(value: string): string | null {
  if (!value) return "Password is required.";
  if (value.length < 8) return "Password must be at least 8 characters.";
  if (value.length > 100) return "Password must be at most 100 characters.";
  return null;
}

// ─── Create/Edit form shape ─────────────────────────────────────────

interface UserForm {
  name: string;
  fatherOrSpouseName: string; // teacher only
  cnic: string;
  phone: string;
  email: string;
  password: string; // create only
}

function emptyForm(): UserForm {
  return {
    name: "",
    fatherOrSpouseName: "",
    cnic: "",
    phone: "",
    email: "",
    password: "",
  };
}

// ─── Main Component ─────────────────────────────────────────────────

export function UserManagement() {
  const [tab, setTab] = useState<Tab>("teachers");
  const [view, setView] = useState<View>("list");

  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [academics, setAcademics] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<UserForm>(emptyForm());
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Confirmation dialogs
  const [confirmRevoke, setConfirmRevoke] = useState<UserProfile | null>(null);
  const [confirmPasswordReset, setConfirmPasswordReset] = useState<UserProfile | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useCallback(() => Date.now(), []);

  const addToast = useCallback((type: "success" | "error", message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  // ─── Data Fetching ──────────────────────────────────────────────

  const fetchTeachers = useCallback(async () => {
    try {
      const res = await fetch("/api/teachers");
      if (!res.ok) throw new Error("Failed to fetch teachers");
      const json = await res.json();
      setTeachers(json.data ?? []);
    } catch {
      setError("Failed to load teachers.");
    }
  }, []);

  const fetchAcademics = useCallback(async () => {
    try {
      const res = await fetch("/api/academics");
      if (!res.ok) throw new Error("Failed to fetch academics");
      const json = await res.json();
      setAcademics(json.data ?? []);
    } catch {
      setError("Failed to load academics accounts.");
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    await Promise.all([fetchTeachers(), fetchAcademics()]);
    setLoading(false);
  }, [fetchTeachers, fetchAcademics]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ─── Reset form state ──────────────────────────────────────────

  const resetForm = useCallback(() => {
    setForm(emptyForm());
    setEditingUser(null);
    setFieldErrors({});
    setSubmitting(false);
  }, []);

  const openCreate = useCallback(() => {
    resetForm();
    setView("create");
  }, [resetForm]);

  const openEdit = useCallback((user: UserProfile) => {
    setForm({
      name: user.name,
      fatherOrSpouseName: "", // not stored on profile for academics, always empty for teacher edit
      cnic: user.cnic,
      phone: user.phone,
      email: user.email ?? "",
      password: "",
    });
    setEditingUser(user);
    setFieldErrors({});
    setView("edit");
  }, []);

  // ─── Validate form ─────────────────────────────────────────────

  const validateForm = useCallback(
    (isCreate: boolean): boolean => {
      const errors: Record<string, string> = {};

      const nameErr = validateRequired(form.name, "Name");
      if (nameErr) errors.name = nameErr;

      if (tab === "teachers") {
        const fatherErr = validateRequired(form.fatherOrSpouseName, "Father/Spouse Name");
        if (fatherErr) errors.fatherOrSpouseName = fatherErr;
      }

      const cnicErr = validateCNIC(form.cnic);
      if (cnicErr) errors.cnic = cnicErr;

      const phoneErr = validatePhone(form.phone);
      if (phoneErr) errors.phone = phoneErr;

      const emailErr = validateEmail(form.email);
      if (emailErr) errors.email = emailErr;

      if (isCreate) {
        const pwErr = validatePassword(form.password);
        if (pwErr) errors.password = pwErr;
      }

      setFieldErrors(errors);
      return Object.keys(errors).length === 0;
    },
    [form, tab],
  );

  // ─── Submit create ─────────────────────────────────────────────

  const handleCreate = useCallback(async () => {
    if (!validateForm(true)) return;
    setSubmitting(true);

    const endpoint = tab === "teachers" ? "/api/teachers" : "/api/academics";
    const payload: Record<string, string> = {
      name: form.name,
      cnic: form.cnic,
      phone: form.phone,
      password: form.password,
    };
    if (form.email) payload.email = form.email;
    if (tab === "teachers") payload.fatherOrSpouseName = form.fatherOrSpouseName;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!res.ok) {
        setFieldErrors({ _submit: json.error?.message ?? "Failed to create account." });
        setSubmitting(false);
        return;
      }

      addToast("success", `${tab === "teachers" ? "Teacher" : "Academics account"} created successfully.`);
      resetForm();
      setView("list");
      await loadAll();
    } catch {
      setFieldErrors({ _submit: "Network error. Please try again." });
      setSubmitting(false);
    }
  }, [form, tab, validateForm, addToast, resetForm, loadAll]);

  // ─── Submit edit ───────────────────────────────────────────────

  const handleEdit = useCallback(async () => {
    if (!editingUser) return;
    if (!validateForm(false)) return;
    setSubmitting(true);

    const endpoint =
      tab === "teachers"
        ? `/api/teachers/${editingUser.id}`
        : `/api/academics/${editingUser.id}`;

    const payload: Record<string, string> = {
      name: form.name,
      cnic: form.cnic,
      phone: form.phone,
    };
    if (form.email) payload.email = form.email;
    if (tab === "teachers") payload.fatherOrSpouseName = form.fatherOrSpouseName;

    try {
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!res.ok) {
        setFieldErrors({ _submit: json.error?.message ?? "Failed to update account." });
        setSubmitting(false);
        return;
      }

      addToast("success", "Account updated successfully.");
      resetForm();
      setView("list");
      await loadAll();
    } catch {
      setFieldErrors({ _submit: "Network error. Please try again." });
      setSubmitting(false);
    }
  }, [editingUser, form, tab, validateForm, addToast, resetForm, loadAll]);

  // ─── Revoke access ─────────────────────────────────────────────

  const handleRevoke = useCallback(async () => {
    if (!confirmRevoke) return;
    setSubmitting(true);

    const endpoint =
      confirmRevoke.user.role === "TEACHER"
        ? `/api/teachers/${confirmRevoke.id}`
        : `/api/academics/${confirmRevoke.id}`;

    try {
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });

      if (!res.ok) {
        const json = await res.json();
        addToast("error", json.error?.message ?? "Failed to revoke access.");
        setConfirmRevoke(null);
        setSubmitting(false);
        return;
      }

      addToast("success", `Access revoked for ${confirmRevoke.name}.`);
      setConfirmRevoke(null);
      setSubmitting(false);
      await loadAll();
    } catch {
      addToast("error", "Network error. Please try again.");
      setConfirmRevoke(null);
      setSubmitting(false);
    }
  }, [confirmRevoke, addToast, loadAll]);

  // ─── Reactivate ────────────────────────────────────────────────

  const handleReactivate = useCallback(
    async (user: UserProfile) => {
      const endpoint =
        user.user.role === "TEACHER"
          ? `/api/teachers/${user.id}`
          : `/api/academics/${user.id}`;

      try {
        const res = await fetch(endpoint, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: true }),
        });

        if (!res.ok) {
          addToast("error", "Failed to reactivate account.");
          return;
        }

        addToast("success", `Account reactivated for ${user.name}.`);
        await loadAll();
      } catch {
        addToast("error", "Network error. Please try again.");
      }
    },
    [addToast, loadAll],
  );

  // ─── Password reset ────────────────────────────────────────────

  const handlePasswordReset = useCallback(async () => {
    if (!confirmPasswordReset) return;

    const pwErr = validatePassword(newPassword);
    if (pwErr) {
      setPasswordError(pwErr);
      return;
    }

    setSubmitting(true);
    setPasswordError(null);

    const endpoint =
      confirmPasswordReset.user.role === "TEACHER"
        ? `/api/teachers/${confirmPasswordReset.id}/reset-password`
        : `/api/academics/${confirmPasswordReset.id}/reset-password`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });

      if (!res.ok) {
        const json = await res.json();
        addToast("error", json.error?.message ?? "Failed to reset password.");
        setConfirmPasswordReset(null);
        setNewPassword("");
        setSubmitting(false);
        return;
      }

      addToast("success", `Password updated for ${confirmPasswordReset.name}.`);
      setConfirmPasswordReset(null);
      setNewPassword("");
      setSubmitting(false);
    } catch {
      addToast("error", "Network error. Please try again.");
      setConfirmPasswordReset(null);
      setNewPassword("");
      setSubmitting(false);
    }
  }, [confirmPasswordReset, newPassword, addToast]);

  // ─── Derived data ──────────────────────────────────────────────

  const users = tab === "teachers" ? teachers : academics;
  const userLabel = tab === "teachers" ? "Teacher" : "Academics";

  // ─── Render ────────────────────────────────────────────────────

  return (
    <>
      {/* Toasts */}
      <div className="fixed right-4 top-4 z-50 flex flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "flex items-center gap-2 border px-4 py-3 text-sm font-medium",
              t.type === "success"
                ? "border-success/30 bg-success/10 text-success"
                : "border-danger/30 bg-danger/10 text-danger",
            )}
          >
            {t.type === "success" ? (
              <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
            ) : (
              <XCircle className="size-4 shrink-0" aria-hidden="true" />
            )}
            {t.message}
          </div>
        ))}
      </div>

      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="mt-1 text-sm text-text/60">
            Manage Teacher and Academics accounts.
          </p>
        </div>
        {view === "list" && (
          <Button onClick={openCreate}>
            <UserPlus className="size-4" aria-hidden="true" />
            Add {userLabel}
          </Button>
        )}
      </div>

      {/* Tab bar */}
      <div className="mb-6 flex border-b border-border">
        {(["teachers", "academics"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
              setView("list");
              resetForm();
            }}
            className={cn(
              "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-text/50 hover:text-text",
            )}
            aria-selected={tab === t}
            role="tab"
          >
            {t === "teachers" ? "Teachers" : "Academics"}
          </button>
        ))}
      </div>

      {/* Create/Edit form */}
      {view !== "list" && (
        <Card className="mb-6 p-6">
          <h2 className="mb-4 text-base font-semibold">
            {view === "create" ? `Add New ${userLabel}` : `Edit ${userLabel}`}
          </h2>

          {fieldErrors._submit && (
            <div
              className="mb-4 flex items-center gap-2 border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
              role="alert"
            >
              <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
              {fieldErrors._submit}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Name */}
            <div>
              <label htmlFor="name" className="mb-1 block text-xs font-medium text-text/60">
                Name *
              </label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                aria-invalid={!!fieldErrors.name}
                aria-describedby={fieldErrors.name ? "name-error" : undefined}
              />
              {fieldErrors.name && (
                <p id="name-error" className="mt-1 text-xs text-danger">
                  {fieldErrors.name}
                </p>
              )}
            </div>

            {/* Father/Spouse Name (teachers only) */}
            {tab === "teachers" && (
              <div>
                <label
                  htmlFor="fatherOrSpouseName"
                  className="mb-1 block text-xs font-medium text-text/60"
                >
                  Father / Spouse Name *
                </label>
                <Input
                  id="fatherOrSpouseName"
                  value={form.fatherOrSpouseName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, fatherOrSpouseName: e.target.value }))
                  }
                  aria-invalid={!!fieldErrors.fatherOrSpouseName}
                  aria-describedby={
                    fieldErrors.fatherOrSpouseName ? "father-error" : undefined
                  }
                />
                {fieldErrors.fatherOrSpouseName && (
                  <p id="father-error" className="mt-1 text-xs text-danger">
                    {fieldErrors.fatherOrSpouseName}
                  </p>
                )}
              </div>
            )}

            {/* CNIC */}
            <div>
              <label htmlFor="cnic" className="mb-1 block text-xs font-medium text-text/60">
                CNIC *
              </label>
              <Input
                id="cnic"
                placeholder="xxxxx-xxxxxxx-x"
                value={form.cnic}
                onChange={(e) => setForm((f) => ({ ...f, cnic: e.target.value }))}
                aria-invalid={!!fieldErrors.cnic}
                aria-describedby={fieldErrors.cnic ? "cnic-error" : undefined}
              />
              {fieldErrors.cnic && (
                <p id="cnic-error" className="mt-1 text-xs text-danger">
                  {fieldErrors.cnic}
                </p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="phone" className="mb-1 block text-xs font-medium text-text/60">
                Phone *
              </label>
              <Input
                id="phone"
                placeholder="03xx-xxxxxxx"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                aria-invalid={!!fieldErrors.phone}
                aria-describedby={fieldErrors.phone ? "phone-error" : undefined}
              />
              {fieldErrors.phone && (
                <p id="phone-error" className="mt-1 text-xs text-danger">
                  {fieldErrors.phone}
                </p>
              )}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="mb-1 block text-xs font-medium text-text/60">
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                aria-invalid={!!fieldErrors.email}
                aria-describedby={fieldErrors.email ? "email-error" : undefined}
              />
              {fieldErrors.email && (
                <p id="email-error" className="mt-1 text-xs text-danger">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            {/* Password (create only) */}
            {view === "create" && (
              <div>
                <label
                  htmlFor="password"
                  className="mb-1 block text-xs font-medium text-text/60"
                >
                  Password *
                </label>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  aria-invalid={!!fieldErrors.password}
                  aria-describedby={fieldErrors.password ? "password-error" : undefined}
                />
                {fieldErrors.password && (
                  <p id="password-error" className="mt-1 text-xs text-danger">
                    {fieldErrors.password}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="mt-6 flex gap-3">
            <Button
              onClick={view === "create" ? handleCreate : handleEdit}
              disabled={submitting}
            >
              {submitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {view === "create" ? `Create ${userLabel}` : "Save Changes"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                resetForm();
                setView("list");
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* User Table */}
      {view === "list" && (
        <>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : error ? (
            <EmptyState
              icon={AlertTriangle}
              title="Error loading accounts"
              description={error}
              action={
                <Button variant="secondary" onClick={loadAll}>
                  Retry
                </Button>
              }
            />
          ) : users.length === 0 ? (
            <EmptyState
              icon={UserPlus}
              title={`No ${userLabel.toLowerCase()} accounts yet`}
              description={`Create the first ${userLabel.toLowerCase()} account to get started.`}
              action={
                <Button onClick={openCreate}>
                  <UserPlus className="size-4" aria-hidden="true" />
                  Add {userLabel}
                </Button>
              }
            />
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <TR>
                      <TH>Name</TH>
                      <TH>CNIC</TH>
                      <TH>Phone</TH>
                      <TH>Email</TH>
                      <TH>Status</TH>
                      <TH className="w-32">Actions</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {users.map((u) => (
                      <TR key={u.id}>
                        <TD className="font-medium">{u.name}</TD>
                        <TD className="tabular-nums">{u.cnic}</TD>
                        <TD className="tabular-nums">{u.phone}</TD>
                        <TD>{u.email ?? "—"}</TD>
                        <TD>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 border px-2 py-0.5 text-xs font-medium",
                              u.user.isActive
                                ? "border-success/30 bg-success/10 text-success"
                                : "border-danger/30 bg-danger/10 text-danger",
                            )}
                          >
                            {u.user.isActive ? "Active" : "Inactive"}
                          </span>
                        </TD>
                        <TD>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => openEdit(u)}
                              className="inline-flex size-8 items-center justify-center border border-transparent text-text/50 hover:bg-surface hover:text-text"
                              aria-label={`Edit ${u.name}`}
                              title="Edit"
                            >
                              <Edit3 className="size-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmPasswordReset(u);
                                setNewPassword("");
                                setPasswordError(null);
                              }}
                              className="inline-flex size-8 items-center justify-center border border-transparent text-text/50 hover:bg-surface hover:text-text"
                              aria-label={`Reset password for ${u.name}`}
                              title="Reset Password"
                            >
                              <Key className="size-3.5" aria-hidden="true" />
                            </button>
                            {u.user.isActive ? (
                              <button
                                type="button"
                                onClick={() => setConfirmRevoke(u)}
                                className="inline-flex size-8 items-center justify-center border border-transparent text-text/50 hover:bg-danger/10 hover:text-danger"
                                aria-label={`Revoke access for ${u.name}`}
                                title="Revoke Access"
                              >
                                <Trash2 className="size-3.5" aria-hidden="true" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleReactivate(u)}
                                className="inline-flex size-8 items-center justify-center border border-transparent text-text/50 hover:bg-success/10 hover:text-success"
                                aria-label={`Reactivate ${u.name}`}
                                title="Reactivate"
                              >
                                <ShieldCheck className="size-3.5" aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Revoke Access Confirmation Dialog */}
      {confirmRevoke && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setConfirmRevoke(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setConfirmRevoke(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="revoke-dialog-title"
        >
          <Card
            className="mx-4 w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center border border-danger/20 bg-danger/10">
                <AlertTriangle className="size-5 text-danger" aria-hidden="true" />
              </div>
              <div>
                <h3 id="revoke-dialog-title" className="text-base font-semibold">
                  Revoke Access
                </h3>
                <p className="text-sm text-text/60">
                  This is an administrative action.
                </p>
              </div>
            </div>
            <p className="mb-6 text-sm text-text/70">
              Are you sure you want to revoke access for{" "}
              <strong>{confirmRevoke.name}</strong>? The account will be
              deactivated and the user will lose access to the system.
            </p>
            <div className="flex gap-3">
              <Button
                variant="danger"
                onClick={handleRevoke}
                disabled={submitting}
              >
                {submitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                Revoke Access
              </Button>
              <Button
                variant="secondary"
                onClick={() => setConfirmRevoke(null)}
                disabled={submitting}
              >
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Password Reset Confirmation Dialog */}
      {confirmPasswordReset && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => {
            setConfirmPasswordReset(null);
            setNewPassword("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setConfirmPasswordReset(null);
              setNewPassword("");
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="password-dialog-title"
        >
          <Card
            className="mx-4 w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center border border-primary/20 bg-primary/10">
                <Key className="size-5 text-primary" aria-hidden="true" />
              </div>
              <div>
                <h3 id="password-dialog-title" className="text-base font-semibold">
                  Reset Password
                </h3>
                <p className="text-sm text-text/60">
                  Set a new password for this account.
                </p>
              </div>
            </div>
            <p className="mb-4 text-sm text-text/70">
              Account: <strong>{confirmPasswordReset.name}</strong>
            </p>
            <div className="mb-4">
              <label
                htmlFor="new-password"
                className="mb-1 block text-xs font-medium text-text/60"
              >
                New Password *
              </label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setPasswordError(null);
                }}
                aria-invalid={!!passwordError}
                aria-describedby={passwordError ? "new-pw-error" : undefined}
              />
              {passwordError && (
                <p id="new-pw-error" className="mt-1 text-xs text-danger">
                  {passwordError}
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handlePasswordReset}
                disabled={submitting}
              >
                {submitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                Update Password
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setConfirmPasswordReset(null);
                  setNewPassword("");
                }}
                disabled={submitting}
              >
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
