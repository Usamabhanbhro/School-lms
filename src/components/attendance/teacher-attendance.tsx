"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Loader2,
  Lock,
  Save,
  Unlock,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
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
  _count: { students: number };
}

interface Student {
  id: string;
  name: string;
  guardianName: string;
  classSection: { id: string; className: string; sectionName: string };
}

interface AttendanceRecord {
  id: string;
  studentId: string;
  classSectionId: string;
  date: string;
  status: "PRESENT" | "ABSENT" | "LEAVE";
  isConfirmed: boolean;
  markedByTeacherId: string;
  lastEditedByAdmin: string | null;
  student: { id: string; name: string; guardianName: string };
  classSection: { id: string; className: string; sectionName: string };
  markedByTeacher: { id: string; name: string };
}

type StatusOption = "PRESENT" | "ABSENT" | "LEAVE";

// ─── Helpers ────────────────────────────────────────────────────────

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const STATUS_OPTIONS: { value: StatusOption; label: string; color: string }[] = [
  { value: "PRESENT", label: "P", color: "border-success/30 bg-success/10 text-success" },
  { value: "ABSENT", label: "A", color: "border-danger/30 bg-danger/10 text-danger" },
  { value: "LEAVE", label: "L", color: "border-primary/30 bg-primary/10 text-primary" },
];

// ─── Component ──────────────────────────────────────────────────────

