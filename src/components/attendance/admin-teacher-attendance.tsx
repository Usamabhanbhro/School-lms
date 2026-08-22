"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Loader2,
  Minus,
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
  user: { isActive: boolean };
}

interface TeacherAttendanceRecord {
  id: string;
  teacherId: string;
  date: string;
  status: "PRESENT" | "ABSENT" | "LEAVE";
  markedById: string | null;
  teacher: { id: string; name: string; phone: string };
}

type StatusOption = "PRESENT" | "ABSENT" | "LEAVE";

// ─── Helpers ────────────────────────────────────────────────────────

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

// ─── Component ──────────────────────────────────────────────────────

export function AdminTeacherAttendance() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [date, setDate] = useState(todayStr());
  const [records, setRecords] = useState<TeacherAttendanceRecord[]>([]);

  const [loadingTeachers, setLoadingTeachers] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [saving, setSaving] = useState<string | null>(null); // teacher id being saved
  const [error, setError] = useState<string | null>(null);
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
      const res = await fetch(
        `/api/teacher-attendance?from=${date}&to=${date}`,
      );
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

  // ─── Save attendance ──────────────────────────────────────────

  const handleSave = useCallback(
    async (teacherId: string, status: StatusOption) => {
      // Snapshot current state for rollback on failure
      const previousRecords = records;

      // Optimistically update the local record immediately
      setRecords((prev) => {
        const existing = prev.find((r) => r.teacherId === teacherId);
        if (existing) {
          return prev.map((r) =>
            r.teacherId === teacherId ? { ...r, status } : r,
          );
        }
        // No existing record — create a placeholder optimistic record
        return [
          ...prev,
          {
            id: `optimistic-${teacherId}`,
            teacherId,
            date,
            status,
            markedById: null,
            teacher: { id: teacherId, name: "", phone: "" },
          },
        ];
      });
      setSaving(teacherId);

      try {
        const res = await fetch("/api/teacher-attendance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teacherId, date, status }),
        });

        if (!res.ok) {
          const json = await res.json();
          // Rollback: restore previous records
          setRecords(previousRecords);
          addToast("error", json.error?.message ?? "Failed to save attendance.");
          setSaving(null);
          return;
        }

        addToast("success", "Attendance saved.");
        // Reconcile with server
        await loadRecords();
        setSaving(null);
      } catch {
        // Rollback: restore previous records
        setRecords(previousRecords);
        addToast("error", "Network error. Please try again.");
        setSaving(null);
      }
    },
    [date, records, addToast, loadRecords],
  );

  // ─── Build lookup ─────────────────────────────────────────────

  const recordMap = new Map(records.map((r) => [r.teacherId, r]));

  // ─── Render ────────────────────────────────────────────────────

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <PageHeader
        title="Teacher Attendance"
        description="Mark teacher attendance directly. No draft or lock — changes save immediately."
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

      {/* Date selection */}
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
                  <TH className="text-center">Attendance</TH>
                </TR>
              </THead>
              <TBody>
                {teachers.map((t, i) => {
                  const record = recordMap.get(t.id);
                  const currentStatus = record?.status ?? null;

                  return (
                    <TR key={t.id}>
                      <TD className="tabular-nums text-text/50">{i + 1}</TD>
                      <TD className="font-medium">{t.name}</TD>
                      <TD className="tabular-nums text-text/60">{t.phone}</TD>
                      <TD>
                        <div className="flex justify-center gap-1">
                          {STATUS_OPTIONS.map((opt) => {
                            const StatusIcon = opt.icon;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => handleSave(t.id, opt.value)}
                                disabled={saving === t.id}
                                className={cn(
                                  "inline-flex h-8 w-8 items-center justify-center border",
                                  currentStatus === opt.value
                                    ? opt.color
                                    : "border-border bg-bg text-text/30",
                                  "cursor-pointer hover:border-text/20",
                                  saving === t.id && "opacity-50",
                                )}
                                aria-label={`${t.name}: ${opt.label}`}
                                title={`Mark ${opt.label}`}
                              >
                              {saving === t.id ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <StatusIcon className="size-4" aria-hidden="true" />
                              )}
                            </button>
                            );
                          })}
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
