"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clock3,
  CreditCard,
  Loader2,
  Minus,
  Plus,
  Printer,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StudentPicker } from "@/components/ui/student-picker";
import type { StudentPickerStudent } from "@/components/ui/student-picker";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { getApiErrorMessage } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { getTodayLocal } from "@/lib/timezone";

// ─── Types ──────────────────────────────────────────────────────

type Student = StudentPickerStudent & { guardianCnic: string };

interface BankSettings {
  bankName: string;
  bankAccountNumber: string;
}

interface FeeChallanLineItem {
  id: string;
  description: string;
  amount: number;
}

interface FeeChallan {
  id: string;
  studentId: string;
  studentNameSnapshot: string;
  guardianNameSnapshot: string;
  guardianCnicSnapshot: string;
  classSectionSnapshot: string;
  bankNameSnapshot: string;
  bankAccountNumberSnapshot: string;
  total: number;
  issuedDate: string;
  lineItems: FeeChallanLineItem[];
  payments: FeeChallanPayment[];
  paidTotal: number;
  balanceRemaining: number;
  status: "Pending" | "Partial" | "Paid";
  createdAt: string;
}

interface FeeChallanPayment {
  id: string;
  amount: number;
  paidAt: string;
  note: string | null;
  recordedByUser: { id: string; name: string };
}

const paymentStatusMeta = {
  Pending: { variant: "neutral" as const, icon: Clock3 },
  Partial: { variant: "primary" as const, icon: CreditCard },
  Paid: { variant: "success" as const, icon: CheckCircle2 },
};

// ─── Component ──────────────────────────────────────────────────

