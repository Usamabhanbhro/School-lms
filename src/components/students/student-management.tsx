"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Edit3,
  Loader2,
  Plus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { ToastContainer, useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { cnicRegex, phoneRegex } from "@/lib/validations";

// ─── Types ──────────────────────────────────────────────────────────

interface ClassSection {
  id: string;
  className: string;
  sectionName: string;
}

interface Student {
  id: string;
  name: string;
  guardianName: string;
  guardianCnic: string;
  dateOfBirth: string;
  admissionDate: string;
  classSectionId: string;
  classSection: { id: string; className: string; sectionName: string };
  studentId: string | null;
  rollNumber: string | null;
  createdAt: string;
  updatedAt: string;
}

type View = "list" | "create" | "edit";

interface StudentForm {
  name: string;
  guardianName: string;
  guardianCnic: string;
  dateOfBirth: string;
  admissionDate: string;
  classSectionId: string;
  studentId: string;
  rollNumber: string;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function emptyForm(): StudentForm {
  return {
    name: "",
    guardianName: "",
    guardianCnic: "",
    dateOfBirth: "",
    admissionDate: "",
    classSectionId: "",
    studentId: "",
    rollNumber: "",
  };
}

/** Generate a suggested student ID based on existing records. */
function suggestStudentId(students: Student[]): string {
  const year = new Date().getFullYear();
  const prefix = `STD-${year}-`;
  const existing = students
    .map((s) => s.studentId)
    .filter((id): id is string => !!id && id.startsWith(prefix))
    .map((id) => parseInt(id.replace(prefix, ""), 10))
    .filter((n) => !isNaN(n));
  const next = existing.length > 0 ? Math.max(...existing) + 1 : 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}

/** Generate a suggested roll number for a class section. */
function suggestRollNumber(students: Student[], classSectionId: string): string {
  const classStudents = students.filter((s) => s.classSectionId === classSectionId);
  const numbers = classStudents
    .map((s) => s.rollNumber)
    .filter((r): r is string => !!r)
    .map((r) => parseInt(r, 10))
    .filter((n) => !isNaN(n));
  const next = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
  return String(next);
}

// ─── Validation (client-side, matches server Zod) ───────────────────

function validateCNIC(value: string): string | null {
  if (!value) return "Guardian CNIC is required.";
  if (!cnicRegex.test(value)) return "Must be in format xxxxx-xxxxxxx-x (e.g. 35202-1234567-1).";
  return null;
}

function validateRequired(value: string, label: string): string | null {
  if (!value.trim()) return `${label} is required.`;
  return null;
}

function validateDate(value: string, label: string): string | null {
  if (!value) return `${label} is required.`;
  const d = new Date(value);
  if (isNaN(d.getTime())) return `${label} must be a valid date.`;
  return null;
}

// ─── Main Component ─────────────────────────────────────────────────

export function StudentManagement({ readOnly = false }: { readOnly?: boolean } = {}) {
  const [view, setView] = useState<View>("list");
  const [students, setStudents] = useState<Student[]>([]);
  const [classSections, setClassSections] = useState<ClassSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<StudentForm>(emptyForm());
  const [editingItem, setEditingItem] = useState<Student | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const { toasts, addToast, dismissToast } = useToast();

  // ─── Data Fetching ──────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sRes, csRes] = await Promise.all([
        fetch("/api/students"),
        fetch("/api/class-sections"),
      ]);

      if (!sRes.ok) throw new Error("Failed to fetch students");
      if (!csRes.ok) throw new Error("Failed to fetch class sections");

      const [sJson, csJson] = await Promise.all([sRes.json(), csRes.json()]);
      setStudents(sJson.data ?? []);
      setClassSections(csJson.data ?? []);
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
    const f = emptyForm();
    f.studentId = suggestStudentId(students);
    setForm(f);
    setEditingItem(null);
    setFieldErrors({});
    setView("create");
  }, [students]);

  const openEdit = useCallback((item: Student) => {
    setForm({
      name: item.name,
      guardianName: item.guardianName,
      guardianCnic: item.guardianCnic,
      dateOfBirth: item.dateOfBirth.split("T")[0],
      admissionDate: item.admissionDate.split("T")[0],
      classSectionId: item.classSectionId,
      studentId: item.studentId ?? "",
      rollNumber: item.rollNumber ?? "",
    });
    setEditingItem(item);
    setFieldErrors({});
    setView("edit");
  }, []);

  const validateForm = useCallback((isCreate: boolean): boolean => {
    const errors: Record<string, string> = {};

    const nameErr = validateRequired(form.name, "Name");
    if (nameErr) errors.name = nameErr;

    const guardianErr = validateRequired(form.guardianName, "Guardian name");
    if (guardianErr) errors.guardianName = guardianErr;

    const cnicErr = validateCNIC(form.guardianCnic);
    if (cnicErr) errors.guardianCnic = cnicErr;

    const dobErr = validateDate(form.dateOfBirth, "Date of birth");
    if (dobErr) errors.dateOfBirth = dobErr;

    const admErr = validateDate(form.admissionDate, "Admission date");
    if (admErr) errors.admissionDate = admErr;

    const classErr = validateRequired(form.classSectionId, "Class section");
    if (classErr) errors.classSectionId = classErr;

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form]);

  const handleCreate = useCallback(async () => {
    if (!validateForm(true)) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        setFieldErrors({ _submit: json.error?.message ?? "Failed to create." });
        setSubmitting(false);
        return;
      }
      addToast("success", "Student created.");
      setView("list");
      setForm(emptyForm());
      await fetchAll();
    } catch {
      setFieldErrors({ _submit: "Network error." });
    } finally {
      setSubmitting(false);
    }
  }, [form, validateForm, addToast, fetchAll]);

  const handleEdit = useCallback(async () => {
    if (!editingItem) return;
    if (!validateForm(false)) return;
    setSubmitting(true);

    try {
      const res = await fetch(`/api/students/${editingItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        setFieldErrors({ _submit: json.error?.message ?? "Failed to update." });
        setSubmitting(false);
        return;
      }
      addToast("success", "Student updated.");
      setView("list");
      setEditingItem(null);
      setForm(emptyForm());
      await fetchAll();
    } catch {
      setFieldErrors({ _submit: "Network error." });
    } finally {
      setSubmitting(false);
    }
  }, [editingItem, form, validateForm, addToast, fetchAll]);

  // ─── Helpers ────────────────────────────────────────────────────

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-PK", { year: "numeric", month: "short", day: "numeric" });
  }

  function classLabel(cs: { className: string; sectionName: string }): string {
    return `${cs.className} - ${cs.sectionName}`;
  }

  // ─── Render ────────────────────────────────────────────────────

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <PageHeader
        title="Students"
        description={readOnly ? "View student records and class allotments." : "Manage student records and class allotments."}
        actions={
          view === "list" && !readOnly ? (
            <Button onClick={openCreate}>
              <Plus className="size-4" aria-hidden="true" />
              Add Student
            </Button>
          ) : undefined
        }
      />

      {/* Create/Edit form */}
      {view !== "list" && (
        <Card className="mb-6 p-6">
          <h2 className="mb-4 text-base font-semibold">
            {view === "create" ? "Add New Student" : "Edit Student"}
          </h2>

          {fieldErrors._submit && (
            <div className="mb-4 flex items-center gap-2 border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger" role="alert">
              <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
              {fieldErrors._submit}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Name */}
            <div>
              <label htmlFor="studentName" className="mb-1 block text-xs font-medium text-text/60">
                Student Name *
              </label>
              <Input
                id="studentName"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                aria-invalid={!!fieldErrors.name}
                aria-describedby={fieldErrors.name ? "name-error" : undefined}
              />
              {fieldErrors.name && <p id="name-error" className="mt-1 text-xs text-danger">{fieldErrors.name}</p>}
            </div>

            {/* Guardian Name */}
            <div>
              <label htmlFor="guardianName" className="mb-1 block text-xs font-medium text-text/60">
                Father / Guardian Name *
              </label>
              <Input
                id="guardianName"
                value={form.guardianName}
                onChange={(e) => setForm((f) => ({ ...f, guardianName: e.target.value }))}
                aria-invalid={!!fieldErrors.guardianName}
                aria-describedby={fieldErrors.guardianName ? "guardian-error" : undefined}
              />
              {fieldErrors.guardianName && <p id="guardian-error" className="mt-1 text-xs text-danger">{fieldErrors.guardianName}</p>}
            </div>

            {/* Guardian CNIC */}
            <div>
              <label htmlFor="guardianCnic" className="mb-1 block text-xs font-medium text-text/60">
                Guardian CNIC *
              </label>
              <Input
                id="guardianCnic"
                placeholder="xxxxx-xxxxxxx-x"
                value={form.guardianCnic}
                onChange={(e) => setForm((f) => ({ ...f, guardianCnic: e.target.value }))}
                aria-invalid={!!fieldErrors.guardianCnic}
                aria-describedby={fieldErrors.guardianCnic ? "cnic-error" : undefined}
              />
              {fieldErrors.guardianCnic && <p id="cnic-error" className="mt-1 text-xs text-danger">{fieldErrors.guardianCnic}</p>}
            </div>

            {/* Class Section */}
            <div>
              <label htmlFor="classSection" className="mb-1 block text-xs font-medium text-text/60">
                Class Section *
              </label>
              <select
                id="classSection"
                value={form.classSectionId}
                onChange={(e) => setForm((f) => ({ ...f, classSectionId: e.target.value }))}
                className={cn(
                  "h-10 w-full border border-border bg-bg px-4 text-sm text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                  fieldErrors.classSectionId && "border-danger",
                )}
                aria-invalid={!!fieldErrors.classSectionId}
                aria-describedby={fieldErrors.classSectionId ? "class-error" : undefined}
              >
                <option value="">Select a class…</option>
                {classSections.map((cs) => (
                  <option key={cs.id} value={cs.id}>{classLabel(cs)}</option>
                ))}
              </select>
              {fieldErrors.classSectionId && <p id="class-error" className="mt-1 text-xs text-danger">{fieldErrors.classSectionId}</p>}
            </div>

            {/* Student ID */}
            <div>
              <label htmlFor="studentId" className="mb-1 block text-xs font-medium text-text/60">
                Student ID
              </label>
              <Input
                id="studentId"
                value={form.studentId}
                onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))}
                placeholder={suggestStudentId(students)}
              />
              <p className="mt-1 text-xs text-text/40">Leave blank to skip. Must be unique across all students.</p>
            </div>

            {/* Roll Number */}
            <div>
              <label htmlFor="rollNumber" className="mb-1 block text-xs font-medium text-text/60">
                Roll Number
              </label>
              <Input
                id="rollNumber"
                value={form.rollNumber}
                onChange={(e) => setForm((f) => ({ ...f, rollNumber: e.target.value }))}
                placeholder={form.classSectionId ? suggestRollNumber(students, form.classSectionId) : "Select class first"}
              />
              <p className="mt-1 text-xs text-text/40">Unique within the class section. Leave blank to skip.</p>
            </div>

            {/* Date of Birth */}
            <div>
              <label htmlFor="dateOfBirth" className="mb-1 block text-xs font-medium text-text/60">
                Date of Birth *
              </label>
              <Input
                id="dateOfBirth"
                type="date"
                value={form.dateOfBirth}
                max={todayStr()}
                onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
                aria-invalid={!!fieldErrors.dateOfBirth}
                aria-describedby={fieldErrors.dateOfBirth ? "dob-error" : undefined}
              />
              {fieldErrors.dateOfBirth && <p id="dob-error" className="mt-1 text-xs text-danger">{fieldErrors.dateOfBirth}</p>}
            </div>

            {/* Admission Date */}
            <div>
              <label htmlFor="admissionDate" className="mb-1 block text-xs font-medium text-text/60">
                Admission Date *
              </label>
              <Input
                id="admissionDate"
                type="date"
                value={form.admissionDate}
                max={todayStr()}
                onChange={(e) => setForm((f) => ({ ...f, admissionDate: e.target.value }))}
                aria-invalid={!!fieldErrors.admissionDate}
                aria-describedby={fieldErrors.admissionDate ? "adm-error" : undefined}
              />
              {fieldErrors.admissionDate && <p id="adm-error" className="mt-1 text-xs text-danger">{fieldErrors.admissionDate}</p>}
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <Button onClick={view === "create" ? handleCreate : handleEdit} disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {view === "create" ? "Create" : "Save Changes"}
            </Button>
            <Button variant="secondary" onClick={() => { setView("list"); setForm(emptyForm()); setEditingItem(null); }} disabled={submitting}>
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
              title="Error loading students"
              description={error}
              action={<Button variant="secondary" onClick={fetchAll}>Retry</Button>}
            />
          ) : students.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No students yet"
              description="Create the first student record to get started."
              action={!readOnly ? <Button onClick={openCreate}><Plus className="size-4" aria-hidden="true" />Add Student</Button> : undefined}
            />
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <TR>
                      <TH>Name</TH>
                      <TH>Student ID</TH>
                      <TH>Roll #</TH>
                      <TH>Guardian</TH>
                      <TH>Class</TH>
                      <TH>DOB</TH>
                      <TH>Admission</TH>
                      {!readOnly && <TH className="w-20">Actions</TH>}
                    </TR>
                  </THead>
                  <TBody>
                    {students.map((s) => (
                      <TR key={s.id}>
                        <TD className="font-medium">{s.name}</TD>
                        <TD className="tabular-nums">{s.studentId ?? "—"}</TD>
                        <TD className="tabular-nums">{s.rollNumber ?? "—"}</TD>
                        <TD>{s.guardianName}</TD>
                        <TD>{classLabel(s.classSection)}</TD>
                        <TD className="tabular-nums">{formatDate(s.dateOfBirth)}</TD>
                        <TD className="tabular-nums">{formatDate(s.admissionDate)}</TD>
                        {!readOnly && (
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
                        )}
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
