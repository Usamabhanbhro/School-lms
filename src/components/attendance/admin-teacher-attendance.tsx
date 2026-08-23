"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  LogOut,
  Minus,
  X,
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

interface Teacher {
  id: string;
  name: string;
  cnic: string;
  phone: string;
  email: string | null;
  userId: string;
  reportingTime: string | null;
  offTime: string | null;
  lateThreshold: string | null;
  user: { isActive: boolean };
}

interface TeacherAttendanceRecord {
  id: string;
  teacherId: string;
  date: string;
  status: "PRESENT" | "ABSENT" | "LEAVE" | "LATE";
  actualReportingTime: string | null;
  actualOffTime: string | null;
  markedById: string | null;
  teacher: {
    id: string;
    name: string;
    phone: string;
    reportingTime: string | null;
    offTime: string | null;
    lateThreshold: string | null;
  };
}

type StatusOption = "PRESENT" | "ABSENT" | "LEAVE";

/** Inline time editor — only one open per page, opened on demand. */
interface TimeEditor {
  teacherId: string;
  kind: "reporting" | "off";
  value: string;
}

// ─── Helpers ────────────────────────────────────────────────────────

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Current local time as HH:MM — default value for the time editors. */
function nowTimeStr(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const STATUS_OPTIONS: {
  value: StatusOption;
  label: string;
  icon: typeof CheckCircle2;
  color: string;
}[] = [
  { value: "PRESENT", label: "Present", icon: CheckCircle2, color: "border-success/30 bg-success/10 text-success" },
  { value: "ABSENT", label: "Absent", icon: XCircle, color: "border-danger/30 bg-danger/10 text-danger" },
  { value: "LEAVE", label: "Leave", icon: Minus, color: "border-primary/30 bg-primary/10 text-primary" },
];

function formatTime(time: string | null): string {
  if (!time) return "—";
  const parts = time.split(":");
  if (parts.length >= 2) {
    const h = parseInt(parts[0], 10);
    const m = parts[1];
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  }
  return time;
}

// ─── Component ──────────────────────────────────────────────────────

export function AdminTeacherAttendance() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [date, setDate] = useState(todayStr());
  const [records, setRecords] = useState<TeacherAttendanceRecord[]>([]);

  const [loadingTeachers, setLoadingTeachers] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [saving, setSaving] = useState<string | null>(null); // teacher id being saved
  const [error, setError] = useState<string | null>(null);

  // Inline time editor (reporting or off) — shown only when open
  const [timeEditor, setTimeEditor] = useState<TimeEditor | null>(null);

  // Monthly summary toggle
  const [showMonthly, setShowMonthly] = useState(false);
  const [monthlyFrom, setMonthlyFrom] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [monthlyTo, setMonthlyTo] = useState(todayStr());
  const [monthlyRecords, setMonthlyRecords] = useState<TeacherAttendanceRecord[]>([]);
  const [loadingMonthly, setLoadingMonthly] = useState(false);

  const { toasts, addToast, dismissToast } = useToast();

  // ─── Load teachers ──────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/teachers");
        if (!res.ok) throw new Error("Failed to load teachers");
        const json = await res.json();
        setTeachers((json.data ?? []).filter((t: Teacher) => t.user.isActive));
      } catch {
        setError("Failed to load teachers.");
      } finally {
        setLoadingTeachers(false);
      }
    })();
  }, []);

  // ─── Load teacher attendance records ──────────────────────────

  const loadRecords = useCallback(async () => {
    if (!date) {
      setRecords([]);
      return;
    }
    setLoadingRecords(true);
    setError(null);
    try {
      const res = await fetch(`/api/teacher-attendance?from=${date}&to=${date}`);
      if (!res.ok) throw new Error("Failed to load teacher attendance");
      const json = await res.json();
      setRecords(json.data ?? []);
    } catch {
      setError("Failed to load teacher attendance records.");
    } finally {
      setLoadingRecords(false);
    }
  }, [date]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  // ─── Load monthly records ──────────────────────────────────

  const loadMonthly = useCallback(async () => {
    setLoadingMonthly(true);
    try {
      const res = await fetch(
        `/api/teacher-attendance?from=${monthlyFrom}&to=${monthlyTo}`,
      );
      if (!res.ok) throw new Error("Failed to load monthly attendance");
      const json = await res.json();
      setMonthlyRecords(json.data ?? []);
    } catch {
      addToast("error", "Failed to load monthly data.");
    } finally {
      setLoadingMonthly(false);
    }
  }, [monthlyFrom, monthlyTo, addToast]);

  // ─── Monthly totals (computed, not stored) ─────────────────

  const monthlyTotals = useMemo(() => {
    const totals: Record<string, { present: number; absent: number; leave: number; late: number }> = {};
    for (const r of monthlyRecords) {
      if (!totals[r.teacherId]) {
        totals[r.teacherId] = { present: 0, absent: 0, leave: 0, late: 0 };
      }
      switch (r.status) {
        case "PRESENT": totals[r.teacherId].present++; break;
        case "ABSENT": totals[r.teacherId].absent++; break;
        case "LEAVE": totals[r.teacherId].leave++; break;
        case "LATE": totals[r.teacherId].late++; break;
      }
    }
    return totals;
  }, [monthlyRecords]);

  // ─── Save attendance ────────────────────────────────────────

  /**
   * Single save path used by both steps:
   *  - Absent/Leave buttons save immediately with no times.
   *  - Present saves with the time-editor reporting value.
   *  - Off-time editor re-POSTs with actualOffTime set (status re-derived server-side).
   */
  const handleSave = useCallback(
    async (teacherId: string, status: StatusOption, times?: { reporting?: string; off?: string }) => {
      const previousRecords = records;

      // Optimistic update
      setRecords((prev) => {
        const existing = prev.find((r) => r.teacherId === teacherId);
        const updatedRecord = {
          id: existing?.id ?? `optimistic-${teacherId}`,
          teacherId,
          date,
          status: status as "PRESENT" | "ABSENT" | "LEAVE" | "LATE",
          actualReportingTime: times?.reporting ?? existing?.actualReportingTime ?? null,
          actualOffTime: times?.off ?? existing?.actualOffTime ?? null,
          markedById: null,
          teacher: existing?.teacher ?? { id: teacherId, name: "", phone: "", reportingTime: null, offTime: null, lateThreshold: null },
        };
        if (existing) {
          return prev.map((r) => (r.teacherId === teacherId ? updatedRecord : r));
        }
        return [...prev, updatedRecord];
      });
      setSaving(teacherId);

      try {
        const body: Record<string, string> = { teacherId, date, status };
        if (times?.reporting) body.actualReportingTime = times.reporting;
        if (times?.off) body.actualOffTime = times.off;

        const res = await fetch("/api/teacher-attendance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const json = await res.json();
          setRecords(previousRecords);
          addToast("error", json.error?.message ?? "Failed to save attendance.");
          setSaving(null);
          setTimeEditor(null);
          return;
        }

        const result = await res.json();
        const savedRecord = result.data as TeacherAttendanceRecord;

        if (status === "PRESENT" && savedRecord.status === "LATE") {
          addToast("success", `Marked Late — reported at ${formatTime(times?.reporting ?? null)}, threshold is ${formatTime(savedRecord.teacher.lateThreshold)}`);
        } else if (times?.off) {
          addToast("success", `Off time logged at ${formatTime(times.off)}.`);
        } else {
          addToast("success", "Attendance saved.");
        }

        await loadRecords();
        setSaving(null);
        setTimeEditor(null);
      } catch {
        setRecords(previousRecords);
        addToast("error", "Network error. Please try again.");
        setSaving(null);
        setTimeEditor(null);
      }
    },
    [date, records, addToast, loadRecords],
  );

  // ─── Build lookup ───────────────────────────────────────────

  const recordMap = new Map(records.map((r) => [r.teacherId, r]));

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <PageHeader
        title="Teacher Attendance"
        description="Mark teacher attendance directly — no draft or lock. Mark Present to log a reporting time; a 'Log Off Time' action appears once reported. Status is auto-derived from actual time vs. configured threshold."
        actions={
          <Button
            variant="secondary"
            onClick={() => {
              const params = new URLSearchParams();
              if (date) {
                params.set("from", date);
                params.set("to", date);
              }
              window.open(`/api/teacher-attendance/export?${params.toString()}`, "_blank");
            }}
          >
            <Download className="size-4" aria-hidden="true" />
            Export CSV
          </Button>
        }
      />

      {/* Date selection + monthly toggle */}
      <Card className="mb-6 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="teacher-att-date" className="mb-1 block text-xs font-medium text-text/60">
              Date
            </label>
            <input
              id="teacher-att-date"
              type="date"
              value={date}
              max={todayStr()}
              onChange={(e) => setDate(e.target.value)}
              className="h-10 border border-border bg-bg px-4 text-sm text-text"
            />
          </div>
          <div>
            <Button variant="secondary" onClick={() => setShowMonthly(!showMonthly)}>
              <CalendarDays className="size-4" aria-hidden="true" />
              {showMonthly ? "Hide" : "Show"} Monthly Totals
            </Button>
          </div>
        </div>
      </Card>

      {/* Monthly totals panel */}
      {showMonthly && (
        <Card className="mb-6 p-4">
          <div className="mb-3 flex flex-wrap items-end gap-4">
            <h3 className="text-sm font-semibold">Monthly Attendance Summary</h3>
            <div>
              <label htmlFor="monthly-from" className="mb-1 block text-xs font-medium text-text/60">From</label>
              <input
                id="monthly-from"
                type="date"
                value={monthlyFrom}
                onChange={(e) => setMonthlyFrom(e.target.value)}
                className="h-9 border border-border bg-bg px-4 text-sm text-text"
              />
            </div>
            <div>
              <label htmlFor="monthly-to" className="mb-1 block text-xs font-medium text-text/60">To</label>
              <input
                id="monthly-to"
                type="date"
                value={monthlyTo}
                max={todayStr()}
                onChange={(e) => setMonthlyTo(e.target.value)}
                className="h-9 border border-border bg-bg px-4 text-sm text-text"
              />
            </div>
            <Button variant="secondary" onClick={loadMonthly} disabled={loadingMonthly}>
              {loadingMonthly ? <Loader2 className="size-4 animate-spin" /> : "Load"}
            </Button>
          </div>

          {monthlyRecords.length > 0 ? (
            <Table>
              <THead>
                <TR>
                  <TH>Teacher</TH>
                  <TH className="text-center">Present</TH>
                  <TH className="text-center">Late</TH>
                  <TH className="text-center">Absent</TH>
                  <TH className="text-center">Leave</TH>
                  <TH className="text-center">Total Days</TH>
                </TR>
              </THead>
              <TBody>
                {teachers
                  .filter((t) => monthlyTotals[t.id])
                  .map((t) => {
                    const totals = monthlyTotals[t.id];
                    return (
                      <TR key={t.id}>
                        <TD className="font-medium">{t.name}</TD>
                        <TD className="text-center tabular-nums text-success">{totals.present}</TD>
                        <TD className="text-center tabular-nums text-orange-600">{totals.late}</TD>
                        <TD className="text-center tabular-nums text-danger">{totals.absent}</TD>
                        <TD className="text-center tabular-nums text-primary">{totals.leave}</TD>
                        <TD className="text-center tabular-nums">{totals.present + totals.late + totals.absent + totals.leave}</TD>
                      </TR>
                    );
                  })}
              </TBody>
            </Table>
          ) : (
            <p className="text-sm text-text/50">Select a date range and click Load to see monthly totals.</p>
          )}
        </Card>
      )}

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

      {/* Teacher Roster */}
      {loadingTeachers ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : teachers.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="No teachers found"
          description="No active teacher accounts exist."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH className="w-8">#</TH>
                  <TH>Teacher Name</TH>
                  <TH>Phone</TH>
                  <TH>Threshold</TH>
                  <TH>Actual Time</TH>
                  <TH className="text-center">Attendance</TH>
                </TR>
              </THead>
              <TBody>
                {teachers.map((t, i) => {
                  const record = recordMap.get(t.id);
                  const currentStatus = record?.status ?? null;
                  const teacherThreshold = record?.teacher?.lateThreshold ?? t.lateThreshold;
                  const isLiveOrLate = currentStatus === "PRESENT" || currentStatus === "LATE";
                  const isAbsentOrLeave = currentStatus === "ABSENT" || currentStatus === "LEAVE";
                  const hasReporting = isLiveOrLate && !!record?.actualReportingTime;
                  const hasOff = isLiveOrLate && !!record?.actualOffTime;
                  const editor = timeEditor?.teacherId === t.id ? timeEditor : null;
                  const savingThis = saving === t.id;

                  return (
                    <TR key={t.id}>
                      <TD className="tabular-nums text-text/50">{i + 1}</TD>
                      <TD className="font-medium">
                        {t.name}
                        {currentStatus === "LATE" && (
                          <span className="ml-2 inline-flex items-center gap-1 border border-orange-300 bg-orange-50 px-1.5 py-0.5 text-[10px] font-medium text-orange-700">
                            <Clock className="size-3" aria-hidden="true" />
                            Late
                          </span>
                        )}
                      </TD>
                      <TD className="tabular-nums text-text/60">{t.phone}</TD>
                      <TD className="tabular-nums text-text/50">{formatTime(teacherThreshold)}</TD>
                      <TD>
                        {hasReporting ? (
                          <span className={cn("text-xs", currentStatus === "LATE" ? "text-orange-600" : "text-text/50")}>
                            Reported {formatTime(record?.actualReportingTime)}
                            {hasOff && ` · Off ${formatTime(record?.actualOffTime)}`}
                          </span>
                        ) : isAbsentOrLeave ? (
                          <span className="text-xs text-text/30">—</span>
                        ) : (
                          <span className="text-xs text-text/30">Not logged yet</span>
                        )}
                      </TD>
                      <TD>
                        <div className="flex flex-col items-center gap-1.5">
                          {/* Step 0: status buttons */}
                          <div className="flex justify-center gap-1">
                            {STATUS_OPTIONS.map((opt) => {
                              const StatusIcon = opt.icon;
                              const isCurrent =
                                currentStatus === opt.value ||
                                (opt.value === "PRESENT" && currentStatus === "LATE");
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => {
                                    // Present opens the reporting-time editor; Absent/Leave save immediately
                                    if (opt.value === "PRESENT") {
                                      setTimeEditor({ teacherId: t.id, kind: "reporting", value: nowTimeStr() });
                                    } else {
                                      setTimeEditor(null);
                                      handleSave(t.id, opt.value);
                                    }
                                  }}
                                  disabled={savingThis}
                                  className={cn(
                                    "inline-flex h-8 w-8 items-center justify-center border",
                                    isCurrent ? opt.color : "border-border bg-bg text-text/30",
                                    "cursor-pointer hover:border-text/20",
                                    savingThis && "opacity-50",
                                  )}
                                  aria-label={`${t.name}: ${opt.label}`}
                                  title={`Mark ${opt.label}`}
                                >
                                  {savingThis ? (
                                    <Loader2 className="size-3 animate-spin" />
                                  ) : (
                                    <StatusIcon className="size-4" aria-hidden="true" />
                                  )}
                                </button>
                              );
                            })}
                          </div>

                          {/* Step 1: reporting-time editor (opened via Present) */}
                          {editor?.kind === "reporting" && isLiveOrLate && (
                            <div className="flex items-center gap-1">
                              <input
                                type="time"
                                value={editor.value}
                                onChange={(e) =>
                                  setTimeEditor((prev) =>
                                    prev && prev.teacherId === t.id && prev.kind === "reporting"
                                      ? { ...prev, value: e.target.value }
                                      : prev,
                                  )
                                }
                                className="h-7 w-20 border border-border bg-bg px-1 text-[11px] text-text"
                                aria-label="Reporting time"
                              />
                              <button
                                type="button"
                                onClick={() => handleSave(t.id, "PRESENT", { reporting: editor.value || undefined })}
                                disabled={savingThis}
                                className="inline-flex size-6 items-center justify-center border border-success/40 bg-success/10 text-success hover:bg-success/20"
                                aria-label="Save reporting time"
                                title="Save reporting time"
                              >
                                {savingThis ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3.5" aria-hidden="true" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => setTimeEditor(null)}
                                className="inline-flex size-6 items-center justify-center border border-border bg-bg text-text/40 hover:text-text"
                                aria-label="Cancel"
                                title="Cancel"
                              >
                                <X className="size-3.5" aria-hidden="true" />
                              </button>
                            </div>
                          )}

                          {/* Step 2: off-time editor */}
                          {editor?.kind === "off" && (
                            <div className="flex items-center gap-1">
                              <input
                                type="time"
                                value={editor.value}
                                onChange={(e) =>
                                  setTimeEditor((prev) =>
                                    prev && prev.teacherId === t.id && prev.kind === "off"
                                      ? { ...prev, value: e.target.value }
                                      : prev,
                                  )
                                }
                                className="h-7 w-20 border border-border bg-bg px-1 text-[11px] text-text"
                                aria-label="Off time"
                              />
                              <button
                                type="button"
                                onClick={() => handleSave(t.id, "PRESENT", { reporting: record?.actualReportingTime ?? undefined, off: editor.value })}
                                disabled={savingThis}
                                className="inline-flex size-6 items-center justify-center border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                                aria-label="Save off time"
                                title="Save off time"
                              >
                                {savingThis ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3.5" aria-hidden="true" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => setTimeEditor(null)}
                                className="inline-flex size-6 items-center justify-center border border-border bg-bg text-text/40 hover:text-text"
                                aria-label="Cancel"
                                title="Cancel"
                              >
                                <X className="size-3.5" aria-hidden="true" />
                              </button>
                            </div>
                          )}

                          {/* Step 2 trigger — only when reporting already logged, never for Absent/Leave */}
                          {!editor && isLiveOrLate && hasReporting && (
                            <button
                              type="button"
                              onClick={() => setTimeEditor({ teacherId: t.id, kind: "off", value: nowTimeStr() })}
                              className={cn(
                                "inline-flex items-center gap-1 border px-2 py-1 text-[11px] font-medium",
                                hasOff
                                  ? "border-border bg-bg text-text/50 hover:bg-surface"
                                  : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20",
                              )}
                              title="Log the teacher's off (departure) time"
                            >
                              <LogOut className="size-3" aria-hidden="true" />
                              {hasOff ? "Update Off Time" : "Log Off Time"}
                            </button>
                          )}

                          {/* Present without a time logged yet */}
                          {!editor && isLiveOrLate && !hasReporting && (
                            <button
                              type="button"
                              onClick={() => setTimeEditor({ teacherId: t.id, kind: "reporting", value: nowTimeStr() })}
                              className="inline-flex items-center gap-1 border border-border bg-bg px-2 py-1 text-[11px] font-medium text-text/50 hover:bg-surface"
                            >
                              <Clock className="size-3" aria-hidden="true" />
                              Log reporting time
                            </button>
                          )}
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
  );
}