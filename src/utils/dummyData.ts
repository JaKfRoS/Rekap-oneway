export interface Transaction {
  id: string;
  created_at: string;
  date: string; // YYYY-MM-DD
  type: 'income' | 'expense';
  category: string;
  client_name: string | null;
  amount: number; // Total contract/deal value
  dp_amount?: number | null; // DP paid if payment_status === 'partial'
  payment_status: 'paid' | 'unpaid' | 'partial';
  notes: string;
}

// Generate dates relative to current date (July 2026 as per metadata, or dynamic)
const getPastDate = (daysAgo: number): string => {
  const date = new Date('2026-07-21');
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0];
};

export const INITIAL_TRANSACTIONS: Transaction[] = [
  // Income - Penjualan Produk & Jasa
  {
    id: 't-inc-1',
    created_at: new Date('2026-07-20T10:00:00Z').toISOString(),
    date: getPastDate(1),
    type: 'income',
    category: 'Penjualan Produk',
    client_name: 'Tokopedia Order #1029',
    amount: 3500000,
    payment_status: 'paid',
    notes: 'Penjualan Paket Produk Grosir'
  },
  {
    id: 't-inc-2',
    created_at: new Date('2026-07-18T14:30:00Z').toISOString(),
    date: getPastDate(3),
    type: 'income',
    category: 'Jasa & Layanan',
    client_name: 'Butik Clarissa',
    amount: 2000000,
    dp_amount: 1000000,
    payment_status: 'partial', // DP
    notes: 'DP 50% Pembuatan Desain Kemasan & Banner'
  },
  {
    id: 't-inc-3',
    created_at: new Date('2026-07-15T09:15:00Z').toISOString(),
    date: getPastDate(6),
    type: 'income',
    category: 'Jasa & Layanan',
    client_name: 'Brand Hijab Syari',
    amount: 5000000,
    payment_status: 'paid',
    notes: 'Layanan Pengelolaan Usaha Periode Juli'
  },
  {
    id: 't-inc-4',
    created_at: new Date('2026-07-10T11:00:00Z').toISOString(),
    date: getPastDate(11),
    type: 'income',
    category: 'Jasa & Layanan',
    client_name: 'Kosmetik Glow-Up',
    amount: 4500000,
    payment_status: 'unpaid',
    notes: 'Tagihan Layanan Konsultasi Usaha (Invoice Sent)'
  },
  {
    id: 't-inc-5',
    created_at: new Date('2026-07-05T08:00:00Z').toISOString(),
    date: getPastDate(16),
    type: 'income',
    category: 'Komisi & Affiliate',
    client_name: 'Program Affiliate',
    amount: 1850000,
    payment_status: 'paid',
    notes: 'Pencairan Komisi Mingguan Affiliate'
  },
  {
    id: 't-inc-6',
    created_at: new Date('2026-06-25T08:00:00Z').toISOString(),
    date: '2026-06-25',
    type: 'income',
    category: 'Komisi & Affiliate',
    client_name: 'Program Affiliate',
    amount: 2450000,
    payment_status: 'paid',
    notes: 'Komisi Bulanan Affiliate - Rekap Juni'
  },
  {
    id: 't-inc-7',
    created_at: new Date('2026-07-01T15:00:00Z').toISOString(),
    date: getPastDate(20),
    type: 'income',
    category: 'Pendapatan Lain-lain',
    client_name: 'Klien Privat Roy',
    amount: 750000,
    payment_status: 'paid',
    notes: 'Pendapatan Sampingan Optimasi Toko'
  },

  // Expenses
  {
    id: 't-exp-1',
    created_at: new Date('2026-07-19T13:00:00Z').toISOString(),
    date: getPastDate(2),
    type: 'expense',
    category: 'Iklan & Pemasaran',
    client_name: null,
    amount: 1500000,
    payment_status: 'paid',
    notes: 'Iklan Promosi Toko & Sosmed'
  },
  {
    id: 't-exp-2',
    created_at: new Date('2026-07-16T17:00:00Z').toISOString(),
    date: getPastDate(5),
    type: 'expense',
    category: 'Bahan Baku / Stok',
    client_name: null,
    amount: 1200000,
    payment_status: 'paid',
    notes: 'Pembelian Stok Barang & Bahan Kemasan'
  },
  {
    id: 't-exp-3',
    created_at: new Date('2026-07-08T09:00:00Z').toISOString(),
    date: getPastDate(13),
    type: 'expense',
    category: 'Operasional Usaha',
    client_name: null,
    amount: 450000,
    payment_status: 'paid',
    notes: 'Langganan Aplikasi Kasir & Software Toko'
  },
  {
    id: 't-exp-4',
    created_at: new Date('2026-07-05T10:30:00Z').toISOString(),
    date: getPastDate(16),
    type: 'expense',
    category: 'Sewa Tempat / Ruko',
    client_name: null,
    amount: 800000,
    payment_status: 'paid',
    notes: 'Biaya Sewa Tempat Usaha'
  },
  {
    id: 't-exp-5',
    created_at: new Date('2026-06-30T16:00:00Z').toISOString(),
    date: '2026-06-30',
    type: 'expense',
    category: 'Pengeluaran Lain-lain',
    client_name: null,
    amount: 250000,
    payment_status: 'paid',
    notes: 'Konsumsi & Keperluan Toko'
  },
  {
    id: 't-exp-6',
    created_at: new Date('2026-06-20T11:00:00Z').toISOString(),
    date: '2026-06-20',
    type: 'expense',
    category: 'Iklan & Pemasaran',
    client_name: null,
    amount: 2000000,
    payment_status: 'paid',
    notes: 'Top-up Saldo Iklan Toko Online'
  }
];
