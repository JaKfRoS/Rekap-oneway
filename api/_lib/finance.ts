interface TxLike {
  type: string;
  amount: number;
  dp_amount?: number | null;
  payment_status: string;
}

// Mirrors src/utils/formatters.ts (getActualIncomeAmount / getPiutangAmount).
// Duplicated here rather than imported since api/ is a separate server
// bundle from the Vite frontend in src/.

export function getActualIncomeAmount(t: TxLike): number {
  if (t.type !== 'income') return 0;
  if (t.payment_status === 'paid') return t.amount;
  if (t.payment_status === 'partial') {
    return t.dp_amount != null && t.dp_amount > 0 ? t.dp_amount : Math.round(t.amount / 2);
  }
  return 0;
}

export function getPiutangAmount(t: TxLike): number {
  if (t.type !== 'income') return 0;
  if (t.payment_status === 'paid') return 0;
  if (t.payment_status === 'unpaid') return t.amount;
  if (t.payment_status === 'partial') {
    const received = t.dp_amount != null && t.dp_amount > 0 ? t.dp_amount : Math.round(t.amount / 2);
    return Math.max(0, t.amount - received);
  }
  return 0;
}

export function formatIDR(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
