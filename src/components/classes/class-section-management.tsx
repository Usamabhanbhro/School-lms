"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Edit3,
  Loader2,
  Plus,
  School,
  UserMinus,
  UserPlus,
  X,
  BookMarked,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { ToastContainer, useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────

interface TeacherProfile {
  id: string;
  name: string;
  phone: string;
}

interface Subject {
  id: string;
  name: string;
}

interface SubjectTeacherAssignment {
  id: string;
  teacherId: string;
  subjectId: string;
  teacher: { id: string; name: string };
  subject: { id: string; name: string };
}

interface ClassSection {
  id: string;
  className: string;
  sectionName: string;
  classTeacherAssignments: Array<{
    id: string;
    teacherId: string;
    teacher: { id: string; name: string; phone: string };
  }>;
  subjectTeacherAssignments: SubjectTeacherAssignment[];
  _count: { students: number };
  createdAt: string;
  updatedAt: string;
}

type View = "list" | "create" | "edit";

// ─── Main Component ─────────────────────────────────────────────────

export function ClassSectionManagement() {
  const [view, setView] = useState<View>("list");
  const [classSections, setClassSections] = useState<ClassSection[]>([]);
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formClassName, setFormClassName] = useState("");
  const [formSectionName, setFormSectionName] = useState("");
  const [editingItem, setEditingItem] = useState<ClassSection | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Teacher assignment dialog
  const [assignClassTeacher, setAssignClassTeacher] = useState<ClassSection | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");

  // Subject teacher assignment dialog
  const [assignSubjectTeacher, setAssignSubjectTeacher] = useState<ClassSection | null>(null);
  const [selectedSubjectTeacherId, setSelectedSubjectTeacherId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");

  // Unassignment confirmation
  const [unassignConfirm, setUnassignConfirm] = useState<{ type: "classTeacher" | "subjectTeacher"; classSectionId: string; teacherId?: string; subjectId?: string; teacherName?: string; subjectName?: string } | null>(null);

  const { toasts, addToast, dismissToast } = useToast();

  // ─── Data Fetching ──────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [csRes, tRes, sRes] = await Promise.all([
        fetch("/api/class-sections"),
        fetch("/api/teachers"),
        fetch("/api/subjects"),
      ]);

      if (!csRes.ok) throw new Error("Failed to load class sections");
      if (!tRes.ok) throw new Error("Failed to load teachers");
      if (!sRes.ok) throw new Error("Failed to load subjects");

      const [csJson, tJson, sJson] = await Promise.all([
        csRes.json(),
        tRes.json(),
        sRes.json(),
      ]);

      setClassSections(csJson.data ?? []);
      setTeachers(tJson.data ?? []);
      setSubjects(sJson.data ?? []);
    } catch {
      setError("Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ─── Create/Edit ────────────────────────────────────────────────

  const openCreate = useCallback(() => {
    setFormClassName("");
    setFormSectionName("");
    setEditingItem(null);
    setFieldErrors({});
    setView("create");
  }, []);

  const openEdit = useCallback((item: ClassSection) => {
    setFormClassName(item.className);
    setFormSectionName(item.sectionName);
    setEditingItem(item);
    setFieldErrors({});
    setView("edit");
  }, []);

  const handleCreate = useCallback(async () => {
    const errors: Record<string, string> = {};
    if (!formClassName.trim()) errors.className = "Class name is required.";
    if (!formSectionName.trim()) errors.sectionName = "Section name is required.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/class-sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ className: formClassName.trim(), sectionName: formSectionName.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFieldErrors({ _submit: json.error?.message ?? "Failed to create." });
        setSubmitting(false);
        return;
      }
      addToast("success", "Class section created.");
      setView("list");
      await fetchAll();
    } catch {
      setFieldErrors({ _submit: "Network error." });
    } finally {
      setSubmitting(false);
    }
  }, [formClassName, formSectionName, addToast, fetchAll]);

  const handleEdit = useCallback(async () => {
    if (!editingItem) return;
    const errors: Record<string, string> = {};
    if (!formClassName.trim()) errors.className = "Class name is required.";
    if (!formSectionName.trim()) errors.sectionName = "Section name is required.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/class-sections/${editingItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ className: formClassName.trim(), sectionName: formSectionName.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFieldErrors({ _submit: json.error?.message ?? "Failed to update." });
        setSubmitting(false);
        return;
      }
      addToast("success", "Class section updated.");
      setView("list");
      await fetchAll();
    } catch {
      setFieldErrors({ _submit: "Network error." });
    } finally {
      setSubmitting(false);
    }
  }, [editingItem, formClassName, formSectionName, addToast, fetchAll]);

  // ─── Class Teacher Assignment ───────────────────────────────────

  const handleAssignClassTeacher = useCallback(async () => {
    if (!assignClassTeacher || !selectedTeacherId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/class-sections/${assignClassTeacher.id}/class-teacher`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId: selectedTeacherId }),
      });
      const json = await res.json();
      if (!res.ok) {
        addToast("error", json.error?.message ?? "Failed to assign teacher.");
        setAssignClassTeacher(null);
        setSubmitting(false);
        return;
      }
      addToast("success", "Class teacher assigned.");
      setAssignClassTeacher(null);
      setSelectedTeacherId("");
      await fetchAll();
    } catch {
      addToast("error", "Network error.");
      setAssignClassTeacher(null);
    } finally {
      setSubmitting(false);
    }
  }, [assignClassTeacher, selectedTeacherId, addToast, fetchAll]);

  // ─── Subject Teacher Assignment ─────────────────────────────────

  const handleAssignSubjectTeacher = useCallback(async () => {
    if (!assignSubjectTeacher || !selectedSubjectTeacherId || !selectedSubjectId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/class-sections/${assignSubjectTeacher.id}/subject-teachers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId: selectedSubjectTeacherId, subjectId: selectedSubjectId }),
      });
      const json = await res.json();
      if (!res.ok) {
        addToast("error", json.error?.message ?? "Failed to assign subject teacher.");
        setAssignSubjectTeacher(null);
        setSubmitting(false);
        return;
      }
      addToast("success", "Subject teacher assigned.");
      setAssignSubjectTeacher(null);
      setSelectedSubjectTeacherId("");
      setSelectedSubjectId("");
      await fetchAll();
    } catch {
      addToast("error", "Network error.");
      setAssignSubjectTeacher(null);
    } finally {
      setSubmitting(false);
    }
  }, [assignSubjectTeacher, selectedSubjectTeacherId, selectedSubjectId, addToast, fetchAll]);

  // ─── Unassignment Handlers ─────────────────────────────────────

  const handleUnassignClassTeacher = useCallback(async () => {
    if (!unassignConfirm || unassignConfirm.type !== "classTeacher") return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/class-sections/${unassignConfirm.classSectionId}/class-teacher`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) {
        addToast("error", json.error?.message ?? "Failed to unassign.");
      } else {
        addToast("success", "Class teacher unassigned.");
      }
    } catch {
      addToast("error", "Network error.");
    } finally {
      setSubmitting(false);
      setUnassignConfirm(null);
      await fetchAll();
    }
  }, [unassignConfirm, addToast, fetchAll]);

  const handleUnassignSubjectTeacher = useCallback(async () => {
    if (!unassignConfirm || unassignConfirm.type !== "subjectTeacher" || !unassignConfirm.teacherId || !unassignConfirm.subjectId) return;
    setSubmitting(true);
    try {
      const params = new URLSearchParams({
        classSectionId: unassignConfirm.classSectionId,
        teacherId: unassignConfirm.teacherId,
        subjectId: unassignConfirm.subjectId,
      });
      const res = await fetch(`/api/class-sections/${unassignConfirm.classSectionId}/subject-teachers?${params.toString()}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) {
        addToast("error", json.error?.message ?? "Failed to unassign.");
      } else {
        addToast("success", "Subject teacher unassigned.");
      }
    } catch {
      addToast("error", "Network error.");
    } finally {
      setSubmitting(false);
      setUnassignConfirm(null);
      await fetchAll();
    }
  }, [unassignConfirm, addToast, fetchAll]);

  // ─── Render ────────────────────────────────────────────────────

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <PageHeader
        title="Classes & Sections"
        description="Manage class sections and assign teachers."
        actions={
          view === "list" ? (
            <Button onClick={openCreate}>
              <Plus className="size-4" aria-hidden="true" />
              Add Class Section
            </Button>
          ) : undefined
        }
      />

      {/* Create/Edit form */}
      {view !== "list" && (
        <Card className="mb-6 p-6">
          <h2 className="mb-4 text-base font-semibold">
            {view === "create" ? "Add New Class Section" : "Edit Class Section"}
          </h2>

          {fieldErrors._submit && (
            <div className="mb-4 flex items-center gap-2 border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger" role="alert">
              <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
              {fieldErrors._submit}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="className" className="mb-1 block text-xs font-medium text-text/60">
                Class Name *
              </label>
              <Input
                id="className"
                value={formClassName}
                onChange={(e) => setFormClassName(e.target.value)}
                placeholder="e.g. Grade 5"
                aria-invalid={!!fieldErrors.className}
                aria-describedby={fieldErrors.className ? "className-error" : undefined}
              />
              {fieldErrors.className && (
                <p id="className-error" className="mt-1 text-xs text-danger">{fieldErrors.className}</p>
              )}
            </div>

            <div>
              <label htmlFor="sectionName" className="mb-1 block text-xs font-medium text-text/60">
                Section Name *
              </label>
              <Input
                id="sectionName"
                value={formSectionName}
                onChange={(e) => setFormSectionName(e.target.value)}
                placeholder="e.g. A"
                aria-invalid={!!fieldErrors.sectionName}
                aria-describedby={fieldErrors.sectionName ? "sectionName-error" : undefined}
              />
              {fieldErrors.sectionName && (
                <p id="sectionName-error" className="mt-1 text-xs text-danger">{fieldErrors.sectionName}</p>
              )}
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <Button onClick={view === "create" ? handleCreate : handleEdit} disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {view === "create" ? "Create" : "Save Changes"}
            </Button>
            <Button variant="secondary" onClick={() => setView("list")} disabled={submitting}>
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
              title="Error loading data"
              description={error}
              action={<Button variant="secondary" onClick={fetchAll}>Retry</Button>}
            />
          ) : classSections.length === 0 ? (
            <EmptyState
              icon={School}
              title="No class sections yet"
              description="Create the first class section to get started."
              action={<Button onClick={openCreate}><Plus className="size-4" aria-hidden="true" />Add Class Section</Button>}
            />
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <TR>
                      <TH>Class</TH>
                      <TH>Section</TH>
                      <TH>Class Teacher</TH>
                      <TH>Subject Teachers</TH>
                      <TH className="tabular-nums">Students</TH>
                      <TH className="w-32">Actions</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {classSections.map((cs) => {
                      const activeTeacher = cs.classTeacherAssignments[0]?.teacher;
                      return (
                        <TR key={cs.id}>
                          <TD className="font-medium">{cs.className}</TD>
                          <TD>{cs.sectionName}</TD>
                          <TD>
                            {activeTeacher ? (
                              <div className="flex items-center gap-1">
                                <span className="text-sm">{activeTeacher.name}</span>
                                <button
                                  type="button"
                                  onClick={() => setUnassignConfirm({
                                    type: "classTeacher",
                                    classSectionId: cs.id,
                                    teacherId: cs.classTeacherAssignments[0]?.teacherId,
                                    teacherName: activeTeacher.name,
                                  })}
                                  className="inline-flex size-6 items-center justify-center text-danger/60 hover:text-danger"
                                  title="Unassign class teacher"
                                  aria-label={`Unassign ${activeTeacher.name} as class teacher`}
                                >
                                  <UserMinus className="size-3" aria-hidden="true" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-text/40">—</span>
                            )}
                          </TD>
                          <TD>
                            {cs.subjectTeacherAssignments.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {cs.subjectTeacherAssignments.map((sta) => (
                                  <span key={sta.id} className="inline-flex items-center border border-border px-1.5 py-0.5 text-xs">
                                    {sta.subject.name}: {sta.teacher.name}
                                    <button
                                      type="button"
                                      onClick={() => setUnassignConfirm({
                                        type: "subjectTeacher",
                                        classSectionId: cs.id,
                                        teacherId: sta.teacherId,
                                        subjectId: sta.subjectId,
                                        teacherName: sta.teacher.name,
                                        subjectName: sta.subject.name,
                                      })}
                                      className="ml-1 inline-flex size-4 items-center justify-center text-danger/60 hover:text-danger"
                                      title="Unassign"
                                      aria-label={`Unassign ${sta.teacher.name} from ${sta.subject.name}`}
                                    >
                                      <X className="size-2.5" aria-hidden="true" />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-text/40">—</span>
                            )}
                          </TD>
                          <TD className="tabular-nums">{cs._count.students}</TD>
                          <TD>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => openEdit(cs)}
                                className="inline-flex size-8 items-center justify-center border border-transparent text-text/50 hover:bg-surface hover:text-text"
                                title="Edit"
                                aria-label={`Edit ${cs.className} ${cs.sectionName}`}
                              >
                                <Edit3 className="size-3.5" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setAssignClassTeacher(cs);
                                  setSelectedTeacherId(cs.classTeacherAssignments[0]?.teacherId ?? "");
                                }}
                                className="inline-flex size-8 items-center justify-center border border-transparent text-text/50 hover:bg-surface hover:text-text"
                                title="Assign Class Teacher"
                                aria-label={`Assign class teacher for ${cs.className} ${cs.sectionName}`}
                              >
                                <UserPlus className="size-3.5" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setAssignSubjectTeacher(cs);
                                  setSelectedSubjectTeacherId("");
                                  setSelectedSubjectId("");
                                }}
                                className="inline-flex size-8 items-center justify-center border border-transparent text-text/50 hover:bg-surface hover:text-text"
                                title="Assign Subject Teacher"
                                aria-label={`Assign subject teacher for ${cs.className} ${cs.sectionName}`}
                              >
                                <BookMarked className="size-3.5" aria-hidden="true" />
                              </button>
                            </div>
                          </TD>
                        </TR>
                      );
                    })}
                  </TBody>
                </Table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Class Teacher Assignment Dialog */}
      <ConfirmDialog
        open={!!assignClassTeacher}
        onOpenChange={(open) => {
          if (!open) { setAssignClassTeacher(null); setSelectedTeacherId(""); }
        }}
        icon={UserPlus}
        iconVariant="primary"
        title="Assign Class Teacher"
        description={`Select the class teacher for ${assignClassTeacher?.className ?? ""} - ${assignClassTeacher?.sectionName ?? ""}. Only one class teacher is active at a time.`}
        confirmLabel="Assign"
        confirmVariant="primary"
        loading={submitting}
        onConfirm={handleAssignClassTeacher}
      >
        <div className="mt-2">
          <label htmlFor="teacher-select" className="mb-1 block text-xs font-medium text-text/60">
            Teacher
          </label>
          <select
            id="teacher-select"
            value={selectedTeacherId}
            onChange={(e) => setSelectedTeacherId(e.target.value)}
            className="h-10 w-full border border-border bg-bg px-4 text-sm text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <option value="">Select a teacher…</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      </ConfirmDialog>

      {/* Subject Teacher Assignment Dialog */}
      <ConfirmDialog
        open={!!assignSubjectTeacher}
        onOpenChange={(open) => {
          if (!open) { setAssignSubjectTeacher(null); setSelectedSubjectTeacherId(""); setSelectedSubjectId(""); }
        }}
        icon={BookMarked}
        iconVariant="primary"
        title="Assign Subject Teacher"
        description={`Assign a subject teacher for ${assignSubjectTeacher?.className ?? ""} - ${assignSubjectTeacher?.sectionName ?? ""}.`}
        confirmLabel="Assign"
        confirmVariant="primary"
        loading={submitting}
        onConfirm={handleAssignSubjectTeacher}
      >
        <div className="space-y-3">
          <div>
            <label htmlFor="subject-select" className="mb-1 block text-xs font-medium text-text/60">
              Subject
            </label>
            <select
              id="subject-select"
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="h-10 w-full border border-border bg-bg px-4 text-sm text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <option value="">Select a subject…</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="subject-teacher-select" className="mb-1 block text-xs font-medium text-text/60">
              Teacher
            </label>
            <select
              id="subject-teacher-select"
              value={selectedSubjectTeacherId}
              onChange={(e) => setSelectedSubjectTeacherId(e.target.value)}
              className="h-10 w-full border border-border bg-bg px-4 text-sm text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <option value="">Select a teacher…</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>
      </ConfirmDialog>

      {/* Unassignment Confirmation Dialog */}
      <ConfirmDialog
        open={!!unassignConfirm}
        onOpenChange={(open) => {
          if (!open) setUnassignConfirm(null);
        }}
        icon={UserMinus}
        iconVariant="danger"
        title={!unassignConfirm ? "" : unassignConfirm.type === "classTeacher" ? "Unassign Class Teacher" : "Unassign Subject Teacher"}
        description={
          !unassignConfirm ? ""
          : unassignConfirm.type === "classTeacher"
            ? `Remove ${unassignConfirm.teacherName ?? "this teacher"} as class teacher? Historical attendance records will be preserved.`
            : `Remove ${unassignConfirm.teacherName ?? "this teacher"} from ${unassignConfirm.subjectName ?? "this subject"}? Historical tests and marks will be preserved.`
        }
        confirmLabel="Unassign"
        confirmVariant="danger"
        loading={submitting}
        onConfirm={() => {
          if (unassignConfirm?.type === "classTeacher") handleUnassignClassTeacher();
          else handleUnassignSubjectTeacher();
        }}
      />
    </>
  );
}
