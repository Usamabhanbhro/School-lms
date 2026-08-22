"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Loader2,
  Lock,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
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

interface Assignment {
  classSectionId: string;
  subjectId: string;
  classSection: ClassSection;
  subject: Subject;
}

interface AgendaEntry {
  id: string;
  content: string;
  date: string;
  isLocked: boolean;
  teacher: { id: string; name: string };
  classSection: ClassSection;
  subject: Subject;
  createdAt: string;
  updatedAt: string;
}

// ─── Helpers ────────────────────────────────────────────────────────

function todayStr(): string {
  const d = new Date();
  // Use UTC+5 (Asia/Karachi) to match server-side timezone logic
  const pktTime = new Date(d.getTime() + 5 * 60 * 60 * 1000);
  const year = pktTime.getUTCFullYear();
  const month = String(pktTime.getUTCMonth() + 1).padStart(2, "0");
  const day = String(pktTime.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isDateLocked(dateStr: string): boolean {
  return dateStr < todayStr();
}

// ─── Component ──────────────────────────────────────────────────────

export function TeacherAgenda() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [content, setContent] = useState("");
  const [existingEntry, setExistingEntry] = useState<AgendaEntry | null>(null);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [loadingEntry, setLoadingEntry] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { toasts, addToast, dismissToast } = useToast();

  const locked = isDateLocked(selectedDate);

  // Unique class sections from assignments
  const classSections = useMemo(() => {
    const seen = new Set<string>();
    return assignments
      .filter((a) => {
        if (seen.has(a.classSectionId)) return false;
        seen.add(a.classSectionId);
        return true;
      })
      .map((a) => a.classSection);
  }, [assignments]);

  // Subjects for the selected class
  const subjects = useMemo(() => {
    if (!selectedClassId) return [];
    return assignments
      .filter((a) => a.classSectionId === selectedClassId)
      .map((a) => a.subject);
  }, [assignments, selectedClassId]);

  // ─── Load assignments ──────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        // Load class sections (scoped to teacher) and subjects
        const [classRes, subjectRes] = await Promise.all([
          fetch("/api/class-sections"),
          fetch("/api/subjects"),
        ]);

        if (!classRes.ok || !subjectRes.ok) {
          throw new Error("Failed to load data");
        }

        const classJson = await classRes.json();
        const subjectJson = await subjectRes.json();

        const classes: ClassSection[] = classJson.data ?? [];
        const subjects: Subject[] = subjectJson.data ?? [];

        // Build assignments from the teacher's scoped classes × subjects
        // The teacher only sees classes/subjects they're assigned to
        const assignmentsList: Assignment[] = [];
        for (const cls of classes) {
          for (const sub of subjects) {
            // Check if this teacher has an assignment for this class+subject
            // by attempting to load an agenda entry — or we can use the class-sections endpoint
            // Actually, let's check via the subjectTeacherAssignments
            // The simplest approach: the class-sections endpoint already filters for the teacher
            // So we just need to pair them
          }
        }

        // Better approach: load assignments via the class-sections data
        // Since the API scopes classes for teachers, we pair all their classes with all their subjects
        // But we need the actual assignments. Let me use a different approach:
        // Fetch the teacher's assignments via the API that the tests page uses
        const allClasses = classes;
        const allSubjects = subjects;

        // For each class, check which subjects the teacher is assigned to
        // We can infer this from the agenda entries already, but let's be more direct
        // The class-sections API returns classes the teacher is assigned to
        // We need to know which subjects per class

        // Since there's no direct "my assignments" endpoint, we build from the data we have
        // The teacher's SubjectTeacherAssignments are what we need
        // Let me load agenda entries to discover the assignments, or load directly
        // Actually, let me just fetch all combinations and let the POST endpoint validate
        // The simplest approach: show all teacher's classes and all subjects,
        // and let the server reject invalid combinations

        for (const cls of allClasses) {
          for (const sub of allSubjects) {
            assignmentsList.push({
              classSectionId: cls.id,
              subjectId: sub.id,
              classSection: cls,
              subject: sub,
            });
          }
        }

        setAssignments(assignmentsList);

        // Auto-select first class if available
        if (allClasses.length > 0) {
          setSelectedClassId(allClasses[0].id);
        }
        if (allSubjects.length > 0) {
          setSelectedSubjectId(allSubjects[0].id);
        }
      } catch {
        setError("Failed to load class and subject data.");
      } finally {
        setLoadingAssignments(false);
      }
    })();
  }, []);

  // ─── Load existing entry for the selected class+subject+date ──

  const loadEntry = useCallback(async () => {
    if (!selectedClassId || !selectedSubjectId || !selectedDate) {
      setExistingEntry(null);
      setContent("");
      return;
    }

    setLoadingEntry(true);
    try {
      const params = new URLSearchParams({
        classSectionId: selectedClassId,
        subjectId: selectedSubjectId,
        date: selectedDate,
      });
      const res = await fetch(`/api/agenda?${params}`);
      if (!res.ok) throw new Error("Failed to load entry");
      const json = await res.json();
      const entries: AgendaEntry[] = json.data ?? [];

      if (entries.length > 0) {
        setExistingEntry(entries[0]);
        setContent(entries[0].content);
      } else {
        setExistingEntry(null);
        setContent("");
      }
    } catch {
      setError("Failed to load agenda entry.");
    } finally {
      setLoadingEntry(false);
    }
  }, [selectedClassId, selectedSubjectId, selectedDate]);

  useEffect(() => {
    loadEntry();
  }, [loadEntry]);

  // ─── Save ───────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!selectedClassId || !selectedSubjectId || !selectedDate) return;

    if (!content.trim()) {
      addToast("error", "Content cannot be empty.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/agenda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classSectionId: selectedClassId,
          subjectId: selectedSubjectId,
          date: selectedDate,
          content: content.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        addToast("error", json.error?.message ?? "Failed to save agenda entry.");
        setSaving(false);
        return;
      }

      setExistingEntry(json.data);
      addToast("success", "Agenda entry saved.");
    } catch {
      addToast("error", "Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [selectedClassId, selectedSubjectId, selectedDate, content, addToast]);

  // ─── Derived ──────────────────────────────────────────────────

  const selectedClass = classSections.find((c) => c.id === selectedClassId);
  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId);
  const hasAssignment = assignments.some(
    (a) => a.classSectionId === selectedClassId && a.subjectId === selectedSubjectId,
  );

  // ─── Render ────────────────────────────────────────────────────

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <PageHeader
        title="Daily Agenda"
        description="Write lesson logs for your assigned classes and subjects."
      />

      {/* Selection bar */}
      <Card className="mb-6 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[200px]">
            <label
              htmlFor="agenda-class"
              className="mb-1 block text-xs font-medium text-text/60"
            >
              Class Section
            </label>
            {loadingAssignments ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <select
                id="agenda-class"
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="h-10 w-full border border-border bg-bg px-4 text-sm text-text"
              >
                <option value="">Select class…</option>
                {classSections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.className} — {c.sectionName}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="min-w-[180px]">
            <label
              htmlFor="agenda-subject"
              className="mb-1 block text-xs font-medium text-text/60"
            >
              Subject
            </label>
            {loadingAssignments ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <select
                id="agenda-subject"
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
            )}
          </div>

          <div>
            <label
              htmlFor="agenda-date"
              className="mb-1 block text-xs font-medium text-text/60"
            >
              Date
            </label>
            <input
              id="agenda-date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-10 border border-border bg-bg px-4 text-sm text-text"
            />
          </div>

          {locked && (
            <span className="inline-flex h-10 items-center gap-1 border border-success/30 bg-success/10 px-3 text-xs font-semibold text-success">
              <Lock className="size-3" aria-hidden="true" />
              Locked — past date
            </span>
          )}
        </div>
      </Card>

      {/* Error */}
      {error && (
        <div
          className="mb-4 flex items-center gap-2 border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
          role="alert"
        >
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          {error}
          <Button
            variant="ghost"
            onClick={() => {
              setError(null);
              loadEntry();
            }}
            className="ml-auto h-8 px-2 text-xs"
          >
            Retry
          </Button>
        </div>
      )}

      {/* No assignment warning */}
      {selectedClassId && selectedSubjectId && !hasAssignment && !loadingAssignments && (
        <div className="mb-4 flex items-center gap-2 border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          You are not assigned as a subject teacher for this class and subject combination.
        </div>
      )}

      {/* Content editor */}
      {loadingEntry ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">
                {selectedClass && selectedSubject
                  ? `${selectedClass.className} — ${selectedClass.sectionName} · ${selectedSubject.name}`
                  : "Select a class and subject"}
              </h2>
              <p className="text-sm text-text/60">
                {locked
                  ? "This entry is read-only — the date has passed."
                  : existingEntry
                    ? "Editing existing entry."
                    : "New entry for this date."}
              </p>
            </div>
            {existingEntry && (
              <span className="text-xs text-text/40">
                Last updated:{" "}
                {new Date(existingEntry.updatedAt).toLocaleDateString()}
              </span>
            )}
          </div>

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={
              locked
                ? "This date has passed — entry is read-only."
                : "Describe what was covered in today's lesson…"
            }
            disabled={locked || !selectedClassId || !selectedSubjectId}
            rows={12}
            maxLength={5000}
            className={cn(
              "w-full resize-y border border-border bg-bg px-4 py-3 text-sm text-text placeholder:text-text/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
              locked && "cursor-not-allowed bg-surface opacity-70",
            )}
          />

          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-text/40 tabular-nums">
              {content.length}/5000
            </span>

            {!locked && selectedClassId && selectedSubjectId && hasAssignment && (
              <Button onClick={handleSave} disabled={saving}>
                {saving && (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                )}
                <Save className="size-4" aria-hidden="true" />
                Save Entry
              </Button>
            )}
          </div>

          {/* Metadata for existing entries */}
          {existingEntry && (
            <div className="mt-4 border-t border-border pt-4">
              <div className="flex items-center gap-4 text-xs text-text/50">
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-3" aria-hidden="true" />
                  {existingEntry.date}
                </span>
                <span>
                  Created: {new Date(existingEntry.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
