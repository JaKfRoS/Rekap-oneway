import { Transaction } from './dummyData';
import { saveCategoriesToSupabase } from './supabaseClient';

export const CATEGORIES_STORAGE_KEY = 'pembukuan_custom_categories';
const CATEGORIES_KEY = CATEGORIES_STORAGE_KEY;

export interface CategoryData {
  income: string[];
  expense: string[];
}

export const DEFAULT_INCOME_CATEGORIES = [
  'Penjualan Produk',
  'Jasa & Layanan',
  'Komisi & Affiliate',
  'Pendapatan Lain-lain'
];

export const DEFAULT_EXPENSE_CATEGORIES = [
  'Operasional Usaha',
  'Bahan Baku / Stok',
  'Gaji & Penjaga Toko',
  'Sewa Tempat / Ruko',
  'Listrik, Air & Internet',
  'Iklan & Pemasaran',
  'Transportasi & Logistik',
  'Pengeluaran Lain-lain'
];

export const LEGACY_CATEGORIES = [
  'Pembuatan Toko',
  'Handle Toko',
  'Shopee Affiliate',
  'Operational',
  'Ads Spend',
  'Freelancer / Sub-kontraktor',
  'Tool / Langganan Software',
  'Konsultasi',
  'Toko Shopee',
  'Lain-lain'
];

export function getCategories(transactions: Transaction[] = []): CategoryData {
  let income = [...DEFAULT_INCOME_CATEGORIES];
  let expense = [...DEFAULT_EXPENSE_CATEGORIES];

  const stored = localStorage.getItem(CATEGORIES_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed.income)) {
        const cleanedIncome = parsed.income.filter((c: string) => !LEGACY_CATEGORIES.includes(c));
        if (cleanedIncome.length > 0) {
          income = Array.from(new Set([...DEFAULT_INCOME_CATEGORIES, ...cleanedIncome]));
        }
      }
      if (Array.isArray(parsed.expense)) {
        const cleanedExpense = parsed.expense.filter((c: string) => !LEGACY_CATEGORIES.includes(c));
        if (cleanedExpense.length > 0) {
          expense = Array.from(new Set([...DEFAULT_EXPENSE_CATEGORIES, ...cleanedExpense]));
        }
      }
    } catch (e) {
      console.error('Error parsing categories:', e);
    }
  }

  // Merge any custom categories present in actual transaction data
  if (transactions && Array.isArray(transactions)) {
    transactions.forEach(t => {
      if (t.category && typeof t.category === 'string') {
        const cat = t.category.trim();
        if (!cat || LEGACY_CATEGORIES.includes(cat)) return;
        if (t.type === 'income') {
          if (!income.includes(cat)) {
            income.push(cat);
          }
        } else if (t.type === 'expense') {
          if (!expense.includes(cat)) {
            expense.push(cat);
          }
        }
      }
    });
  }

  return { income, expense };
}

export function saveCategories(categories: CategoryData, userId?: string): void {
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
  // Sync categories to Supabase Cloud in the background if userId exists
  if (userId) {
    saveCategoriesToSupabase(categories, userId);
  }
}

export function addCategory(type: 'income' | 'expense', name: string): CategoryData {
  const current = getCategories();
  const trimmed = name.trim();
  if (!trimmed) return current;

  if (type === 'income') {
    if (!current.income.includes(trimmed)) {
      current.income.push(trimmed);
    }
  } else {
    if (!current.expense.includes(trimmed)) {
      current.expense.push(trimmed);
    }
  }

  saveCategories(current);
  return current;
}

export function updateCategory(type: 'income' | 'expense', oldName: string, newName: string): CategoryData {
  const current = getCategories();
  const trimmed = newName.trim();
  if (!trimmed || oldName === trimmed) return current;

  if (type === 'income') {
    const idx = current.income.indexOf(oldName);
    if (idx !== -1) {
      current.income[idx] = trimmed;
    }
  } else {
    const idx = current.expense.indexOf(oldName);
    if (idx !== -1) {
      current.expense[idx] = trimmed;
    }
  }

  saveCategories(current);
  return current;
}

export function deleteCategory(type: 'income' | 'expense', name: string): CategoryData {
  const current = getCategories();
  if (type === 'income') {
    current.income = current.income.filter(c => c !== name);
    if (current.income.length === 0) {
      current.income = ['Lain-lain'];
    }
  } else {
    current.expense = current.expense.filter(c => c !== name);
    if (current.expense.length === 0) {
      current.expense = ['Lain-lain'];
    }
  }

  saveCategories(current);
  return current;
}
