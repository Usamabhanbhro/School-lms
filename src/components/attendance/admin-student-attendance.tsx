"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Edit3,
  Loader2,
  Lock,
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

export function AdminStudentAttendance({ readOnly = false }: { readOnly?: boolean } = {}) {
  const [classes, setClasses] = useState<ClassSection[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [date, setDate] = useState(todayStr());
  const [records, setRecords] = useState<AttendanceRecord[]>([]);

  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toasts, addToast, dismissToast } = useToast();

  // Override state
  const [overriding, setOverriding] = useState<string | null>(null); // record id being overridden

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

  // ─── Load attendance records ──────────────────────────────────

  const loadRecords = useCallback(async () => {
    if (!selectedClassId || !date) {
      setRecords([]);
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
      setRecords(json.data ?? []);
    } catch {
      setError("Failed to load attendance records.");
    } finally {
      setLoadingRecords(false);
    }
  }, [selectedClassId, date]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  // ─── Admin override ──────────────────────────────────────────

  const handleOverride = useCallback(
    async (recordId: string, newStatus: StatusOption) => {
      setOverriding(recordId);
      try {
        const res = await fetch(`/api/attendance/${recordId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });

        if (!res.ok) {
          const json = await res.json();
          addToast("error", json.error?.message ?? "Failed to override record.");
          setOverriding(null);
          return;
        }

        addToast("success", "Record overridden by Admin.");
        await loadRecords();
      } catch {
        addToast("error", "Network error. Please try again.");
        setOverriding(null);
      }
    },
    [addToast, loadRecords],
  );

  // ─── CSV Export ────────────────────────────────────────────────

  const handleExport = useCallback(() => {
    if (!selectedClassId || !date) return;
    window.open(
      `/api/attendance/export?classSectionId=${selectedClassId}&date=${date}`,
      "_blank",
    );
  }, [selectedClassId, date]);

  // ─── Derived ──────────────────────────────────────────────────

  const selectedClass = classes.find((c) => c.id === selectedClassId);
  const isLocked = records.length > 0 && records.every((r) => r.isConfirmed);

  // ─── Render ────────────────────────────────────────────────────

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <PageHeader
        title="Student Attendance"
        description={readOnly ? "View attendance for any class." : "View attendance for any class. Override locked records when needed."}
      />

      {/* Selection bar */}
      <Card className="mb-6 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[200px]">
            <label htmlFor="admin-class-select" className="mb-1 block text-xs font-medium text-text/60">
              Class Section
            </label>
            {loadingClasses ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <select
                id="admin-class-select"
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
          <div>
            <label htmlFor="admin-date-input" className="mb-1 block text-xs font-medium text-text/60">
              Date
            </label>
            <input
              id="admin-date-input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-10 border border-border bg-bg px-4 text-sm text-text"
            />
          </div>
          <div className="flex gap-2">
            {isLocked && (
              <span className="inline-flex h-10 items-center gap-1 border border-success/30 bg-success/10 px-3 text-xs font-semibold text-success">
                <Lock className="size-3" aria-hidden="true" />
                Locked
              </span>
            )}
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
          description="Choose a class and date to view attendance."
        />
      ) : loadingRecords ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : records.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="No attendance records"
          description={`No attendance has been recorded for ${selectedClass?.className} — ${selectedClass?.sectionName} on ${date}.`}
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
                  <TH>State</TH>
                  {!readOnly && <TH className="text-center">Override</TH>}
                </TR>
              </THead>
              <TBody>
                {records.map((r, i) => (
                  <TR key={r.id}>
                    <TD className="tabular-nums text-text/50">{i + 1}</TD>
                    <TD className="font-medium">{r.student.name}</TD>
                    <TD className="text-text/60">{r.student.guardianName}</TD>
                    <TD className="text-center">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 border px-2 py-0.5 text-xs font-semibold",
                          r.status === "PRESENT"
                            ? "border-success/30 bg-success/10 text-success"
                            : r.status === "ABSENT"
                              ? "border-danger/30 bg-danger/10 text-danger"
                              : "border-primary/30 bg-primary/10 text-primary",
                        )}
                      >
                        {r.status}
                      </span>
                    </TD>
                    <TD>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 border px-2 py-0.5 text-xs font-medium",
                          r.isConfirmed
                            ? "border-success/30 bg-success/10 text-success"
                            : "border-text/20 bg-text/5 text-text/50",
                        )}
                      >
                        {r.isConfirmed ? (
                          <>
                            <Lock className="size-3" aria-hidden="true" /> Locked
                          </>
                        ) : (
                          <>
                            <Unlock className="size-3" aria-hidden="true" /> Draft
                          </>
                        )}
                      </span>
                    </TD>
                    {!readOnly && (
                      <TD className="text-center">
                        <div className="flex justify-center gap-1">
                          {STATUS_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => handleOverride(r.id, opt.value)}
                              disabled={overriding === r.id}
                              className={cn(
                                "inline-flex h-7 w-7 items-center justify-center border text-xs font-bold",
                                r.status === opt.value
                                  ? opt.color
                                  : "border-border bg-bg text-text/30",
                                "cursor-pointer hover:border-text/20",
                                overriding === r.id && "opacity-50",
                              )}
                              aria-label={`Override ${r.student.name} to ${opt.value}`}
                              title={`Set ${opt.value}`}
                            >
                              {overriding === r.id ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                opt.label
                              )}
                            </button>
                          ))}
                        </div>
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
  );
}