export function TeacherAttendance() {
  const [classes, setClasses] = useState<ClassSection[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [date, setDate] = useState(todayStr());
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);

  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const { toasts, addToast, dismissToast } = useToast();

  // Local attendance state: studentId → status
  const [localStatus, setLocalStatus] = useState<Record<string, StatusOption>>({});
  const [isLocked, setIsLocked] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(false);

  // ─── Load class sections ────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/class-sections");
        if (!res.ok) throw new Error("Failed to load classes");
        const json = await res.json();
        setClasses(json.data ?? []);
      } catch {
        setError("Failed to load class sections.");
      } finally {
        setLoadingClasses(false);
      }
    })();
  }, []);

  // ─── Load students when class changes ──────────────────────────

  useEffect(() => {
    if (!selectedClassId) {
      setStudents([]);
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

  // ─── Load attendance records when class + date change ──────────

  const loadRecords = useCallback(async () => {
    if (!selectedClassId || !date) {
      setRecords([]);
      setLocalStatus({});
      setIsLocked(false);
      return;
    }
    setLoadingRecords(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/attendance?classSectionId=${selectedClassId}&date=${date}`,
      );
      if (!res.ok) throw new Error("Failed to load attendance");
      const json = await res.json();
      const recs: AttendanceRecord[] = json.data ?? [];
      setRecords(recs);

      // Build local status map from existing records
      const statusMap: Record<string, StatusOption> = {};
      let anyLocked = false;
      for (const r of recs) {
        statusMap[r.studentId] = r.status;
        if (r.isConfirmed) anyLocked = true;
      }
      setLocalStatus(statusMap);
      setIsLocked(anyLocked);
    } catch {
      setError("Failed to load attendance records.");
    } finally {
      setLoadingRecords(false);
    }
  }, [selectedClassId, date]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  // ─── Status cycling ────────────────────────────────────────────

  const cycleStatus = useCallback(
    (studentId: string) => {
      if (isLocked) return;
      setLocalStatus((prev) => {
        const current = prev[studentId] ?? "PRESENT";
        const next: StatusOption =
          current === "PRESENT" ? "ABSENT" : current === "ABSENT" ? "LEAVE" : "PRESENT";
        return { ...prev, [studentId]: next };
      });
    },
    [isLocked],
  );

  const setStatus = useCallback(
    (studentId: string, status: StatusOption) => {
      if (isLocked) return;
      setLocalStatus((prev) => ({ ...prev, [studentId]: status }));
    },
    [isLocked],
  );

  // ─── Save Draft ────────────────────────────────────────────────

  const handleSaveDraft = useCallback(async () => {
    if (!selectedClassId || !date) return;
    setSaving(true);

    const recordsPayload = students.map((s) => ({
      studentId: s.id,
      status: localStatus[s.id] ?? "PRESENT",
    }));

    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classSectionId: selectedClassId,
          date,
          records: recordsPayload,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        addToast("error", json.error?.message ?? "Failed to save attendance.");
        setSaving(false);
        return;
      }

      addToast("success", "Attendance saved as draft.");
      await loadRecords();
    } catch {
      addToast("error", "Network error. Please try again.");
      setSaving(false);
    }
  }, [selectedClassId, date, students, localStatus, addToast, loadRecords]);

  // ─── Confirm & Lock ────────────────────────────────────────────

  const handleConfirm = useCallback(async () => {
    if (!selectedClassId || !date) return;
    setConfirming(true);

    try {
      const res = await fetch(
        `/api/attendance/confirm?classSectionId=${selectedClassId}&date=${date}`,
        { method: "POST" },
      );

      if (!res.ok) {
        const json = await res.json();
        addToast("error", json.error?.message ?? "Failed to lock attendance.");
        setConfirming(false);
        setConfirmDialog(false);
        return;
      }

      addToast("success", "Attendance locked. Sheet is now read-only.");
      setConfirmDialog(false);
      await loadRecords();
    } catch {
      addToast("error", "Network error. Please try again.");
      setConfirming(false);
      setConfirmDialog(false);
    }
  }, [selectedClassId, date, addToast, loadRecords]);

  // ─── CSV Export ────────────────────────────────────────────────

  const handleExport = useCallback(() => {
    if (!selectedClassId || !date) return;
    const url = `/api/attendance/export?classSectionId=${selectedClassId}&date=${date}`;
    window.open(url, "_blank");
  }, [selectedClassId, date]);

  // ─── Derived ──────────────────────────────────────────────────

  const selectedClass = classes.find((c) => c.id === selectedClassId);
  const hasChanges = useMemo(() => {
    const existingMap: Record<string, string> = {};
    for (const r of records) existingMap[r.studentId] = r.status;
    for (const s of students) {
      if ((localStatus[s.id] ?? "PRESENT") !== (existingMap[s.id] ?? "")) return true;
    }
    // Also check if there are students with no existing record but a local status
    for (const s of students) {
      if (!existingMap[s.id] && localStatus[s.id]) return true;
    }
    return false;
  }, [students, records, localStatus]);

  // ─── Render ────────────────────────────────────────────────────

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <PageHeader
        title="Student Attendance"
        description="Mark attendance for your assigned classes."
      />

      {/* Selection bar */}
      <Card className="mb-6 p-4">
        <div className="flex flex-wrap items-end gap-4">
          {/* Class Section */}
          <div className="min-w-[200px]">
            <label htmlFor="class-select" className="mb-1 block text-xs font-medium text-text/60">
              Class Section
            </label>
            {loadingClasses ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <select
                id="class-select"
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="h-10 w-full border border-border bg-bg px-4 text-sm text-text"
              >
                <option value="">Select a class…</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.className} — {c.sectionName} ({c._count.students} students)
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Date */}
          <div>
            <label htmlFor="date-input" className="mb-1 block text-xs font-medium text-text/60">
              Date
            </label>
            <input
              id="date-input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-10 border border-border bg-bg px-4 text-sm text-text"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            {isLocked && (
              <span className="inline-flex h-10 items-center gap-1 border border-success/30 bg-success/10 px-3 text-xs font-semibold text-success">
                <Lock className="size-3" aria-hidden="true" />
                Locked
              </span>
            )}
            <Button
              onClick={handleSaveDraft}
              disabled={saving || isLocked || !selectedClassId || loadingRecords || students.length === 0}
              variant="secondary"
            >
              {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Save Draft
            </Button>
            <Button
              onClick={() => setConfirmDialog(true)}
              disabled={
                confirming ||
                isLocked ||
                !selectedClassId ||
                loadingRecords ||
                students.length === 0
              }
            >
              {confirming && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Confirm & Lock
            </Button>
            <Button
              variant="ghost"
              onClick={handleExport}
              disabled={!selectedClassId || !date || loadingRecords}
            >
              <Download className="size-4" aria-hidden="true" />
              Export CSV
            </Button>
          </div>
        </div>
      </Card>

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-center gap-2 border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          {error}
          <Button variant="ghost" onClick={loadRecords} className="ml-auto h-8 px-2 text-xs">
            Retry
          </Button>
        </div>
      )}

      {/* Roster */}
      {!selectedClassId ? (
        <EmptyState
          icon={Unlock}
          title="Select a class section"
          description="Choose a class and date to begin marking attendance."
        />
      ) : loadingStudents || loadingRecords ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : students.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="No students in this class"
          description="There are no students enrolled in the selected class section."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH className="w-8">#</TH>
                  <TH>Student Name</TH>
                  <TH>Guardian</TH>
                  <TH className="text-center">Status</TH>
                </TR>
              </THead>
              <TBody>
                {students.map((s, i) => {
                  const status = localStatus[s.id] ?? "PRESENT";
                  return (
                    <TR key={s.id}>
                      <TD className="tabular-nums text-text/50">{i + 1}</TD>
                      <TD className="font-medium">{s.name}</TD>
                      <TD className="text-text/60">{s.guardianName}</TD>
                      <TD>
                        <div className="flex justify-center gap-1">
                          {STATUS_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setStatus(s.id, opt.value)}
                              disabled={isLocked}
                              className={cn(
                                "inline-flex h-8 w-8 items-center justify-center border text-xs font-bold",
                                status === opt.value
                                  ? opt.color
                                  : "border-border bg-bg text-text/30",
                                isLocked
                                  ? "cursor-default opacity-60"
                                  : "cursor-pointer hover:border-text/20",
                              )}
                              aria-label={`${s.name}: ${opt.value}`}
                              title={opt.value}
                            >
                              {opt.label}
                            </button>
                          ))}
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

      {/* Confirm Dialog */}
      {confirmDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setConfirmDialog(false)}
          onKeyDown={(e) => e.key === "Escape" && setConfirmDialog(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-lock-title"
        >
          <Card
            className="mx-4 w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center border border-danger/20 bg-danger/10">
                <Lock className="size-5 text-danger" aria-hidden="true" />
              </div>
              <div>
                <h3 id="confirm-lock-title" className="text-base font-semibold">
                  Confirm &amp; Lock Attendance
                </h3>
                <p className="text-sm text-text/60">This action cannot be undone.</p>
              </div>
            </div>
            <p className="mb-6 text-sm text-text/70">
              You are about to lock attendance for{" "}
              <strong>
                {selectedClass?.className} — {selectedClass?.sectionName}
              </strong>{" "}
              on <strong>{date}</strong>. Once confirmed, this attendance sheet
              becomes read-only. Only an Administrator can override locked records.
            </p>
            <div className="flex gap-3">
              <Button onClick={handleConfirm} disabled={confirming}>
                {confirming && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                Confirm &amp; Lock
              </Button>
              <Button
                variant="secondary"
                onClick={() => setConfirmDialog(false)}
                disabled={confirming}
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
