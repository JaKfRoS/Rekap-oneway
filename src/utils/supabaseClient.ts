import { createClient } from '@supabase/supabase-js';
import { Transaction, INITIAL_TRANSACTIONS } from './dummyData';
import { DEFAULT_INCOME_CATEGORIES, DEFAULT_EXPENSE_CATEGORIES, CATEGORIES_STORAGE_KEY } from './categories';

const STORAGE_KEY = 'pembukuan_transactions';
const CONFIG_KEY = 'pembukuan_supabase_config';

const HARDCODED_URL = 'https://ohhjcqihrjmewfbymhar.supabase.co';
const HARDCODED_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9oaGpjcWlocmptZXdmYnltaGFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2MTU0MjcsImV4cCI6MjEwMDE5MTQyN30.DmvCcF9w7fArZojyY8Xczzs4Ji4RyPv08fQJBEH-REc';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isEnabled: boolean;
}

export function getSupabaseConfig(): SupabaseConfig {
  return { url: HARDCODED_URL, anonKey: HARDCODED_KEY, isEnabled: true };
}

export function saveSupabaseConfig(config: SupabaseConfig) {
  // No-op because it is hardcoded as requested
}

let supabaseInstance: any = null;

export function getSupabaseClient() {
  if (!supabaseInstance) {
    try {
      supabaseInstance = createClient<any>(HARDCODED_URL, HARDCODED_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        }
      });
    } catch (err) {
      console.error("Gagal menginisialisasi client Supabase:", err);
      return null;
    }
  }
  return supabaseInstance;
}

function getPastOrCurrentConfig(): SupabaseConfig | null {
  return { url: HARDCODED_URL, anonKey: HARDCODED_KEY, isEnabled: true };
}

export const CONFIG_CATEGORY_ROW_ID = '00000000-0000-0000-0000-000000000000';

export interface CategoryData {
  income: string[];
  expense: string[];
}

export async function fetchCategoriesFromSupabaseDb(userId?: string): Promise<{ data: CategoryData | null; source: 'categories_table' | 'legacy_config' | 'local' }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { data: null, source: 'local' };

  try {
    // 1. Try querying dedicated 'categories' table
    let query = supabase.from('categories').select('id, type, name, user_id').order('created_at', { ascending: true });
    
    if (userId) {
      query = query.or(`user_id.eq.${userId},user_id.is.null`);
    }

    const { data: catRows, error: catErr } = await query;

    if (!catErr && Array.isArray(catRows)) {
      if (catRows.length > 0) {
        const income = catRows.filter((r: any) => r.type === 'income').map((r: any) => r.name);
        const expense = catRows.filter((r: any) => r.type === 'expense').map((r: any) => r.name);

        const categoriesData: CategoryData = {
          income: income.length > 0 ? Array.from(new Set(income)) : [...DEFAULT_INCOME_CATEGORIES],
          expense: expense.length > 0 ? Array.from(new Set(expense)) : [...DEFAULT_EXPENSE_CATEGORIES]
        };

        const storageKey = userId ? `pembukuan_categories_${userId}` : CATEGORIES_STORAGE_KEY;
        localStorage.setItem(storageKey, JSON.stringify(categoriesData));
        return { data: categoriesData, source: 'categories_table' };
      } else if (userId) {
        // Table exists but is empty for user -> seed initial default categories to Supabase
        const seedRows = [
          ...DEFAULT_INCOME_CATEGORIES.map(name => ({ type: 'income', name, user_id: userId })),
          ...DEFAULT_EXPENSE_CATEGORIES.map(name => ({ type: 'expense', name, user_id: userId }))
        ];

        await supabase.from('categories').insert(seedRows);

        const defaultData: CategoryData = {
          income: [...DEFAULT_INCOME_CATEGORIES],
          expense: [...DEFAULT_EXPENSE_CATEGORIES]
        };

        const storageKey = `pembukuan_categories_${userId}`;
        localStorage.setItem(storageKey, JSON.stringify(defaultData));
        return { data: defaultData, source: 'categories_table' };
      }
    }
  } catch (err) {
    console.warn("Table 'categories' not present or unreachable, falling back to legacy config row:", err);
  }

  // 2. Fallback to legacy config row in transactions table
  try {
    const configId = userId ? `${CONFIG_CATEGORY_ROW_ID}_${userId}` : CONFIG_CATEGORY_ROW_ID;
    const { data: configRows } = await supabase
      .from('transactions')
      .select('notes')
      .or(`id.eq.${configId},category.eq.__SYSTEM_CATEGORIES_CONFIG__`);

    if (configRows && configRows.length > 0) {
      for (const row of configRows) {
        if (row.notes) {
          try {
            const parsed = JSON.parse(row.notes);
            if (parsed && Array.isArray(parsed.income) && Array.isArray(parsed.expense)) {
              const storageKey = userId ? `pembukuan_categories_${userId}` : CATEGORIES_STORAGE_KEY;
              localStorage.setItem(storageKey, JSON.stringify(parsed));
              return { data: parsed, source: 'legacy_config' };
            }
          } catch (e) {}
        }
      }
    }
  } catch (err) {
    console.warn("Error fetching legacy category config:", err);
  }

  return { data: null, source: 'local' };
}

