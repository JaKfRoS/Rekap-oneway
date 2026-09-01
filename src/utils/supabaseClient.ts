import { createClient } from '@supabase/supabase-js';
import { Transaction, INITIAL_TRANSACTIONS } from './dummyData';
import { DEFAULT_INCOME_CATEGORIES, DEFAULT_EXPENSE_CATEGORIES } from './categories';

const HARDCODED_URL = 'https://ohhjcqihrjmewfbymhar.supabase.co';
const HARDCODED_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9oaGpjcWlocmptZXdmYnltaGFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2MTU0MjcsImV4cCI6MjEwMDE5MTQyN30.DmvCcF9w7fArZojyY8Xczzs4Ji4RyPv08fQJBEH-REc';

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

export const CONFIG_CATEGORY_ROW_ID = '00000000-0000-0000-0000-000000000000';

export interface CategoryData {
  income: string[];
  expense: string[];
}

export async function fetchCategoriesFromSupabaseDb(userId?: string): Promise<{ data: CategoryData | null; source: 'categories_table' | 'legacy_config' | 'local' }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { data: null, source: 'local' };

  if (!userId) {
    return { data: null, source: 'local' };
  }

  try {
    // Query dedicated 'categories' table strictly for this userId
    const { data: catRows, error: catErr } = await supabase
      .from('categories')
      .select('id, type, name, user_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (!catErr && Array.isArray(catRows)) {
      if (catRows.length > 0) {
        const income = catRows.filter((r: any) => r.type === 'income').map((r: any) => r.name);
        const expense = catRows.filter((r: any) => r.type === 'expense').map((r: any) => r.name);

        const categoriesData: CategoryData = {
          income: income.length > 0 ? Array.from(new Set(income)) : [...DEFAULT_INCOME_CATEGORIES],
          expense: expense.length > 0 ? Array.from(new Set(expense)) : [...DEFAULT_EXPENSE_CATEGORIES]
        };

        const storageKey = `pembukuan_categories_${userId}`;
        localStorage.setItem(storageKey, JSON.stringify(categoriesData));
        return { data: categoriesData, source: 'categories_table' };
      } else {
        // Table exists but is empty for this user -> seed initial default categories to Supabase
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
    console.warn("Table 'categories' query exception:", err);
  }

  return { data: null, source: 'local' };
}

export async function addCategoryToSupabaseDb(type: 'income' | 'expense', name: string, userId?: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase || !userId) return false;

  const trimmed = name.trim();
  if (!trimmed) return false;

  try {
    const payload: any = { type, name: trimmed, user_id: userId };
    const { error } = await supabase.from('categories').insert(payload);
    if (!error) return true;
    console.warn("Gagal insert ke tabel categories:", error.message);
  } catch (e) {
    console.warn("Exception saat insert category:", e);
  }

  return false;
}

export async function updateCategoryInSupabaseDb(type: 'income' | 'expense', oldName: string, newName: string, userId?: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase || !userId) return false;

  const trimmed = newName.trim();
  if (!trimmed || oldName === trimmed) return false;

  try {
    const { error } = await supabase
      .from('categories')
      .update({ name: trimmed })
      .eq('type', type)
      .eq('name', oldName)
      .eq('user_id', userId);

    if (!error) return true;
  } catch (e) {
    console.warn("Exception saat update category:", e);
  }

  return false;
}

export async function deleteCategoryFromSupabaseDb(type: 'income' | 'expense', name: string, userId?: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase || !userId) return false;

  try {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('type', type)
      .eq('name', name)
      .eq('user_id', userId);

    if (!error) return true;
  } catch (e) {
    console.warn("Exception saat delete category:", e);
  }

  return false;
}

