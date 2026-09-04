import { 
  saveCategoriesToSupabase, 
  fetchCategoriesFromSupabaseDb,
  addCategoryToSupabaseDb,
  updateCategoryInSupabaseDb,
  deleteCategoryFromSupabaseDb
} from './supabaseClient';

export const CATEGORIES_STORAGE_KEY = 'pembukuan_custom_categories';

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

export function getCategoryStorageKey(userId?: string): string {
  return userId ? `pembukuan_categories_${userId}` : CATEGORIES_STORAGE_KEY;
}

export function getCategories(userId?: string): CategoryData {
  const storageKey = getCategoryStorageKey(userId);
  const stored = localStorage.getItem(storageKey);

  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed && Array.isArray(parsed.income) && Array.isArray(parsed.expense)) {
        return {
          income: parsed.income,
          expense: parsed.expense
        };
      }
    } catch (e) {
      console.error('Error parsing categories:', e);
    }
  }

  // Default fallback when user has not saved custom categories yet
  const defaultCategories: CategoryData = {
    income: [...DEFAULT_INCOME_CATEGORIES],
    expense: [...DEFAULT_EXPENSE_CATEGORIES]
  };

  try {
    localStorage.setItem(storageKey, JSON.stringify(defaultCategories));
  } catch (e) {}

  return defaultCategories;
}

export async function fetchCategoriesAsync(userId?: string): Promise<CategoryData> {
  const res = await fetchCategoriesFromSupabaseDb(userId);
  if (res.data) {
    return res.data;
  }
  return getCategories(userId);
}

export function saveCategories(categories: CategoryData, userId?: string): void {
  const storageKey = getCategoryStorageKey(userId);
  localStorage.setItem(storageKey, JSON.stringify(categories));
  // Sync categories to Supabase Cloud in the background
  saveCategoriesToSupabase(categories, userId);
}

export function addCategory(type: 'income' | 'expense', name: string, userId?: string): CategoryData {
  const current = getCategories(userId);
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

  saveCategories(current, userId);
  return current;
}

export async function addCategoryAsync(type: 'income' | 'expense', name: string, userId?: string): Promise<CategoryData> {
  const updated = addCategory(type, name, userId);
  await addCategoryToSupabaseDb(type, name, userId);
  return updated;
}

export function updateCategory(type: 'income' | 'expense', oldName: string, newName: string, userId?: string): CategoryData {
  const current = getCategories(userId);
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

  saveCategories(current, userId);
  return current;
}

export async function updateCategoryAsync(type: 'income' | 'expense', oldName: string, newName: string, userId?: string): Promise<CategoryData> {
  const updated = updateCategory(type, oldName, newName, userId);
  await updateCategoryInSupabaseDb(type, oldName, newName, userId);
  return updated;
}

export function deleteCategory(type: 'income' | 'expense', name: string, userId?: string): CategoryData {
  const current = getCategories(userId);
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

  saveCategories(current, userId);
  return current;
}

export async function deleteCategoryAsync(type: 'income' | 'expense', name: string, userId?: string): Promise<CategoryData> {
  const updated = deleteCategory(type, name, userId);
  await deleteCategoryFromSupabaseDb(type, name, userId);
  return updated;
}

