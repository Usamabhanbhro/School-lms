"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Edit3,
  FileSpreadsheet,
  Loader2,
  Plus,
  Save,
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

// ─── Types ──────────────────────────────────────────────────────────

interface ClassSection {
  id: string;
  className: string;
  sectionName: string;
}

interface Subject {
  id: string;
  name: string;
}

interface TestRecord {
  id: string;
  title: string;
  date: string;
  maxMarks: number;
  classSection: { id: string; className: string; sectionName: string };
  subject: { id: string; name: string };
  teacher: { id: string; name: string };
  _count: { marks: number };
}

interface Student {
  id: string;
  name: string;
  guardianName: string;
}

type View = "list" | "create" | "marks";

// ─── Component ──────────────────────────────────────────────────────

export function TestManagement() {
  const [view, setView] = useState<View>("list");
  const [tests, setTests] = useState<TestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [classes, setClasses] = useState<ClassSection[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [testTitle, setTestTitle] = useState("");
  const [testDate, setTestDate] = useState(todayStr());
  const [maxMarks, setMaxMarks] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Marks entry state
  const [selectedTest, setSelectedTest] = useState<TestRecord | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [localMarks, setLocalMarks] = useState<Record<string, string>>({});
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [savingMarks, setSavingMarks] = useState(false);

  const { toasts, addToast, dismissToast } = useToast();

  // ─── Helpers ────────────────────────────────────────────────────

  function todayStr(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  // ─── Data Loading ─────────────────────────────────────────────

  const loadTests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tests");
      if (!res.ok) throw new Error("Failed to load tests");
      const json = await res.json();
      setTests(json.data ?? []);
    } catch {
      setError("Failed to load tests.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDropdowns = useCallback(async () => {
    try {
      const [classRes, subjectRes] = await Promise.all([
        fetch("/api/class-sections"),
        fetch("/api/subjects"),
      ]);
      if (classRes.ok) {
        const classJson = await classRes.json();
        setClasses(classJson.data ?? []);
      }
      if (subjectRes.ok) {
        const subjectJson = await subjectRes.json();
        setSubjects(subjectJson.data ?? []);
      }
    } catch {
      // Dropdowns fail silently — form will show empty
    }
  }, []);

  useEffect(() => {
    loadTests();
  }, [loadTests]);

  // ─── Create Test ──────────────────────────────────────────────

  const openCreate = useCallback(() => {
    setSelectedClassId("");
    setSelectedSubjectId("");
    setTestTitle("");
    setTestDate(todayStr());
    setMaxMarks("");
    setFieldErrors({});
    loadDropdowns();
    setView("create");
  }, [loadDropdowns]);

  const handleCreate = useCallback(async () => {
    const errors: Record<string, string> = {};
    if (!selectedClassId) errors.classSectionId = "Select a class section.";
    if (!selectedSubjectId) errors.subjectId = "Select a subject.";
    if (!testTitle.trim()) errors.title = "Title is required.";
    if (!maxMarks || parseInt(maxMarks) <= 0) errors.maxMarks = "Max marks must be a positive number.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classSectionId: selectedClassId,
          subjectId: selectedSubjectId,
          title: testTitle.trim(),
          date: testDate,
          maxMarks: parseInt(maxMarks),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFieldErrors({ _submit: json.error?.message ?? "Failed to create test." });
        setSubmitting(false);
        return;
      }
      addToast("success", "Test created successfully.");
      setView("list");
      await loadTests();
    } catch {
      setFieldErrors({ _submit: "Network error. Please try again." });
      setSubmitting(false);
    }
  }, [selectedClassId, selectedSubjectId, testTitle, testDate, maxMarks, addToast, loadTests]);

  // ─── Enter Marks ──────────────────────────────────────────────

  const openMarks = useCallback(async (test: TestRecord) => {
    setSelectedTest(test);
    setLocalMarks({});
    setLoadingStudents(true);
    setView("marks");

    try {
      // Load students for this class section
      const studentsRes = await fetch("/api/students");
      const studentsJson = await studentsRes.json();
      const classStudents = (studentsJson.data ?? []).filter(
        (s: Student & { classSection: { id: string } }) => s.classSection.id === test.classSection.id,
      );
      setStudents(classStudents);
    } catch {
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  }, []);

  const handleSaveMarks = useCallback(async () => {
    if (!selectedTest) return;

    // Validate all marks
    const records: { studentId: string; marksObtained: number }[] = [];
    for (const student of students) {
      const marksStr = localMarks[student.id];
      if (marksStr === undefined || marksStr === "") continue; // skip unanswered
      const marks = parseInt(marksStr);
      if (isNaN(marks) || marks < 0) {
        addToast("error", `Invalid marks for ${student.name}.`);
        return;
      }
      if (marks > selectedTest.maxMarks) {
        addToast("error", `Marks for ${student.name} exceed max (${selectedTest.maxMarks}).`);
        return;
      }
      records.push({ studentId: student.id, marksObtained: marks });
    }

    if (records.length === 0) {
      addToast("error", "Enter marks for at least one student.");
      return;
    }

    setSavingMarks(true);
    try {
      const res = await fetch(`/api/tests/${selectedTest.id}/marks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records }),
      });
      const json = await res.json();
      if (!res.ok) {
        addToast("error", json.error?.message ?? "Failed to save marks.");
        setSavingMarks(false);
        return;
      }
      addToast("success", `Marks saved for ${records.length} student(s).`);
      setView("list");
      await loadTests();
    } catch {
      addToast("error", "Network error. Please try again.");
      setSavingMarks(false);
    }
  }, [selectedTest, students, localMarks, addToast, loadTests]);

  // ─── Render ────────────────────────────────────────────────────

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <PageHeader
        title="Tests & Marks"
        description="Create tests and enter marks for your assigned classes."
        actions={
          view === "list" ? (
            <Button onClick={openCreate}>
              <Plus className="size-4" aria-hidden="true" />
              New Test
            </Button>
          ) : undefined
        }
      />

      {/* Create Test Form */}
      {view === "create" && (
        <Card className="mb-6 p-6">
          <h2 className="mb-4 text-base font-semibold">Create New Test</h2>

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
            {/* Class Section */}
            <div>
              <label htmlFor="test-class" className="mb-1 block text-xs font-medium text-text/60">
                Class Section *
              </label>
              <select
                id="test-class"
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="h-10 w-full border border-border bg-bg px-4 text-sm text-text"
              >
                <option value="">Select class…</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.className} — {c.sectionName}
                  </option>
                ))}
              </select>
              {fieldErrors.classSectionId && (
                <p className="mt-1 text-xs text-danger">{fieldErrors.classSectionId}</p>
              )}
            </div>

            {/* Subject */}
            <div>
              <label htmlFor="test-subject" className="mb-1 block text-xs font-medium text-text/60">
                Subject *
              </label>
              <select
                id="test-subject"
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="h-10 w-full border border-border bg-bg px-4 text-sm text-text"
              >
                <option value="">Select subject…</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {fieldErrors.subjectId && (
                <p className="mt-1 text-xs text-danger">{fieldErrors.subjectId}</p>
              )}
            </div>

            {/* Title */}
            <div>
              <label htmlFor="test-title" className="mb-1 block text-xs font-medium text-text/60">
                Test Title *
              </label>
              <Input
                id="test-title"
                value={testTitle}
                onChange={(e) => setTestTitle(e.target.value)}
                placeholder="e.g. Chapter 3 Quiz"
                aria-invalid={!!fieldErrors.title}
              />
              {fieldErrors.title && (
                <p className="mt-1 text-xs text-danger">{fieldErrors.title}</p>
              )}
            </div>

            {/* Date */}
            <div>
              <label htmlFor="test-date" className="mb-1 block text-xs font-medium text-text/60">
                Date *
              </label>
              <input
                id="test-date"
                type="date"
                value={testDate}
                onChange={(e) => setTestDate(e.target.value)}
                className="h-10 border border-border bg-bg px-4 text-sm text-text"
              />
            </div>

            {/* Max Marks */}
            <div>
              <label htmlFor="test-marks" className="mb-1 block text-xs font-medium text-text/60">
                Max Marks *
              </label>
              <Input
                id="test-marks"
                type="number"
                min="1"
                value={maxMarks}
                onChange={(e) => setMaxMarks(e.target.value)}
                placeholder="e.g. 20"
                className="tabular-nums"
                aria-invalid={!!fieldErrors.maxMarks}
              />
              {fieldErrors.maxMarks && (
                <p className="mt-1 text-xs text-danger">{fieldErrors.maxMarks}</p>
              )}
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Create Test
            </Button>
            <Button variant="secondary" onClick={() => setView("list")} disabled={submitting}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Marks Entry */}
      {view === "marks" && selectedTest && (
        <Card className="mb-6 p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">
                Enter Marks — {selectedTest.title}
              </h2>
              <p className="text-sm text-text/60">
                {selectedTest.classSection.className} — {selectedTest.classSection.sectionName} ·{" "}
                {selectedTest.subject.name} · Max: {selectedTest.maxMarks}
              </p>
            </div>
            <Button variant="secondary" onClick={() => setView("list")}>
              Back to List
            </Button>
          </div>

          {loadingStudents ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : students.length === 0 ? (
            <EmptyState
              icon={AlertTriangle}
              title="No students in this class"
              description="There are no students enrolled in this class section."
            />
          ) : (
            <>
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <THead>
                      <TR>
                        <TH className="w-8">#</TH>
                        <TH>Student Name</TH>
                        <TH>Guardian</TH>
                        <TH className="w-32 text-center">Marks (/{selectedTest.maxMarks})</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {students.map((s, i) => (
                        <TR key={s.id}>
                          <TD className="tabular-nums text-text/50">{i + 1}</TD>
                          <TD className="font-medium">{s.name}</TD>
                          <TD className="text-text/60">{s.guardianName}</TD>
                          <TD className="text-center">
                            <Input
                              type="number"
                              min="0"
                              max={selectedTest.maxMarks}
                              value={localMarks[s.id] ?? ""}
                              onChange={(e) =>
                                setLocalMarks((prev) => ({ ...prev, [s.id]: e.target.value }))
                              }
                              placeholder="—"
                              className="h-8 w-20 text-center tabular-nums"
                              aria-label={`Marks for ${s.name}`}
                            />
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </div>
              </Card>

              <div className="mt-4 flex gap-3">
                <Button onClick={handleSaveMarks} disabled={savingMarks}>
                  {savingMarks && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                  <Save className="size-4" aria-hidden="true" />
                  Save Marks
                </Button>
                <Button variant="secondary" onClick={() => setView("list")} disabled={savingMarks}>
                  Cancel
                </Button>
              </div>
            </>
          )}
        </Card>
      )}

      {/* Test List */}
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
              title="Error loading tests"
              description={error}
              action={
                <Button variant="secondary" onClick={loadTests}>
                  Retry
                </Button>
              }
            />
          ) : tests.length === 0 ? (
            <EmptyState
              icon={FileSpreadsheet}
              title="No tests yet"
              description="Create your first test to start entering marks."
              action={
                <Button onClick={openCreate}>
                  <Plus className="size-4" aria-hidden="true" />
                  New Test
                </Button>
              }
            />
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <TR>
                      <TH>Title</TH>
                      <TH>Class</TH>
                      <TH>Subject</TH>
                      <TH>Date</TH>
                      <TH className="text-center">Max Marks</TH>
                      <TH className="text-center">Marks Entered</TH>
                      <TH className="w-24">Actions</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {tests.map((t) => (
                      <TR key={t.id}>
                        <TD className="font-medium">{t.title}</TD>
                        <TD>
                          {t.classSection.className} — {t.classSection.sectionName}
                        </TD>
                        <TD>{t.subject.name}</TD>
                        <TD className="tabular-nums">{t.date}</TD>
                        <TD className="text-center tabular-nums">{t.maxMarks}</TD>
                        <TD className="text-center tabular-nums">{t._count.marks}</TD>
                        <TD>
                          <button
                            type="button"
                            onClick={() => openMarks(t)}
                            className="inline-flex items-center gap-1 border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/20"
                            aria-label={`Enter marks for ${t.title}`}
                          >
                            <Edit3 className="size-3" aria-hidden="true" />
                            Marks
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
