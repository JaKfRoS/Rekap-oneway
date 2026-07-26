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

export async function saveCategoriesToSupabase(categories: { income: string[]; expense: string[] }, userId?: string): Promise<{ success: boolean; error?: string }> {
  const storageKey = userId ? `pembukuan_categories_${userId}` : CATEGORIES_STORAGE_KEY;
  localStorage.setItem(storageKey, JSON.stringify(categories));

  const supabase = getSupabaseClient();
  if (!supabase) return { success: true };

  try {
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

    if (error) {
      console.warn("Gagal menyimpan kategori ke Supabase config row:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.warn("Error saat menyimpan kategori ke Supabase:", err);
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

  // 2. Unauthenticated / No User
  if (!userId) {
    return { data: [], source: 'local' };
  }

  const supabase = getSupabaseClient();
  
  if (!supabase) {
    const localData = getLocalUserTransactions(userId);
    return { data: localData, source: 'local', error: 'Database Supabase tidak terhubung. Menggunakan data lokal.' };
  }

  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Koneksi Supabase memakan waktu terlalu lama (Timeout).')), 6000)
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
          if (item.notes && (item.user_id === userId || !item.user_id)) {
            try {
              const parsed = JSON.parse(item.notes);
              if (parsed && Array.isArray(parsed.income) && Array.isArray(parsed.expense)) {
                remoteCategories = parsed;
              }
            } catch (e) {}
          }
          return false;
        }

        // Strict User Separation: If item has user_id, it MUST belong to current user
        if (item.user_id && item.user_id !== userId) {
          return false;
        }

        return true;
      });

      const localMap = new Map<string, number | null>();

      const mappedData: Transaction[] = actualDbRows.map((item: any) => {
        const { dpAmount, cleanNotes } = parseDpAmountFromItem(item, localMap);
        return {
          id: item.id,
          created_at: item.created_at,
          date: item.date,
          type: item.type as 'income' | 'expense',
          category: item.category,
          client_name: item.client_name,
          amount: Number(item.amount),
          dp_amount: dpAmount,
          payment_status: item.payment_status as 'paid' | 'unpaid' | 'partial',
          notes: cleanNotes
        };
      });

      // Update user-specific local cache
      setLocalUserTransactions(userId, mappedData);
      return { data: mappedData, source: 'supabase' };
    }
  } catch (err: any) {
    console.error("Gagal menarik data dari Supabase:", err);
    const localData = getLocalUserTransactions(userId);
    return { 
      data: localData, 
      source: 'local', 
      error: `Supabase error: ${err.message || err}. Menampilkan data lokal.` 
    };
  }

  const localData = getLocalUserTransactions(userId);
  return { data: localData, source: 'local' };
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

  if (!userId) {
    return { success: false, error: 'Silakan masuk ke akun Anda terlebih dahulu.' };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Database Supabase tidak terhubung.' };
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

    if (error) {
      console.error("Gagal menyimpan ke Supabase:", error);
      return { success: false, error: `Gagal menyimpan ke database Supabase: ${error.message}` };
    }

    // Update local user cache
    const localTx = getLocalUserTransactions(userId);
    setLocalUserTransactions(userId, [newTransaction, ...localTx]);

    return { success: true, data: newTransaction };
  } catch (err: any) {
    console.error("Error menambahkan ke Supabase:", err);
    return { 
      success: false, 
      error: `Gagal menyimpan ke database Supabase: ${err.message || err}` 
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

  if (!userId) {
    return { success: false, error: 'Silakan masuk ke akun Anda terlebih dahulu.' };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Database Supabase tidak terhubung.' };
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

    if (error) {
      console.error("Gagal mengupdate di Supabase:", error);
      return { success: false, error: `Gagal mengupdate database Supabase: ${error.message}` };
    }

    // Update local user cache
    const localTx = getLocalUserTransactions(userId);
    const updatedLocal = localTx.map(item => item.id === transaction.id ? transaction : item);
    setLocalUserTransactions(userId, updatedLocal);

    return { success: true, data: transaction };
  } catch (err: any) {
    console.error("Error mengupdate di Supabase:", err);
    return { 
      success: false, 
      error: `Gagal mengupdate database Supabase: ${err.message || err}` 
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

  if (!userId) {
    return { success: false, error: 'Silakan masuk ke akun Anda terlebih dahulu.' };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Database Supabase tidak terhubung.' };
  }

  try {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error("Gagal menghapus dari Supabase:", error);
      return { success: false, error: `Gagal menghapus dari database Supabase: ${error.message}` };
    }

    // Update local user cache
    const localTx = getLocalUserTransactions(userId);
    const updatedLocal = localTx.filter(item => item.id !== id);
    setLocalUserTransactions(userId, updatedLocal);

    return { success: true };
  } catch (err: any) {
    console.error("Error menghapus dari Supabase:", err);
    return { 
      success: false, 
      error: `Gagal menghapus dari database Supabase: ${err.message || err}` 
    };
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