export async function addCategoryToSupabaseDb(type: 'income' | 'expense', name: string, userId?: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const trimmed = name.trim();
  if (!trimmed) return false;

  try {
    const payload: any = { type, name: trimmed };
    if (userId) payload.user_id = userId;

    const { error } = await supabase.from('categories').insert(payload);
    if (!error) return true;
    console.warn("Gagal insert ke tabel categories, fallback:", error.message);
  } catch (e) {
    console.warn("Exception saat insert category:", e);
  }

  return false;
}

export async function updateCategoryInSupabaseDb(type: 'income' | 'expense', oldName: string, newName: string, userId?: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const trimmed = newName.trim();
  if (!trimmed || oldName === trimmed) return false;

  try {
    let query = supabase.from('categories').update({ name: trimmed }).eq('type', type).eq('name', oldName);
    if (userId) {
      query = query.eq('user_id', userId);
    }
    const { error } = await query;
    if (!error) return true;
  } catch (e) {
    console.warn("Exception saat update category:", e);
  }

  return false;
}

export async function deleteCategoryFromSupabaseDb(type: 'income' | 'expense', name: string, userId?: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    let query = supabase.from('categories').delete().eq('type', type).eq('name', name);
    if (userId) {
      query = query.eq('user_id', userId);
    }
    const { error } = await query;
    if (!error) return true;
  } catch (e) {
    console.warn("Exception saat delete category:", e);
  }

  return false;
}

