export interface Transaction {
  id: string;
  created_at: string;
  date: string; // YYYY-MM-DD
  type: 'income' | 'expense';
  category: string;
  client_name: string | null;
  amount: number;
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
  // Income - Pembuatan Toko
  {
    id: 't-inc-1',
    created_at: new Date('2026-07-20T10:00:00Z').toISOString(),
    date: getPastDate(1),
    type: 'income',
    category: 'Pembuatan Toko',
    client_name: 'CV Makmur Sentosa',
    amount: 3500000,
    payment_status: 'paid',
    notes: 'Pembuatan Website Toko Online Shopify + Integrasi Payment Gateway'
  },
  {
    id: 't-inc-2',
    created_at: new Date('2026-07-18T14:30:00Z').toISOString(),
    date: getPastDate(3),
    type: 'income',
    category: 'Pembuatan Toko',
    client_name: 'Butik Clarissa',
    amount: 2000000,
    payment_status: 'partial', // DP
    notes: 'DP 50% Pembuatan Toko Shopee & Upload 100 Produk'
  },
  // Income - Handle Toko
  {
    id: 't-inc-3',
    created_at: new Date('2026-07-15T09:15:00Z').toISOString(),
    date: getPastDate(6),
    type: 'income',
    category: 'Handle Toko',
    client_name: 'Brand Hijab Syari',
    amount: 5000000,
    payment_status: 'paid',
    notes: 'Monthly Fee Handle Toko Shopee & Tokopedia + Manage Ads Spend'
  },
  {
    id: 't-inc-4',
    created_at: new Date('2026-07-10T11:00:00Z').toISOString(),
    date: getPastDate(11),
    type: 'income',
    category: 'Handle Toko',
    client_name: 'Kosmetik Glow-Up',
    amount: 4500000,
    payment_status: 'unpaid',
    notes: 'Tagihan Manajemen Toko Periode Juli (Invoice Sent)'
  },
  // Income - Shopee Affiliate
  {
    id: 't-inc-5',
    created_at: new Date('2026-07-05T08:00:00Z').toISOString(),
    date: getPastDate(16),
    type: 'income',
    category: 'Shopee Affiliate',
    client_name: 'Shopee Affiliate Program',
    amount: 1850000,
    payment_status: 'paid',
    notes: 'Pencairan Komisi Mingguan Affiliate Periode Akhir Juni'
  },
  {
    id: 't-inc-6',
    created_at: new Date('2026-06-25T08:00:00Z').toISOString(),
    date: '2026-06-25',
    type: 'income',
    category: 'Shopee Affiliate',
    client_name: 'Shopee Affiliate Program',
    amount: 2450000,
    payment_status: 'paid',
    notes: 'Komisi Bulanan Shopee Affiliate - Juni Rekap'
  },
  // Income - Lain-lain
  {
    id: 't-inc-7',
    created_at: new Date('2026-07-01T15:00:00Z').toISOString(),
    date: getPastDate(20),
    type: 'income',
    category: 'Lain-lain',
    client_name: 'Klien Privat Roy',
    amount: 750000,
    payment_status: 'paid',
    notes: 'Konsultasi Strategi Iklan & Optimasi Toko Shopee'
  },

  // Expenses
  {
    id: 't-exp-1',
    created_at: new Date('2026-07-19T13:00:00Z').toISOString(),
    date: getPastDate(2),
    type: 'expense',
    category: 'Ads Spend',
    client_name: null,
    amount: 1500000,
    payment_status: 'paid',
    notes: 'Iklan Shopee Ads & Facebook Ads - Campaign Hijab Syari'
  },
  {
    id: 't-exp-2',
    created_at: new Date('2026-07-16T17:00:00Z').toISOString(),
    date: getPastDate(5),
    type: 'expense',
    category: 'Freelancer / Sub-kontraktor',
    client_name: null,
    amount: 1200000,
    payment_status: 'paid',
    notes: 'Pembayaran Desain Banner & Konten Feed - Freelancer Desainer Grafis'
  },
  {
    id: 't-exp-3',
    created_at: new Date('2026-07-08T09:00:00Z').toISOString(),
    date: getPastDate(13),
    type: 'expense',
    category: 'Tool / Langganan Software',
    client_name: null,
    amount: 450000,
    payment_status: 'paid',
    notes: 'Langganan Bulanan Canva Pro, Chat GPT Plus, dan Shopify Partner Apps'
  },
  {
    id: 't-exp-4',
    created_at: new Date('2026-07-05T10:30:00Z').toISOString(),
    date: getPastDate(16),
    type: 'expense',
    category: 'Operational',
    client_name: null,
    amount: 800000,
    payment_status: 'paid',
    notes: 'Sewa Co-working space & Internet bulanan tim'
  },
  {
    id: 't-exp-5',
    created_at: new Date('2026-06-30T16:00:00Z').toISOString(),
    date: '2026-06-30',
    type: 'expense',
    category: 'Lain-lain',
    client_name: null,
    amount: 250000,
    payment_status: 'paid',
    notes: 'Konsumsi Rapat Koordinasi Tim Bulanan'
  },
  {
    id: 't-exp-6',
    created_at: new Date('2026-06-20T11:00:00Z').toISOString(),
    date: '2026-06-20',
    type: 'expense',
    category: 'Ads Spend',
    client_name: null,
    amount: 2000000,
    payment_status: 'paid',
    notes: 'Top-up Iklan Tokopedia Ads & Shopee Ads - Project Kosmetik'
  }
];
