export const formatIDR = (value: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

export const formatLongDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
};

export const formatShortDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
};

// Calculate actual cash received for income transaction
export const getActualIncomeAmount = (transaction: {
  type: 'income' | 'expense';
  amount: number;
  dp_amount?: number | null;
  payment_status: 'paid' | 'unpaid' | 'partial';
}): number => {
  if (transaction.type !== 'income') return 0;
  if (transaction.payment_status === 'paid') return transaction.amount;
  if (transaction.payment_status === 'partial') {
    return transaction.dp_amount != null && transaction.dp_amount > 0 
      ? transaction.dp_amount 
      : Math.round(transaction.amount / 2); // Default to 50% if dp_amount is missing
  }
  return 0; // unpaid
};

// Calculate outstanding receivable / piutang for income transaction
export const getPiutangAmount = (transaction: {
  type: 'income' | 'expense';
  amount: number;
  dp_amount?: number | null;
  payment_status: 'paid' | 'unpaid' | 'partial';
}): number => {
  if (transaction.type !== 'income') return 0;
  if (transaction.payment_status === 'paid') return 0;
  if (transaction.payment_status === 'unpaid') return transaction.amount;
  if (transaction.payment_status === 'partial') {
    const received = transaction.dp_amount != null && transaction.dp_amount > 0 
      ? transaction.dp_amount 
      : Math.round(transaction.amount / 2);
    return Math.max(0, transaction.amount - received);
  }
  return 0;
};

