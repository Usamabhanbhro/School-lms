"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { StudentPicker } from "@/components/ui/student-picker";
import type { StudentPickerStudent } from "@/components/ui/student-picker";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { ToastContainer, useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────

interface ClassSection {
  id: string;
  className: string;
  sectionName: string;
  _count: { students: number };
}

type Student = StudentPickerStudent;

interface Term {
  id: string;
  name: string;
}

interface TestRecord {
  id: string;
  title: string;
  date: string;
  maxMarks: number;
  subject: { id: string; name: string };
  _count: { marks: number };
}

interface ReportCard {
  id: string;
  student: { id: string; name: string; studentId: string | null };
  classSection: { id: string; className: string; sectionName: string };
  term: { id: string; name: string };
  generatedByTeacher: { id: string; name: string };
  createdAt: string;
  reportCardTests: {
    test: {
      id: string;
      title: string;
      maxMarks: number;
      subject: { name: string };
    };
  }[];
}

type View = "list" | "generate";

// ─── Component ──────────────────────────────────────────────────────

export function ReportCardGeneration() {
  const [view, setView] = useState<View>("list");
  const [reportCards, setReportCards] = useState<ReportCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Generate form state
  const [classes, setClasses] = useState<ClassSection[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [terms, setTerms] = useState<Term[]>([]);
  const [selectedTermId, setSelectedTermId] = useState("");
  const [newTermName, setNewTermName] = useState("");
  const [isCreatingTerm, setIsCreatingTerm] = useState(false);
  const [tests, setTests] = useState<TestRecord[]>([]);
  const [selectedTestIds, setSelectedTestIds] = useState<Set<string>>(new Set());
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingTests, setLoadingTests] = useState(false);

  const { toasts, addToast, dismissToast } = useToast();

  // ─── Data Loading ─────────────────────────────────────────────

  const loadReportCards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/report-cards");
      if (!res.ok) throw new Error("Failed to load report cards");
      const json = await res.json();
      setReportCards(json.data ?? []);
    } catch {
      setError("Failed to load report cards.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDropdowns = useCallback(async () => {
    try {
      const [classRes, termRes] = await Promise.all([
        fetch("/api/class-sections"),
        // Terms don't have a GET endpoint — they're created on the fly
        // We'll need to fetch them differently or just let the user create new ones
        Promise.resolve({ ok: true, json: () => ({ data: [] }) }),
      ]);
      if (classRes.ok) {
        const classJson = await classRes.json();
        setClasses(classJson.data ?? []);
      }
      // Terms are created on the fly — no GET endpoint exists
      setTerms([]);
    } catch {
      // Dropdowns fail silently
    }
  }, []);

  useEffect(() => {
    loadReportCards();
  }, [loadReportCards]);

  // ─── Load students when class changes ────────────────────────

  useEffect(() => {
    if (!selectedClassId) {
      setStudents([]);
      setTests([]);
      setSelectedStudentId("");
      setSelectedTestIds(new Set());
      return;
    }
    (async () => {
      setLoadingStudents(true);
      try {
        const res = await fetch("/api/students");
        if (!res.ok) throw new Error("Failed to load students");
        const json = await res.json();
        const filtered = (json.data ?? []).filter(
          (s: Student) => s.classSection.id === selectedClassId,
        );
        setStudents(filtered);
      } catch {
        setStudents([]);
      } finally {
        setLoadingStudents(false);
      }
    })();
  }, [selectedClassId]);

  // ─── Load tests when class changes ──────────────────────────

  useEffect(() => {
    if (!selectedClassId) return;
    (async () => {
      setLoadingTests(true);
      try {
        const res = await fetch(`/api/tests?classSectionId=${selectedClassId}`);
        if (!res.ok) throw new Error("Failed to load tests");
        const json = await res.json();
        setTests(json.data ?? []);
        setSelectedTestIds(new Set());
      } catch {
        setTests([]);
      } finally {
        setLoadingTests(false);
      }
    })();
  }, [selectedClassId]);

  // ─── Create Term ────────────────────────────────────────────

  const handleCreateTerm = useCallback(async () => {
    if (!newTermName.trim()) {
      addToast("error", "Term name is required.");
      return;
    }
    try {
      const res = await fetch("/api/terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTermName.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        addToast("error", json.error?.message ?? "Failed to create term.");
        return;
      }
      const newTerm = json.data;
      setTerms((prev) => [...prev, newTerm]);
      setSelectedTermId(newTerm.id);
      setNewTermName("");
      setIsCreatingTerm(false);
      addToast("success", `Term "${newTerm.name}" created.`);
    } catch {
      addToast("error", "Network error. Please try again.");
    }
  }, [newTermName, addToast]);

  // ─── Toggle test selection ──────────────────────────────────

  const toggleTest = useCallback((testId: string) => {
    setSelectedTestIds((prev) => {
      const next = new Set(prev);
      if (next.has(testId)) {
        next.delete(testId);
      } else {
        next.add(testId);
      }
      return next;
    });
  }, []);

  const toggleAllTests = useCallback(() => {
    if (selectedTestIds.size === tests.length) {
      setSelectedTestIds(new Set());
    } else {
      setSelectedTestIds(new Set(tests.map((t) => t.id)));
    }
  }, [tests, selectedTestIds.size]);

  // ─── Generate Report Card ──────────────────────────────────

  const handleGenerate = useCallback(async () => {
    const errors: Record<string, string> = {};
    if (!selectedClassId) errors.classSectionId = "Select a class section.";
    if (!selectedStudentId) errors.studentId = "Select a student.";
    if (!selectedTermId && !newTermName.trim()) errors.termId = "Select or create a term.";
    if (selectedTestIds.size === 0) errors.testIds = "Select at least one test.";

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    // If creating a new term, do that first
    let termId = selectedTermId;
    if (!termId && newTermName.trim()) {
      try {
        const res = await fetch("/api/terms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newTermName.trim() }),
        });
        const json = await res.json();
        if (!res.ok) {
          addToast("error", json.error?.message ?? "Failed to create term.");
          return;
        }
        termId = json.data.id;
      } catch {
        addToast("error", "Network error creating term.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/report-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selectedStudentId,
          classSectionId: selectedClassId,
          termId,
          testIds: Array.from(selectedTestIds),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFieldErrors({ _submit: json.error?.message ?? "Failed to generate report card." });
        setSubmitting(false);
        return;
      }
      addToast("success", "Report card generated successfully.");
      setView("list");
      await loadReportCards();
    } catch {
      setFieldErrors({ _submit: "Network error. Please try again." });
      setSubmitting(false);
    }
  }, [selectedClassId, selectedStudentId, selectedTermId, newTermName, selectedTestIds, addToast, loadReportCards]);

  // ─── Render ──────────────────────────────────────────────────

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <PageHeader
        title="Report Cards"
        description="Generate and view report cards for your assigned classes."
        actions={
          view === "list" ? (
            <Button onClick={() => { setView("generate"); loadDropdowns(); }}>
              <Plus className="size-4" aria-hidden="true" />
              Generate Report Card
            </Button>
          ) : undefined
        }
      />

      {/* Generate Form */}
      {view === "generate" && (
        <Card className="mb-6 p-6">
          <h2 className="mb-4 text-base font-semibold">Generate Report Card</h2>

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
              <label htmlFor="rc-class" className="mb-1 block text-xs font-medium text-text/60">
                Class Section *
              </label>
              <select
                id="rc-class"
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

            {/* Student */}
            <div>
              <label htmlFor="rc-student" className="mb-1 block text-xs font-medium text-text/60">
                Student *
              </label>
              {loadingStudents ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <StudentPicker
                  students={students}
                  selectedStudentId={selectedStudentId}
                  onSelect={setSelectedStudentId}
                  disabled={!selectedClassId}
                  classSectionId={selectedClassId || undefined}
                />
              )}
              {fieldErrors.studentId && (
                <p className="mt-1 text-xs text-danger">{fieldErrors.studentId}</p>
              )}
            </div>

            {/* Term */}
            <div>
              <label htmlFor="rc-term" className="mb-1 block text-xs font-medium text-text/60">
                Term *
              </label>
              {isCreatingTerm ? (
                <div className="flex gap-2">
                  <Input
                    id="rc-term-new"
                    value={newTermName}
                    onChange={(e) => setNewTermName(e.target.value)}
                    placeholder="e.g. Mid Term"
                    className="flex-1"
                  />
                  <Button onClick={handleCreateTerm} variant="secondary">
                    Save
                  </Button>
                  <Button
                    onClick={() => { setIsCreatingTerm(false); setNewTermName(""); }}
                    variant="ghost"
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <select
                    id="rc-term"
                    value={selectedTermId}
                    onChange={(e) => setSelectedTermId(e.target.value)}
                    className="h-10 flex-1 border border-border bg-bg px-4 text-sm text-text"
                  >
                    <option value="">Select term…</option>
                    {terms.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <Button onClick={() => setIsCreatingTerm(true)} variant="secondary">
                    <Plus className="size-3" aria-hidden="true" />
                    New
                  </Button>
                </div>
              )}
              {fieldErrors.termId && (
                <p className="mt-1 text-xs text-danger">{fieldErrors.termId}</p>
              )}
            </div>
          </div>

          {/* Test Selection */}
          {selectedClassId && (
            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-medium text-text/60">
                  Select Tests to Include *
                </label>
                {tests.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleAllTests}
                    className="text-xs text-primary hover:underline"
                  >
                    {selectedTestIds.size === tests.length ? "Deselect All" : "Select All"}
                  </button>
                )}
              </div>

              {loadingTests ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : tests.length === 0 ? (
                <p className="text-sm text-text/50">
                  No tests found for this class section. Create tests first.
                </p>
              ) : (
                <Card className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <THead>
                        <TR>
                          <TH className="w-10">
                            <input
                              type="checkbox"
                              checked={selectedTestIds.size === tests.length && tests.length > 0}
                              onChange={toggleAllTests}
                              className="size-4"
                              aria-label="Select all tests"
                            />
                          </TH>
                          <TH>Title</TH>
                          <TH>Subject</TH>
                          <TH>Date</TH>
                          <TH className="text-center">Max Marks</TH>
                          <TH className="text-center">Marks Entered</TH>
                        </TR>
                      </THead>
                      <TBody>
                        {tests.map((t) => (
                          <TR key={t.id}>
                            <TD>
                              <input
                                type="checkbox"
                                checked={selectedTestIds.has(t.id)}
                                onChange={() => toggleTest(t.id)}
                                className="size-4"
                                aria-label={`Select ${t.title}`}
                              />
                            </TD>
                            <TD className="font-medium">{t.title}</TD>
                            <TD>{t.subject.name}</TD>
                            <TD className="tabular-nums">{t.date}</TD>
                            <TD className="text-center tabular-nums">{t.maxMarks}</TD>
                            <TD className="text-center tabular-nums">{t._count.marks}</TD>
                          </TR>
                        ))}
                      </TBody>
                    </Table>
                  </div>
                </Card>
              )}
              {fieldErrors.testIds && (
                <p className="mt-1 text-xs text-danger">{fieldErrors.testIds}</p>
              )}
            </div>
          )}

          <div className="mt-6 flex gap-3">
            <Button onClick={handleGenerate} disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Generate Report Card
            </Button>
            <Button variant="secondary" onClick={() => setView("list")} disabled={submitting}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Report Card List */}
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
              title="Error loading report cards"
              description={error}
              action={
                <Button variant="secondary" onClick={loadReportCards}>
                  Retry
                </Button>
              }
            />
          ) : reportCards.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No report cards yet"
              description="Generate your first report card to get started."
              action={
                <Button onClick={() => { setView("generate"); loadDropdowns(); }}>
                  <Plus className="size-4" aria-hidden="true" />
                  Generate Report Card
                </Button>
              }
            />
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <TR>
                      <TH>Student ID</TH>
                      <TH>Student</TH>
                      <TH>Class</TH>
                      <TH>Term</TH>
                      <TH className="text-center">Tests Included</TH>
                      <TH>Generated By</TH>
                      <TH>Date</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {reportCards.map((rc) => (
                      <TR key={rc.id}>
                        <TD className="tabular-nums text-text/60">{rc.student.studentId ?? "—"}</TD>
                        <TD className="font-medium">{rc.student.name}</TD>
                        <TD>
                          {rc.classSection.className} — {rc.classSection.sectionName}
                        </TD>
                        <TD>{rc.term.name}</TD>
                        <TD className="text-center tabular-nums">
                          {rc.reportCardTests.length}
                        </TD>
                        <TD>{rc.generatedByTeacher.name}</TD>
                        <TD className="tabular-nums">{rc.createdAt.split("T")[0]}</TD>
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