export async function saveCategoriesToSupabase(categories: { income: string[]; expense: string[] }, userId?: string): Promise<{ success: boolean; error?: string }> {
  const storageKey = userId ? `pembukuan_categories_${userId}` : CATEGORIES_STORAGE_KEY;
  localStorage.setItem(storageKey, JSON.stringify(categories));

  const supabase = getSupabaseClient();
  if (!supabase) return { success: true };

  try {
    // Save to legacy config row as backup
    const configId = userId ? `${CONFIG_CATEGORY_ROW_ID}_${userId}` : CONFIG_CATEGORY_ROW_ID;
    const payload: any = {
      id: configId,
      date: '2000-01-01',
      type: 'income',
      category: '__SYSTEM_CATEGORIES_CONFIG__',
      client_name: '__SYSTEM_CATEGORIES_CONFIG__',
      amount: 0,
      dp_amount: null,
      payment_status: 'paid',
      notes: JSON.stringify(categories)
    };

    if (userId) {
      payload.user_id = userId;
    }

    let { error } = await supabase.from('transactions').upsert(payload);
    if (error && isDpAmountColumnError(error)) {
      delete payload.dp_amount;
      const retry = await supabase.from('transactions').upsert(payload);
      error = retry.error;
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

// Format date helper for database/display
export function formatDate(dateStr: string): string {
  return dateStr; // Keep as string YYYY-MM-DD
}

function isDpAmountColumnError(err: any): boolean {
  if (!err) return false;
  const msg = (typeof err === 'string' ? err : err.message || JSON.stringify(err)).toLowerCase();
  return msg.includes('dp_amount') || msg.includes('schema cache');
}

function parseDpAmountFromItem(item: any, localMap: Map<string, number | null>): { dpAmount: number | null; cleanNotes: string } {
  let rawNotes = item.notes || '';
  let dpAmount: number | null = null;

  if (item.dp_amount != null && item.dp_amount !== '') {
    dpAmount = Number(item.dp_amount);
  } else {
    // Check if DP tag exists in notes [DP: 1000000]
    const match = rawNotes.match(/\[DP:\s*(\d+)\]/);
    if (match && match[1]) {
      dpAmount = Number(match[1]);
    } else if (localMap.has(item.id)) {
      dpAmount = localMap.get(item.id) ?? null;
    }
  }

  // Clean tag from notes display
  const cleanNotes = rawNotes.replace(/\[DP:\s*\d+\]\s*/g, '').trim();

  return { dpAmount, cleanNotes };
}

function formatNotesWithDp(notes: string, dpAmount?: number | null, paymentStatus?: string): string {
  let baseNotes = (notes || '').replace(/\[DP:\s*\d+\]\s*/g, '').trim();
  if (paymentStatus === 'partial' && dpAmount != null && dpAmount > 0) {
    return `[DP: ${dpAmount}] ${baseNotes}`.trim();
  }
  return baseNotes;
}

export const DEMO_STORAGE_KEY = 'pembukuan_demo_transactions';

export function getDemoTransactions(): Transaction[] {
  const stored = localStorage.getItem(DEMO_STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length >= 0) {
        return parsed;
      }
    } catch (e) {}
  }
  localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(INITIAL_TRANSACTIONS));
  return INITIAL_TRANSACTIONS;
}

function getUserStorageKey(userId: string): string {
  return `pembukuan_user_transactions_${userId}`;
}

function getLocalUserTransactions(userId: string): Transaction[] {
  if (!userId) return [];
  const stored = localStorage.getItem(getUserStorageKey(userId));
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {}
  }
  return [];
}

function setLocalUserTransactions(userId: string, data: Transaction[]): void {
  if (!userId) return;
  localStorage.setItem(getUserStorageKey(userId), JSON.stringify(data));
}

function getDeletedUserTransactionIds(userId: string): Set<string> {
  if (!userId) return new Set();
  const stored = localStorage.getItem(`pembukuan_deleted_ids_${userId}`);
  if (stored) {
    try {
      const arr = JSON.parse(stored);
      if (Array.isArray(arr)) return new Set(arr);
    } catch (e) {}
  }
  return new Set();
}

function addDeletedUserTransactionId(userId: string, id: string): void {
  if (!userId) return;
  const set = getDeletedUserTransactionIds(userId);
  set.add(id);
  localStorage.setItem(`pembukuan_deleted_ids_${userId}`, JSON.stringify(Array.from(set)));
}

function removeDeletedUserTransactionId(userId: string, id: string): void {
  if (!userId) return;
  const set = getDeletedUserTransactionIds(userId);
  if (set.has(id)) {
    set.delete(id);
    localStorage.setItem(`pembukuan_deleted_ids_${userId}`, JSON.stringify(Array.from(set)));
  }
}

