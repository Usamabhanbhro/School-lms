"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Edit3,
  Loader2,
  Plus,
  BookMarked,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { ToastContainer, useToast } from "@/components/ui/toast";

// ─── Types ──────────────────────────────────────────────────────────

interface Subject {
  id: string;
  name: string;
  _count: { subjectTeacherAssignments: number };
  createdAt: string;
  updatedAt: string;
}

type View = "list" | "create" | "edit";

// ─── Main Component ─────────────────────────────────────────────────

export function SubjectManagement() {
  const [view, setView] = useState<View>("list");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formName, setFormName] = useState("");
  const [editingItem, setEditingItem] = useState<Subject | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const { toasts, addToast, dismissToast } = useToast();

  // ─── Data Fetching ──────────────────────────────────────────────

  const fetchSubjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/subjects");
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setSubjects(json.data ?? []);
    } catch {
      setError("Failed to load subjects.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  // ─── Create/Edit ────────────────────────────────────────────────

  const openCreate = useCallback(() => {
    setFormName("");
    setEditingItem(null);
    setFieldErrors({});
    setView("create");
  }, []);

  const openEdit = useCallback((item: Subject) => {
    setFormName(item.name);
    setEditingItem(item);
    setFieldErrors({});
    setView("edit");
  }, []);

  const handleCreate = useCallback(async () => {
    if (!formName.trim()) {
      setFieldErrors({ name: "Subject name is required." });
      return;
    }
    setFieldErrors({});
    setSubmitting(true);

    try {
      const res = await fetch("/api/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formName.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFieldErrors({ _submit: json.error?.message ?? "Failed to create." });
        setSubmitting(false);
        return;
      }
      addToast("success", "Subject created.");
      setView("list");
      setFormName("");
      await fetchSubjects();
    } catch {
      setFieldErrors({ _submit: "Network error." });
    } finally {
      setSubmitting(false);
    }
  }, [formName, addToast, fetchSubjects]);

  const handleEdit = useCallback(async () => {
    if (!editingItem) return;
    if (!formName.trim()) {
      setFieldErrors({ name: "Subject name is required." });
      return;
    }
    setFieldErrors({});
    setSubmitting(true);

    try {
      const res = await fetch(`/api/subjects/${editingItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formName.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFieldErrors({ _submit: json.error?.message ?? "Failed to update." });
        setSubmitting(false);
        return;
      }
      addToast("success", "Subject updated.");
      setView("list");
      setFormName("");
      setEditingItem(null);
      await fetchSubjects();
    } catch {
      setFieldErrors({ _submit: "Network error." });
    } finally {
      setSubmitting(false);
    }
  }, [editingItem, formName, addToast, fetchSubjects]);

  // ─── Render ────────────────────────────────────────────────────

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <PageHeader
        title="Subjects"
        description="Manage subjects taught at your school."
        actions={
          view === "list" ? (
            <Button onClick={openCreate}>
              <Plus className="size-4" aria-hidden="true" />
              Add Subject
            </Button>
          ) : undefined
        }
      />

      {/* Create/Edit form */}
      {view !== "list" && (
        <Card className="mb-6 p-6">
          <h2 className="mb-4 text-base font-semibold">
            {view === "create" ? "Add New Subject" : "Edit Subject"}
          </h2>

          {fieldErrors._submit && (
            <div className="mb-4 flex items-center gap-2 border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger" role="alert">
              <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
              {fieldErrors._submit}
            </div>
          )}

          <div className="max-w-md">
            <label htmlFor="subjectName" className="mb-1 block text-xs font-medium text-text/60">
              Subject Name *
            </label>
            <Input
              id="subjectName"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Mathematics"
              aria-invalid={!!fieldErrors.name}
              aria-describedby={fieldErrors.name ? "subjectName-error" : undefined}
            />
            {fieldErrors.name && (
              <p id="subjectName-error" className="mt-1 text-xs text-danger">{fieldErrors.name}</p>
            )}
          </div>

          <div className="mt-6 flex gap-3">
            <Button onClick={view === "create" ? handleCreate : handleEdit} disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {view === "create" ? "Create" : "Save Changes"}
            </Button>
            <Button variant="secondary" onClick={() => { setView("list"); setFormName(""); setEditingItem(null); }} disabled={submitting}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Table */}
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
              title="Error loading subjects"
              description={error}
              action={<Button variant="secondary" onClick={fetchSubjects}>Retry</Button>}
            />
          ) : subjects.length === 0 ? (
            <EmptyState
              icon={BookMarked}
              title="No subjects yet"
              description="Create the first subject to get started."
              action={<Button onClick={openCreate}><Plus className="size-4" aria-hidden="true" />Add Subject</Button>}
            />
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <TR>
                      <TH>Name</TH>
                      <TH className="tabular-nums">Assigned Teachers</TH>
                      <TH className="w-20">Actions</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {subjects.map((s) => (
                      <TR key={s.id}>
                        <TD className="font-medium">{s.name}</TD>
                        <TD className="tabular-nums">{s._count.subjectTeacherAssignments}</TD>
                        <TD>
                          <button
                            type="button"
                            onClick={() => openEdit(s)}
                            className="inline-flex size-8 items-center justify-center border border-transparent text-text/50 hover:bg-surface hover:text-text"
                            title="Edit"
                            aria-label={`Edit ${s.name}`}
                          >
                            <Edit3 className="size-3.5" aria-hidden="true" />
                          </button>
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
    </>
  );
}
