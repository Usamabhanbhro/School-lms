"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Loader2,
  Printer,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { ToastContainer, useToast } from "@/components/ui/toast";
import { cn, getApiErrorMessage } from "@/lib/utils";
import { getTodayLocal } from "@/lib/timezone";

// ─── Types ──────────────────────────────────────────────────────────

interface Teacher {
  id: string;
  name: string;
  phone: string;
  perDaySalary: number | null;
  lateDeductionType: "AMOUNT" | "PERCENTAGE" | null;
  lateDeductionValue: number | null;
  user: { isActive: boolean };
}

interface PreviewLine {
  lineId: string;
  date: string;
  type: "LATE" | "ABSENT";
  amount: number;
  waived: boolean;
}

interface Preview {
  teacher: { id: string; name: string };
  periodFrom: string;
  periodTo: string;
  perDaySalary: number;
  lateDeductionType: "AMOUNT" | "PERCENTAGE";
  lateDeductionValue: number;
  workingDays: number;
  leaveDays: number;
  baseAmount: number;
  deductions: PreviewLine[];
  totalDeductions: number;
  netAmount: number;
}

interface SavedSlip {
  id: string;
  teacherId: string;
  teacher: { id: string; name: string };
  periodFrom: string;
  periodTo: string;
  baseAmount: number;
  netAmount: number;
  issuedDate: string;
  generatedByUser: { id: string; name: string };
  deductions: { id: string; date: string; type: "LATE" | "ABSENT"; amount: number; waived: boolean }[];
}

function currentMonthRange(): { from: string; to: string } {
  const today = getTodayLocal();
  return { from: `${today.slice(0, 8)}01`, to: today };
}

function todayStr(): string {
  return getTodayLocal();
}