// Core functions to fetch, add, update, delete
export async function getTransactions(
  isDemoMode: boolean = false,
  userId?: string
): Promise<{ data: Transaction[]; source: 'supabase' | 'local'; error?: string }> {
  // 1. Mode Demo: strictly use local storage demo data, do NOT touch Supabase
  if (isDemoMode) {
    const demoData = getDemoTransactions();
    return { data: demoData, source: 'local' };
  }

  const activeUserId = userId || 'guest';
  const initialLocalData = getLocalUserTransactions(activeUserId);
  const deletedIds = getDeletedUserTransactionIds(activeUserId);

  const supabase = getSupabaseClient();
  
  if (!supabase) {
    const filteredLocal = initialLocalData.filter(t => !deletedIds.has(t.id));
    return { data: filteredLocal, source: 'local', error: 'Database Supabase tidak terhubung. Menggunakan data lokal.' };
  }

  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Koneksi Supabase memakan waktu terlalu lama (Timeout).')), 5000)
    );

    const fetchPromise = supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false });

    const { data, error }: any = await Promise.race([fetchPromise, timeoutPromise]);

    if (error) {
      throw error;
    }

    if (data) {
      let remoteCategories: { income: string[]; expense: string[] } | null = null;

      // Filter system config rows and enforce strict user data separation
      const actualDbRows = data.filter((item: any) => {
        if (
          item.id === CONFIG_CATEGORY_ROW_ID ||
          item.id?.startsWith(CONFIG_CATEGORY_ROW_ID) ||
          item.category === '__SYSTEM_CATEGORIES_CONFIG__' ||
          item.client_name === '__SYSTEM_CATEGORIES_CONFIG__'
        ) {
          if (item.notes && (item.user_id === activeUserId || !item.user_id)) {
            try {
              const parsed = JSON.parse(item.notes);
              if (parsed && Array.isArray(parsed.income) && Array.isArray(parsed.expense)) {
                remoteCategories = parsed;
              }
            } catch (e) {}
          }
          return false;
        }

        // Strict User Separation: If item has user_id, it MUST belong to current user (or be unassigned/guest)
        if (userId && item.user_id && item.user_id !== userId) {
          return false;
        }

        // Filter out deleted items
        if (deletedIds.has(item.id)) {
          return false;
        }

        return true;
      });

      // ALWAYS fetch fresh local transactions to prevent overwriting newly added items while query was pending
      const freshLocalData = getLocalUserTransactions(activeUserId);

      const localMap = new Map<string, number | null>();
      freshLocalData.forEach(t => localMap.set(t.id, t.dp_amount ?? null));

      const mappedData: Transaction[] = actualDbRows.map((item: any) => {
        const { dpAmount, cleanNotes } = parseDpAmountFromItem(item, localMap);
        return {
          id: item.id || crypto.randomUUID(),
          created_at: item.created_at || new Date().toISOString(),
          date: item.date || new Date().toISOString().split('T')[0],
          type: (item.type === 'expense' ? 'expense' : 'income') as 'income' | 'expense',
          category: item.category || 'Lain-lain',
          client_name: item.client_name || '',
          amount: Number(item.amount) || 0,
          dp_amount: dpAmount,
          payment_status: (item.payment_status || 'paid') as 'paid' | 'unpaid' | 'partial',
          notes: cleanNotes || ''
        };
      });

      // Merge DB rows with fresh local user cache to preserve recent local additions/updates
      const dbIds = new Set(mappedData.map(t => t.id));
      const missingLocal = freshLocalData.filter(t => !dbIds.has(t.id) && !deletedIds.has(t.id));

      const mergedData = [...mappedData, ...missingLocal].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      // Update user-specific local cache safely
      setLocalUserTransactions(activeUserId, mergedData);
      return { data: mergedData, source: 'supabase' };
    }
  } catch (err: any) {
    console.warn("Gagal menarik data dari Supabase cloud (menggunakan cache lokal):", err);
    const latestLocal = getLocalUserTransactions(activeUserId);
    const filteredLocal = latestLocal.filter(t => !deletedIds.has(t.id));
    return { 
      data: filteredLocal, 
      source: 'local'
    };
  }

  const latestLocal = getLocalUserTransactions(activeUserId);
  const filteredLocal = latestLocal.filter(t => !deletedIds.has(t.id));
  return { data: filteredLocal, source: 'local' };
}

