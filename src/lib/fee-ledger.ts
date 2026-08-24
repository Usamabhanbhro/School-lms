export type FeePaymentStatus = "Pending" | "Partial" | "Paid";

export function deriveFeePaymentSummary(total: number, paidTotal: number) {
  const normalizedPaidTotal = Math.max(0, paidTotal);
  const balanceRemaining = Math.max(0, total - normalizedPaidTotal);
  const status: FeePaymentStatus =
    normalizedPaidTotal === 0
      ? "Pending"
      : normalizedPaidTotal >= total
        ? "Paid"
        : "Partial";

  return { paidTotal: normalizedPaidTotal, balanceRemaining, status };
}

export function formatFeeStatus(status: FeePaymentStatus) {
  return status;
}