export function FeeChallanGeneration() {
  const { addToast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [bankSettings, setBankSettings] = useState<BankSettings | null>(null);
  const [challans, setChallans] = useState<FeeChallan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [lineItems, setLineItems] = useState<Array<{ description: string; amount: number }>>([
    { description: "Base Fee", amount: 0 },
    { description: "Arrears", amount: 0 },
    { description: "Late Fee", amount: 0 },
  ]);
  const [saving, setSaving] = useState(false);
  const [historyStudentId, setHistoryStudentId] = useState<string | null>(null);
  const [paymentForChallanId, setPaymentForChallanId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(getTodayLocal());
  const [paymentNote, setPaymentNote] = useState("");
  const [recordingPayment, setRecordingPayment] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [studentsRes, bankRes] = await Promise.all([
        fetch("/api/students"),
        fetch("/api/settings/bank"),
      ]);

      if (!studentsRes.ok) throw new Error("Failed to load students");
      const studentsJson = await studentsRes.json();
      setStudents(studentsJson.data ?? []);

      if (bankRes.ok) {
        const bankJson = await bankRes.json();
        setBankSettings(bankJson.data ?? null);
      } else if (bankRes.status === 404) {
        setBankSettings(null);
      }
    } catch {
      setError("Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchChallanHistory = useCallback(async (studentId: string) => {
    try {
      const res = await fetch(`/api/students/${studentId}/fee-challans`);
      const json = await res.json();
      if (!res.ok) throw new Error(getApiErrorMessage(json, "Unable to load challan history."));
      setChallans(json.data ?? []);
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Unable to load challan history.");
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (historyStudentId) {
      fetchChallanHistory(historyStudentId);
    } else {
      setChallans([]);
    }
  }, [historyStudentId, fetchChallanHistory]);

  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  const total = lineItems.reduce((sum, item) => sum + item.amount, 0);

  function addLineItem() {
    setLineItems((prev) => [...prev, { description: "", amount: 0 }]);
  }

  function removeLineItem(index: number) {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateLineItem(index: number, field: "description" | "amount", value: string | number) {
    setLineItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, [field]: value } : item,
      ),
    );
  }

  async function handleRecordPayment(challan: FeeChallan) {
    const amount = Number(paymentAmount);
    if (!Number.isInteger(amount) || amount <= 0) {
      addToast("error", "Enter a positive whole-number payment amount.");
      return;
    }
    if (amount > challan.balanceRemaining) {
      addToast("error", `Payment cannot exceed the remaining balance of Rs. ${challan.balanceRemaining.toLocaleString()}.`);
      return;
    }

    setRecordingPayment(true);
    try {
      const response = await fetch(`/api/fee-challans/${challan.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, paidAt: paymentDate, note: paymentNote.trim() || undefined }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(getApiErrorMessage(payload, "Unable to record payment."));
      addToast("success", "Payment recorded successfully.");
      setPaymentForChallanId(null);
      setPaymentAmount("");
      setPaymentNote("");
      await fetchChallanHistory(historyStudentId ?? challan.studentId);
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Unable to record payment.");
    } finally {
      setRecordingPayment(false);
    }
  }

  async function handleSaveAndPrint() {
    if (!selectedStudentId) return;
    if (!bankSettings) {
      addToast("error", "Bank settings not configured. An administrator must set up bank details first.");
      return;
    }
    const validItems = lineItems.filter((l) => l.description.trim() && l.amount > 0);
    if (validItems.length === 0) {
      addToast("error", "Add at least one line item with a description and amount.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/students/${selectedStudentId}/fee-challans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineItems: validItems }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to create challan");

      addToast("success", "Fee challan saved successfully");
      setSelectedStudentId("");
      setLineItems([
        { description: "Base Fee", amount: 0 },
        { description: "Arrears", amount: 0 },
        { description: "Late Fee", amount: 0 },
      ]);
      fetchData();

      // Open print view
      window.open(`/print/fee-challans/${json.data.id}`, "_blank");
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Error loading data"
        description={error}
        action={<Button variant="secondary" onClick={fetchData}>Retry</Button>}
      />
    );
  }

  return (
    <>
      {/* Generate form */}
      <Card className="mb-6 p-6">
        <h2 className="mb-4 text-base font-semibold">Generate Fee Challan</h2>

        {/* Bank settings warning */}
        {!bankSettings && (
          <div className="mb-4 flex items-center gap-2 border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            Bank settings not configured. An administrator must set up bank details in Settings before generating challans.
          </div>
        )}          {/* Student search */}
          <div className="mb-4">
            <label htmlFor="fee-student-search" className="mb-1 block text-xs font-medium text-text/60">
              Student
            </label>
            <div className="max-w-md">
              <StudentPicker
                students={students}
                selectedStudentId={selectedStudentId}
                onSelect={(id) => {
                  setSelectedStudentId(id);
                  if (id) setHistoryStudentId(id);
                }}
                searchPlaceholder="Search by name, guardian, or student ID…"
              />
            </div>
            {selectedStudent && (
              <div className="mt-2 grid max-w-md grid-cols-2 gap-2 text-xs text-text/60">
                <span>Guardian: {selectedStudent.guardianName}</span>
                <span>CNIC: {selectedStudent.guardianCnic}</span>
                <span>Class: {selectedStudent.classSection.className} — {selectedStudent.classSection.sectionName}</span>
                {bankSettings && <span>Bank: {bankSettings.bankName}</span>}
              </div>
            )}
          </div>

        {/* Line items */}
        {selectedStudentId && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Fee Line Items</h3>
              <Button variant="secondary" onClick={addLineItem} className="h-7 text-xs">
                <Plus className="size-3" aria-hidden="true" /> Add Line
              </Button>
            </div>
            <Table>
              <THead>
                <TR>
                  <TH className="w-1/2">Description</TH>
                  <TH className="w-1/4 text-right">Amount (Rs.)</TH>
                  <TH className="w-12" />
                </TR>
              </THead>
              <TBody>
                {lineItems.map((item, index) => (
                  <TR key={index}>
                    <TD>
                      <Input
                        placeholder="e.g. Base Fee, Arrears, Late Fee"
                        value={item.description}
                        onChange={(e) => updateLineItem(index, "description", e.target.value)}
                        className="h-8 text-sm"
                      />
                    </TD>
                    <TD>
                      <Input
                        type="number"
                        min={0}
                        value={item.amount || ""}
                        onChange={(e) => updateLineItem(index, "amount", parseInt(e.target.value) || 0)}
                        className="h-8 text-right text-sm tabular-nums"
                        placeholder="0"
                      />
                    </TD>
                    <TD>
                      {lineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLineItem(index)}
                          className="inline-flex size-7 items-center justify-center text-text/40 hover:text-danger"
                          aria-label="Remove line item"
                        >
                          <Minus className="size-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>

            {/* Total */}
            <div className="mt-3 flex items-center justify-end gap-4 border-t border-border pt-3">
              <span className="text-sm font-semibold uppercase tracking-wide text-text/60">Total</span>
              <span className="text-lg font-bold tabular-nums">Rs. {total.toLocaleString()}</span>
            </div>

            {/* Actions */}
            <div className="mt-4 flex gap-3">
              <Button onClick={handleSaveAndPrint} disabled={saving || !bankSettings}>
                <Printer className="size-3.5" aria-hidden="true" />
                {saving ? "Saving…" : "Save & Print"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setSelectedStudentId("");
                  setLineItems([
        { description: "Base Fee", amount: 0 },
        { description: "Arrears", amount: 0 },
        { description: "Late Fee", amount: 0 },
      ]);
                  setHistoryStudentId(null);
                }}
              >
                Clear
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Challan history for selected student */}
      {historyStudentId && (
        <>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text/60">
            Challan History
          </h3>
          {challans.length === 0 ? (
            <EmptyState
              icon={Banknote}
              title="No challans for this student"
              description="Generated challans will appear here for reprinting."
            />
          ) : (
            <div className="space-y-3">
              {challans.map((challan) => {
                const statusMeta = paymentStatusMeta[challan.status];
                const StatusIcon = statusMeta.icon;
                const isRecording = paymentForChallanId === challan.id;
                return (
                  <Card key={challan.id} className="p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{challan.studentNameSnapshot}</span>
                          <span className="text-xs text-text/40">•</span>
                          <span className="text-sm text-text/60">{challan.classSectionSnapshot}</span>
                          <Badge variant={statusMeta.variant} icon={<StatusIcon className="size-3" aria-hidden="true" />}>
                            {challan.status}
                          </Badge>
                        </div>
                        <div className="mt-1 text-xs text-text/50">
                          Issued {new Date(challan.issuedDate).toLocaleDateString()} · {challan.lineItems.length} items
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        onClick={() => window.open(`/print/fee-challans/${challan.id}`, "_blank")}
                        title="Print challan"
                      >
                        <Printer className="size-3.5" aria-hidden="true" />
                        Print
                      </Button>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 border-y border-border py-3 text-sm">
                      <div><div className="text-xs text-text/50">Total</div><div className="font-semibold tabular-nums">Rs. {challan.total.toLocaleString()}</div></div>
                      <div><div className="text-xs text-text/50">Paid</div><div className="font-semibold tabular-nums text-success">Rs. {challan.paidTotal.toLocaleString()}</div></div>
                      <div><div className="text-xs text-text/50">Balance</div><div className="font-semibold tabular-nums text-danger">Rs. {challan.balanceRemaining.toLocaleString()}</div></div>
                    </div>

                    <div className="mt-4">
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-text/60">Payment history</h4>
                        {challan.balanceRemaining > 0 && (
                          <Button variant="secondary" className="h-8 text-xs" onClick={() => setPaymentForChallanId(isRecording ? null : challan.id)}>
                            <CreditCard className="size-3.5" aria-hidden="true" />
                            {isRecording ? "Cancel" : "Record Payment"}
                          </Button>
                        )}
                      </div>
                      {challan.payments.length === 0 ? (
                        <p className="text-sm text-text/50">No payments recorded for this challan.</p>
                      ) : (
                        <div className="overflow-x-auto border border-border">
                          <Table>
                            <THead><TR><TH>Date</TH><TH>Note</TH><TH>Recorded by</TH><TH className="text-right">Amount</TH></TR></THead>
                            <TBody>
                              {challan.payments.map((payment) => (
                                <TR key={payment.id}>
                                  <TD className="tabular-nums">{new Date(payment.paidAt).toLocaleDateString()}</TD>
                                  <TD>{payment.note || "—"}</TD>
                                  <TD>{payment.recordedByUser.name}</TD>
                                  <TD className="text-right font-medium tabular-nums">Rs. {payment.amount.toLocaleString()}</TD>
                                </TR>
                              ))}
                            </TBody>
                          </Table>
                        </div>
                      )}
                    </div>

                    {isRecording && (
                      <div className="mt-4 border-t border-border pt-4">
                        <div className="grid gap-3 sm:grid-cols-3">
                          <label className="space-y-1 text-xs font-medium text-text/60">
                            Amount (Rs.)
                            <Input type="number" min={1} max={challan.balanceRemaining} value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} placeholder={String(challan.balanceRemaining)} />
                          </label>
                          <label className="space-y-1 text-xs font-medium text-text/60">
                            Payment date
                            <Input type="date" value={paymentDate} max={getTodayLocal()} onChange={(event) => setPaymentDate(event.target.value > getTodayLocal() ? getTodayLocal() : event.target.value)} />
                          </label>
                          <label className="space-y-1 text-xs font-medium text-text/60">
                            Note (optional)
                            <Input value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} placeholder="e.g. Bank transfer" maxLength={500} />
                          </label>
                        </div>
                        <div className="mt-3 flex items-center gap-3">
                          <Button onClick={() => handleRecordPayment(challan)} disabled={recordingPayment}>
                            {recordingPayment ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <CreditCard className="size-3.5" aria-hidden="true" />}
                            {recordingPayment ? "Recording…" : "Save Payment"}
                          </Button>
                          <span className="text-xs text-text/50">Remaining: Rs. {challan.balanceRemaining.toLocaleString()}</span>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </>
  );
}