export async function addTransaction(
  transaction: Omit<Transaction, 'id' | 'created_at'>,
  isDemoMode: boolean = false,
  userId?: string
): Promise<{ success: boolean; data?: Transaction; error?: string }> {
  const id = crypto.randomUUID();
  const created_at = new Date().toISOString();
  
  const newTransaction: Transaction = {
    ...transaction,
    id,
    created_at
  };

  // Demo mode
  if (isDemoMode) {
    const currentDemo = getDemoTransactions();
    const updatedDemo = [newTransaction, ...currentDemo];
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(updatedDemo));
    return { success: true, data: newTransaction };
  }

  const activeUserId = userId || 'guest';

  // Ensure item is removed from deleted tracking if re-added
  removeDeletedUserTransactionId(activeUserId, id);

  // ALWAYS save to local user cache first so data is instantly persistent
  const localTx = getLocalUserTransactions(activeUserId);
  const updatedLocal = [newTransaction, ...localTx.filter(t => t.id !== id)];
  setLocalUserTransactions(activeUserId, updatedLocal);

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: true, data: newTransaction, error: 'Database Supabase tidak terhubung. Transaksi disimpan secara lokal.' };
  }

  try {
    const notesForDb = formatNotesWithDp(newTransaction.notes, newTransaction.dp_amount, newTransaction.payment_status);

    const payload: any = {
      id,
      created_at,
      date: newTransaction.date,
      type: newTransaction.type,
      category: newTransaction.category,
      client_name: newTransaction.client_name,
      amount: newTransaction.amount,
      dp_amount: newTransaction.dp_amount || null,
      payment_status: newTransaction.payment_status,
      notes: notesForDb,
      user_id: userId
    };

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Koneksi Cloud memakan waktu terlalu lama (Timeout).')), 3500)
    );

    const insertWork = (async () => {
      let { error } = await supabase
        .from('transactions')
        .insert([payload]);

      if (error) {
        const errMsg = (error.message || '').toLowerCase();
        if (errMsg.includes('user_id') || errMsg.includes('dp_amount')) {
          if (errMsg.includes('user_id')) delete payload.user_id;
          if (errMsg.includes('dp_amount')) delete payload.dp_amount;
          const retry = await supabase.from('transactions').insert([payload]);
          error = retry.error;
        }
      }
      return error;
    })();

    const error: any = await Promise.race([insertWork, timeoutPromise]);

    if (error) {
      console.warn("Gagal menyimpan ke Supabase cloud, transaksi disimpan secara lokal:", error);
      return { success: true, data: newTransaction, error: `Tersimpan secara lokal (Peringatan Cloud: ${error.message})` };
    }

    return { success: true, data: newTransaction };
  } catch (err: any) {
    console.warn("Error menyimpan ke Supabase cloud, transaksi disimpan secara lokal:", err);
    return { 
      success: true, 
      data: newTransaction, 
      error: `Tersimpan secara lokal (Peringatan Cloud: ${err.message || err})` 
    };
  }
}