export async function saveCategoriesToSupabase(categories: { income: string[]; expense: string[] }, userId?: string): Promise<{ success: boolean; error?: string }> {
  if (!userId) return { success: true };
  const storageKey = `pembukuan_categories_${userId}`;
  localStorage.setItem(storageKey, JSON.stringify(categories));

  const supabase = getSupabaseClient();
  if (!supabase) return { success: true };

  try {
    // Batch upsert to categories table for this user
    const rows = [
      ...categories.income.map(name => ({ type: 'income', name, user_id: userId })),
      ...categories.expense.map(name => ({ type: 'expense', name, user_id: userId }))
    ];

    await supabase.from('categories').upsert(rows, { onConflict: 'user_id,type,name' });
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

  // 2. If no user is logged in, use local guest storage
  if (!userId) {
    const guestData = getLocalUserTransactions('guest');
    const guestDeleted = getDeletedUserTransactionIds('guest');
    const filteredGuest = guestData.filter(t => !guestDeleted.has(t.id));
    return { data: filteredGuest, source: 'local' };
  }

  const deletedIds = getDeletedUserTransactionIds(userId);
  const supabase = getSupabaseClient();
  
  if (!supabase) {
    const localData = getLocalUserTransactions(userId);
    const filteredLocal = localData.filter(t => !deletedIds.has(t.id));
    return { data: filteredLocal, source: 'local', error: 'Database Supabase tidak terhubung. Menggunakan data simpanan lokal.' };
  }

  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Koneksi Supabase memakan waktu terlalu lama (Timeout).')), 5000)
    );

    // Strictly fetch ONLY transactions for this specific userId from Supabase
    const fetchPromise = supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    const { data, error }: any = await Promise.race([fetchPromise, timeoutPromise]);

    if (error) {
      throw error;
    }

    if (data) {
      // Filter out system config rows
      const actualDbRows = data.filter((item: any) => {
        if (
          item.id === CONFIG_CATEGORY_ROW_ID ||
          item.id?.startsWith(CONFIG_CATEGORY_ROW_ID) ||
          item.category === '__SYSTEM_CATEGORIES_CONFIG__' ||
          item.client_name === '__SYSTEM_CATEGORIES_CONFIG__' ||
          (item.id && deletedIds.has(item.id))
        ) {
          return false;
        }
        return true;
      });

      const localMap = new Map<string, number | null>();

      const mappedData: Transaction[] = actualDbRows
        .map((item: any) => {
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
        })
        .filter(t => !deletedIds.has(t.id));

      // Update user-specific local cache for offline viewing
      setLocalUserTransactions(userId, mappedData);
      return { data: mappedData, source: 'supabase' };
    }
  } catch (err: any) {
    console.warn("Gagal menarik data dari Supabase cloud (menggunakan cache lokal):", err);
    const userLocal = getLocalUserTransactions(userId);
    const filteredLocal = userLocal.filter(t => !deletedIds.has(t.id));
    return { 
      data: filteredLocal, 
      source: 'local'
    };
  }

  const userLocal = getLocalUserTransactions(userId);
  const filteredLocal = userLocal.filter(t => !deletedIds.has(t.id));
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

  // Unmark as deleted if it was previously recorded
  removeDeletedUserTransactionId(activeUserId, id);
  removeDeletedUserTransactionId('guest', id);

  // Save to user-specific local cache
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
      notes: notesForDb
    };

    if (userId) {
      payload.user_id = userId;
    }

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Koneksi Cloud memakan waktu terlalu lama (Timeout).')), 3500)
    );

    const insertWork = (async () => {
      let { error } = await supabase
        .from('transactions')
        .insert([payload]);

      if (error && isDpAmountColumnError(error)) {
        delete payload.dp_amount;
        const retry = await supabase.from('transactions').insert([payload]);
        error = retry.error;
      }
      return error;
    })();

    const error: any = await Promise.race([insertWork, timeoutPromise]);

    if (error) {
      console.warn("Gagal menyimpan ke Supabase cloud:", error);
      return { success: false, data: newTransaction, error: `Gagal menyimpan ke database cloud: ${error.message}` };
    }

    return { success: true, data: newTransaction };
  } catch (err: any) {
    console.warn("Error menyimpan ke Supabase cloud:", err);
    return { 
      success: false, 
      data: newTransaction, 
      error: `Error database cloud: ${err.message || err}` 
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

  // Unmark as deleted if it was previously recorded
  removeDeletedUserTransactionId(activeUserId, transaction.id);
  removeDeletedUserTransactionId('guest', transaction.id);

  // Update user-specific local cache
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
      let query = supabase.from('transactions').update(payload).eq('id', transaction.id);
      if (userId) {
        query = query.eq('user_id', userId);
      }
      let { error } = await query;

      if (error && isDpAmountColumnError(error)) {
        delete payload.dp_amount;
        let retryQuery = supabase.from('transactions').update(payload).eq('id', transaction.id);
        if (userId) {
          retryQuery = retryQuery.eq('user_id', userId);
        }
        const retry = await retryQuery;
        error = retry.error;
      }
      return error;
    })();

    const error: any = await Promise.race([updateWork, timeoutPromise]);

    if (error) {
      console.warn("Gagal mengupdate di Supabase cloud:", error);
      return { success: false, data: transaction, error: `Gagal update database: ${error.message}` };
    }

    return { success: true, data: transaction };
  } catch (err: any) {
    console.warn("Error mengupdate di Supabase cloud:", err);
    return { 
      success: false, 
      data: transaction, 
      error: `Error update database: ${err.message || err}` 
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

  // Record deleted ID in local tracking
  addDeletedUserTransactionId(activeUserId, id);
  if (userId) {
    addDeletedUserTransactionId('guest', id);
  }

  // Remove from user-specific local cache
  const localTx = getLocalUserTransactions(activeUserId);
  const updatedLocal = localTx.filter(item => item.id !== id);
  setLocalUserTransactions(activeUserId, updatedLocal);

  // Also purge from guest cache if present
  const guestTx = getLocalUserTransactions('guest');
  if (guestTx.some(item => item.id === id)) {
    setLocalUserTransactions('guest', guestTx.filter(item => item.id !== id));
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: true };
  }

  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Koneksi Cloud memakan waktu terlalu lama (Timeout).')), 3500)
    );

    const deleteWork = (async () => {
      let query = supabase.from('transactions').delete().eq('id', id);
      if (userId) {
        query = query.eq('user_id', userId);
      }
      const { error } = await query;
      return error;
    })();

    const error: any = await Promise.race([deleteWork, timeoutPromise]);

    if (error) {
      console.warn("Gagal menghapus dari Supabase cloud:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.warn("Error menghapus dari Supabase cloud:", err);
    return { success: false, error: err.message || String(err) };
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

  // Clear user-specific local cache
  setLocalUserTransactions(userId, []);

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      // Only delete transactions and categories belonging to this specific user
      await supabase
        .from('transactions')
        .delete()
        .eq('user_id', userId);

      await supabase
        .from('categories')
        .delete()
        .eq('user_id', userId);
    } catch (err: any) {
      console.error("Gagal menghapus data di Supabase:", err);
    }
  }

  return { success: true };
}

