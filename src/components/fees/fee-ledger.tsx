"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock3, CreditCard, Filter, Loader2, Search, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getApiErrorMessage } from "@/lib/utils";
import { getTodayLocal } from "@/lib/timezone";

type FeePaymentStatus = "Pending" | "Partial" | "Paid";

type LedgerRow = {
  challanId: string;
  studentId: string;
  studentName: string;
  classSection: string;
  issuedDate: string;
  total: number;
  paidTotal: number;
  balanceRemaining: number;
  status: FeePaymentStatus;
};

type LedgerResponse = {
  rows: LedgerRow[];
  totals: { challans: number; total: number; paidTotal: number; balanceRemaining: number };
};

const statusMeta: Record<FeePaymentStatus, { variant: "neutral" | "primary" | "success"; icon: typeof Clock3 }> = {
  Pending: { variant: "neutral", icon: Clock3 },
  Partial: { variant: "primary", icon: CreditCard },
  Paid: { variant: "success", icon: CheckCircle2 },
};

function money(value: number) {
  return `Rs. ${value.toLocaleString()}`;
}

export function FeeLedger() {
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [totals, setTotals] = useState<LedgerResponse["totals"]>({ challans: 0, total: 0, paidTotal: 0, balanceRemaining: 0 });
  const [classSection, setClassSection] = useState("");
  const [studentId, setStudentId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState<"" | FeePaymentStatus>("");
  const [loading, setLoading] = useState(true);
  const today = getTodayLocal();
  const [error, setError] = useState<string | null>(null);

  const loadLedger = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (classSection.trim()) params.set("classSection", classSection.trim());
      if (studentId.trim()) params.set("studentId", studentId.trim());
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (status) params.set("status", status);
      const response = await fetch(`/api/fee-ledger?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(getApiErrorMessage(payload, "Unable to load the fee ledger."));
      setRows(payload.data?.rows ?? []);
      setTotals(payload.data?.totals ?? { challans: 0, total: 0, paidTotal: 0, balanceRemaining: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load the fee ledger.");
    } finally {
      setLoading(false);
    }
  }, [classSection, studentId, from, to, status]);

  useEffect(() => {
    loadLedger();
  }, [loadLedger]);

  function clearFilters() {
    setClassSection("");
    setStudentId("");
    setFrom("");
    setTo("");
    setStatus("");
  }

  if (loading && rows.length === 0) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error && rows.length === 0) {
    return (
      <EmptyState
        icon={WalletCards}
        title="Unable to load fee ledger"
        description={error}
        action={<Button variant="secondary" onClick={loadLedger}>Retry</Button>}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <Filter className="size-4" aria-hidden="true" />
          Filter Ledger
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="space-y-1 text-xs font-medium text-text/60">
            Class / section
            <Input value={classSection} onChange={(event) => setClassSection(event.target.value)} placeholder="e.g. Grade 5 - A" />
          </label>
          <label className="space-y-1 text-xs font-medium text-text/60">
            Student ID
            <Input value={studentId} onChange={(event) => setStudentId(event.target.value)} placeholder="STD-2026-001" />
          </label>
          <label className="space-y-1 text-xs font-medium text-text/60">
            Issued from
            <Input type="date" value={from} max={to || today} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label className="space-y-1 text-xs font-medium text-text/60">
            Issued to
            <Input type="date" value={to} min={from || undefined} max={today} onChange={(event) => setTo(event.target.value)} />
          </label>
          <label className="space-y-1 text-xs font-medium text-text/60">
            Status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as "" | FeePaymentStatus)}
              className="h-9 w-full border border-border bg-bg px-3 text-sm text-text outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All statuses</option>
              <option value="Pending">Pending</option>
              <option value="Partial">Partial</option>
              <option value="Paid">Paid</option>
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button onClick={loadLedger} disabled={loading}>
            {loading ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Search className="size-3.5" aria-hidden="true" />}
            {loading ? "Loading…" : "Apply Filters"}
          </Button>
          <Button variant="secondary" onClick={clearFilters} disabled={loading}>Clear</Button>
          {error && <span className="text-sm text-danger">{error}</span>}
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4"><p className="text-xs uppercase tracking-wide text-text/50">Challans</p><p className="mt-1 text-2xl font-bold tabular-nums">{totals.challans}</p></Card>
        <Card className="p-4"><p className="text-xs uppercase tracking-wide text-text/50">Billed</p><p className="mt-1 text-2xl font-bold tabular-nums">{money(totals.total)}</p></Card>
        <Card className="p-4"><p className="text-xs uppercase tracking-wide text-text/50">Collected</p><p className="mt-1 text-2xl font-bold tabular-nums text-success">{money(totals.paidTotal)}</p></Card>
        <Card className="border-danger/30 p-4"><p className="text-xs uppercase tracking-wide text-text/50">Outstanding</p><p className="mt-1 text-2xl font-bold tabular-nums text-danger">{money(totals.balanceRemaining)}</p></Card>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={WalletCards}
          title="No challans match these filters"
          description="Generate a fee challan or adjust the filters to see the school-wide ledger."
          action={<Link href="/admin/fees"><Button>Open Fee Challans</Button></Link>}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Outstanding balance ledger</h2>
            <p className="mt-0.5 text-xs text-text/50">Payment status is derived from the immutable challan total and its payment history.</p>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <THead><TR><TH>Student</TH><TH>Class</TH><TH>Issued</TH><TH className="text-right">Total</TH><TH className="text-right">Paid</TH><TH className="text-right">Balance</TH><TH>Status</TH><TH /></TR></THead>
              <TBody>
                {rows.map((row) => {
                  const meta = statusMeta[row.status];
                  const Icon = meta.icon;
                  return (
                    <TR key={row.challanId}>
                      <TD><div className="font-medium">{row.studentName}</div><div className="text-xs text-text/50">{row.studentId}</div></TD>
                      <TD>{row.classSection}</TD>
                      <TD className="tabular-nums">{new Date(row.issuedDate).toLocaleDateString()}</TD>
                      <TD className="text-right tabular-nums">{money(row.total)}</TD>
                      <TD className="text-right tabular-nums text-success">{money(row.paidTotal)}</TD>
                      <TD className="text-right tabular-nums font-semibold text-danger">{money(row.balanceRemaining)}</TD>
                      <TD><Badge variant={meta.variant} icon={<Icon className="size-3" aria-hidden="true" />}>{row.status}</Badge></TD>
                      <TD className="text-right"><Link href={`/admin/fees?studentId=${encodeURIComponent(row.studentId)}`} className="text-xs font-medium text-primary hover:underline">View</Link></TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