function formatRs(n: number): string {
  return `Rs. ${n.toLocaleString()}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-PK", { year: "numeric", month: "short", day: "numeric" });
}

// ─── Component ──────────────────────────────────────────────────────

export function SalarySlipGeneration() {
  const { toasts, addToast, dismissToast } = useToast();

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [range, setRange] = useState(currentMonthRange());

  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<SavedSlip[]>([]);

  const activeTeachers = useMemo(() => teachers.filter((t) => t.user.isActive), [teachers]);

  const filteredTeachers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activeTeachers;
    return activeTeachers.filter((t) => t.name.toLowerCase().includes(q) || t.phone.includes(q));
  }, [activeTeachers, search]);

  const selectedTeacher = teachers.find((t) => t.id === selectedTeacherId);

  // ─── Load teachers ────────────────────────────────────────────

  const loadTeachers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/teachers");
      const json = await res.json();
      if (!res.ok) throw new Error(getApiErrorMessage(json, "Unable to load teachers right now."));
      setTeachers(json.data ?? []);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to load teachers right now.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTeachers();
  }, [loadTeachers]);

  // ─── Load history for the selected teacher ────────────────────

  const loadHistory = useCallback(async (teacherId: string) => {
    try {
      const res = await fetch(`/api/salary-slips?teacherId=${teacherId}`);
      const json = await res.json();
      if (!res.ok) {
        addToast("error", getApiErrorMessage(json, "Unable to load salary slip history right now."));
        setHistory([]);
        return;
      }
      setHistory(json.data ?? []);
    } catch {
      addToast("error", "Network error while loading salary slip history. Please try again.");
      setHistory([]);
    }
  }, [addToast]);

  useEffect(() => {
    if (selectedTeacherId) {
      loadHistory(selectedTeacherId);
      setPreview(null);
      setPreviewError(null);
    } else {
      setHistory([]);
    }
  }, [selectedTeacherId, loadHistory]);

  // ─── Review (computed breakdown, nothing saved) ───────────────

  const handleReview = useCallback(async () => {
    if (!selectedTeacherId || !range.from || !range.to) return;
    setPreviewing(true);
    setPreviewError(null);
    try {
      const res = await fetch("/api/salary-slips/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId: selectedTeacherId, from: range.from, to: range.to }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPreview(null);
        setPreviewError(json.error?.message ?? "Failed to compute salary breakdown.");
        return;
      }
      setPreview(json.data);
    } catch {
      setPreviewError("Network error. Please try again.");
    } finally {
      setPreviewing(false);
    }
  }, [selectedTeacherId, range]);

  // ─── Toggle a waiver on a preview line ────────────────────────

  const toggleWaive = useCallback((lineId: string) => {
    setPreview((prev) => {
      if (!prev) return prev;
      const deductions = prev.deductions.map((d) =>
        d.lineId === lineId ? { ...d, waived: !d.waived } : d,
      );
      // Recompute totals: waived lines don't reduce the net
      const totalDeductions = deductions.reduce((s, d) => s + (d.waived ? 0 : d.amount), 0);
      return { ...prev, deductions, totalDeductions, netAmount: prev.baseAmount - totalDeductions };
    });
  }, []);

  // ─── Generate & Save ──────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!preview) return;
    setSaving(true);
    try {
      const waivedIds = preview.deductions.filter((d) => d.waived).map((d) => d.lineId);
      const res = await fetch("/api/salary-slips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: preview.teacher.id,
          from: preview.periodFrom,
          to: preview.periodTo,
          waivedIds,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        addToast("error", json.error?.message ?? "Failed to save salary slip.");
        return;
      }
      addToast("success", "Salary slip generated and saved.");
      setPreview(null);
      await loadHistory(preview.teacher.id);
      window.open(`/print/salary-slips/${json.data.id}`, "_blank");
    } catch {
      addToast("error", "Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [preview, addToast, loadHistory]);

  // ─── Render ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Error loading data"
        description={error}
        action={<Button variant="secondary" onClick={loadTeachers}>Retry</Button>}
      />
    );
  }

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Configuration panel */}
      <Card className="mb-6 p-6">
        <h2 className="mb-4 text-base font-semibold">Generate Salary Slip</h2>

        {/* Teacher search */}
        <div className="mb-4 max-w-md">
          <label htmlFor="salary-teacher-search" className="mb-1 block text-xs font-medium text-text/60">
            Teacher
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text/40" aria-hidden="true" />
            <Input
              id="salary-teacher-search"
              placeholder="Search by name or phone…"
              value={selectedTeacher ? selectedTeacher.name : search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelectedTeacherId("");
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              className="pl-9"
            />
            {selectedTeacher && (
              <button
                type="button"
                onClick={() => {
                  setSelectedTeacherId("");
                  setSearch("");
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text/40 hover:text-text"
                aria-label="Clear teacher"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>
          {searchOpen && !selectedTeacher && filteredTeachers.length > 0 && (
            <div className="mt-1 max-h-48 overflow-y-auto border border-border bg-bg">
              {filteredTeachers.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setSelectedTeacherId(t.id);
                    setSearchOpen(false);
                  }}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-surface"
                >
                  <span className="font-medium">{t.name}</span>
                  <span className="text-xs text-text/50">{t.phone}</span>
                </button>
              ))}
            </div>
          )}
          {selectedTeacher && (
            <p className="mt-2 text-xs text-text/60">
              Per-day: {selectedTeacher.perDaySalary != null ? formatRs(selectedTeacher.perDaySalary) : "not set"}
              {selectedTeacher.lateDeductionType === "AMOUNT" && selectedTeacher.lateDeductionValue != null && (
                <span className="ml-2">Late: {formatRs(selectedTeacher.lateDeductionValue)}</span>
              )}
              {selectedTeacher.lateDeductionType === "PERCENTAGE" && selectedTeacher.lateDeductionValue != null && (
                <span className="ml-2">Late: {selectedTeacher.lateDeductionValue}% of daily pay</span>
              )}
              {!selectedTeacher.perDaySalary && <span className="text-danger"> — salary rate not configured</span>}
            </p>
          )}
        </div>

        {/* Date range */}
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="salary-from" className="mb-1 block text-xs font-medium text-text/60">
              From
            </label>
            <input
              id="salary-from"
              type="date"
              value={range.from}
              max={todayStr()}
              onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
              className="h-10 border border-border bg-bg px-4 text-sm text-text"
            />
          </div>
          <div>
            <label htmlFor="salary-to" className="mb-1 block text-xs font-medium text-text/60">
              To
            </label>
            <input
              id="salary-to"
              type="date"
              value={range.to}
              max={todayStr()}
              onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
              className="h-10 border border-border bg-bg px-4 text-sm text-text"
            />
          </div>
          <Button onClick={handleReview} disabled={!selectedTeacherId || previewing}>
            {previewing ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="size-4" aria-hidden="true" />}
            {previewing ? "Reviewing…" : "Review & Compute"}
          </Button>
        </div>
      </Card>

      {/* Preview error — e.g. salary not configured */}
      {previewError && (
        <div className="mb-6 flex items-center gap-2 border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger" role="alert">
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          {previewError}
        </div>
      )}

      {/* Computed breakdown */}
      {preview && (
        <Card className="mb-6 p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">Computed Breakdown — {preview.teacher.name}</h3>
              <p className="mt-1 text-xs text-text/50">
                {formatDate(preview.periodFrom)} → {formatDate(preview.periodTo)} ·{" "}
                {preview.workingDays} working days ({preview.leaveDays} leave) ·{" "}
                {formatRs(preview.perDaySalary)}/day
              </p>
            </div>
          </div>

          {preview.deductions.length === 0 ? (
            <p className="mb-4 text-sm text-text/60">No Late or Absent days in this period — no deductions. Net equals base.</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Date</TH>
                  <TH>Type</TH>
                  <TH className="text-right">Amount</TH>
                  <TH className="w-24 text-center">Waive</TH>
                </TR>
              </THead>
              <TBody>
                {preview.deductions.map((d) => (
                  <TR key={d.lineId}>
                    <TD className="tabular-nums">{formatDate(d.date)}</TD>
                    <TD>
                      <span className={cn(
                        "inline-flex items-center gap-1 border px-1.5 py-0.5 text-[10px] font-medium",
                        d.type === "ABSENT"
                          ? "border-danger/30 bg-danger/10 text-danger"
                          : "border-orange-300 bg-orange-50 text-orange-700",
                      )}>
                        {d.type === "ABSENT" ? "Absent" : "Late"}
                      </span>
                    </TD>
                    <TD className={cn("text-right tabular-nums", d.waived && "text-text/40 line-through")}>
                      {formatRs(d.amount)}
                    </TD>
                    <TD className="text-center">
                      <input
                        type="checkbox"
                        checked={d.waived}
                        onChange={() => toggleWaive(d.lineId)}
                        className="size-4 accent-primary"
                        aria-label={`Waive deduction on ${formatDate(d.date)}`}
                      />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}

          <div className="mt-4 flex flex-col items-end gap-1 border-t border-border pt-4 text-sm">
            <p className="flex gap-4">
              <span className="text-text/50">Base amount ({preview.workingDays} days × {formatRs(preview.perDaySalary)})</span>
              <span className="font-medium tabular-nums">{formatRs(preview.baseAmount)}</span>
            </p>
            <p className="flex gap-4">
              <span className="text-text/50">Deductions ({preview.deductions.filter((d) => !d.waived).length})</span>
              <span className="font-medium tabular-nums text-danger">− {formatRs(preview.totalDeductions)}</span>
            </p>
            <p className="flex gap-4">
              <span className="font-semibold">Net payable</span>
              <span className="text-lg font-bold tabular-nums">{formatRs(preview.netAmount)}</span>
            </p>
          </div>

          <div className="mt-4 flex gap-3">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Printer className="size-4" aria-hidden="true" />}
              {saving ? "Saving…" : "Generate & Save"}
            </Button>
            <Button variant="secondary" onClick={() => setPreview(null)} disabled={saving}>
              Discard
            </Button>
          </div>
        </Card>
      )}

      {/* History */}
      {selectedTeacher && (
        <>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text/60">
            Salary Slip History
          </h3>
          {history.length === 0 ? (
            <EmptyState
              icon={Banknote}
              title="No salary slips yet"
              description="Generated slips will appear here for reprinting."
            />
          ) : (
            <div className="space-y-2">
              {history.map((slip) => (
                <Card key={slip.id} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{slip.teacher.name}</span>
                      <span className="text-xs text-text/40">•</span>
                      <span className="text-sm text-text/60">
                        {formatDate(slip.periodFrom)} → {formatDate(slip.periodTo)}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-text/50">
                      Base {formatRs(slip.baseAmount)} · Net {formatRs(slip.netAmount)} ·{" "}
                      {slip.deductions.length} deduction(s) · by {slip.generatedByUser.name}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => window.open(`/print/salary-slips/${slip.id}`, "_blank")}
                    title="Print salary slip"
                  >
                    <Printer className="size-3.5" aria-hidden="true" />
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}