export async function updateTransaction(
  transaction: Transaction,
  isDemoMode: boolean = false,
  userId?: string
): Promise<{ success: boolean; data?: Transaction; error?: string }> {
  if (isDemoMode) {
    const currentDemo = getDemoTransactions();
    const updatedDemo = currentDemo.map(t => t.id === transaction.id ? transaction : t);
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(updatedDemo));
    return { success: true, data: transaction };
  }

  const activeUserId = userId || 'guest';

  // Ensure item is not tracked as deleted
  removeDeletedUserTransactionId(activeUserId, transaction.id);

  // ALWAYS update local user cache first
  const localTx = getLocalUserTransactions(activeUserId);
  const updatedLocal = localTx.map(item => item.id === transaction.id ? transaction : item);
  setLocalUserTransactions(activeUserId, updatedLocal);

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: true, data: transaction, error: 'Database Supabase tidak terhubung. Perubahan disimpan secara lokal.' };
  }

  try {
    const notesForDb = formatNotesWithDp(transaction.notes, transaction.dp_amount, transaction.payment_status);

    const payload: any = {
      date: transaction.date,
      type: transaction.type,
      category: transaction.category,
      client_name: transaction.client_name,
      amount: transaction.amount,
      dp_amount: transaction.dp_amount || null,
      payment_status: transaction.payment_status,
      notes: notesForDb
    };

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Koneksi Cloud memakan waktu terlalu lama (Timeout).')), 3500)
    );

    const updateWork = (async () => {
      let { error } = await supabase
        .from('transactions')
        .update(payload)
        .eq('id', transaction.id);

      if (error && isDpAmountColumnError(error)) {
        delete payload.dp_amount;
        const retry = await supabase
          .from('transactions')
          .update(payload)
          .eq('id', transaction.id);
        error = retry.error;
      }
      return error;
    })();

    const error: any = await Promise.race([updateWork, timeoutPromise]);

    if (error) {
      console.warn("Gagal mengupdate di Supabase cloud, perubahan disimpan secara lokal:", error);
      return { success: true, data: transaction, error: `Perubahan tersimpan lokal (Peringatan Cloud: ${error.message})` };
    }

    return { success: true, data: transaction };
  } catch (err: any) {
    console.warn("Error mengupdate di Supabase cloud, perubahan disimpan secara lokal:", err);
    return { 
      success: true, 
      data: transaction, 
      error: `Perubahan tersimpan lokal (Peringatan Cloud: ${err.message || err})` 
    };
  }
}

export async function deleteTransaction(
  id: string,
  isDemoMode: boolean = false,
  userId?: string
): Promise<{ success: boolean; error?: string }> {
  if (isDemoMode) {
    const currentDemo = getDemoTransactions();
    const updatedDemo = currentDemo.filter(t => t.id !== id);
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(updatedDemo));
    return { success: true };
  }

  const activeUserId = userId || 'guest';

  // Mark ID as deleted locally
  addDeletedUserTransactionId(activeUserId, id);

  // ALWAYS remove from local user cache
  const localTx = getLocalUserTransactions(activeUserId);
  const updatedLocal = localTx.filter(item => item.id !== id);
  setLocalUserTransactions(activeUserId, updatedLocal);

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: true };
  }

  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Koneksi Cloud memakan waktu terlalu lama (Timeout).')), 3500)
    );

    const deleteWork = (async () => {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);
      return error;
    })();

    const error: any = await Promise.race([deleteWork, timeoutPromise]);

    if (error) {
      console.warn("Gagal menghapus dari Supabase cloud, item tetap dihapus dari tampilan lokal:", error);
    }

    return { success: true };
  } catch (err: any) {
    console.warn("Error menghapus dari Supabase cloud, item tetap dihapus dari tampilan lokal:", err);
    return { success: true };
  }
}

export async function clearAllData(
  isDemoMode: boolean = false,
  userId?: string
): Promise<{ success: boolean; error?: string }> {
  if (isDemoMode) {
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(INITIAL_TRANSACTIONS));
    return { success: true };
  }

  if (!userId) return { success: true };

  // Clear local user cache
  setLocalUserTransactions(userId, []);

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      // Only delete transactions belonging to this specific user
      await supabase
        .from('transactions')
        .delete()
        .eq('user_id', userId);
    } catch (err: any) {
      console.error("Gagal menghapus data di Supabase:", err);
    }
  }

  return { success: true };
}

