import { createClient } from '@supabase/supabase-js';
import { Transaction, INITIAL_TRANSACTIONS } from './dummyData';

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

export function getSupabaseClient() {
  try {
    return createClient(HARDCODED_URL, HARDCODED_KEY);
  } catch (err) {
    console.error("Gagal menginisialisasi client Supabase:", err);
    return null;
  }
}

function getPastOrCurrentConfig(): SupabaseConfig | null {
  return { url: HARDCODED_URL, anonKey: HARDCODED_KEY, isEnabled: true };
}

export const CONFIG_CATEGORY_ROW_ID = '00000000-0000-0000-0000-000000000000';
export const CATEGORIES_STORAGE_KEY = 'pembukuan_custom_categories';

export async function saveCategoriesToSupabase(categories: { income: string[]; expense: string[] }): Promise<{ success: boolean; error?: string }> {
  localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categories));

  const supabase = getSupabaseClient();
  if (!supabase) return { success: true };

  try {
    const payload: any = {
      id: CONFIG_CATEGORY_ROW_ID,
      date: '2000-01-01',
      type: 'income',
      category: '__SYSTEM_CATEGORIES_CONFIG__',
      client_name: '__SYSTEM_CATEGORIES_CONFIG__',
      amount: 0,
      dp_amount: null,
      payment_status: 'paid',
      notes: JSON.stringify(categories)
    };

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

// Core functions to fetch, add, update, delete
export async function getTransactions(): Promise<{ data: Transaction[]; source: 'supabase' | 'local'; error?: string }> {
  const supabase = getSupabaseClient();
  const localData = getLocalTransactions();
  const localMap = new Map<string, number | null>();
  localData.forEach(item => {
    if (item.dp_amount != null) localMap.set(item.id, item.dp_amount);
  });
  
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false });

      if (error) {
        throw error;
      }

      if (data) {
        let remoteCategories: { income: string[]; expense: string[] } | null = null;

        // Filter out system config rows and extract remote categories if present
        const actualDbRows = data.filter(item => {
          if (
            item.id === CONFIG_CATEGORY_ROW_ID ||
            item.category === '__SYSTEM_CATEGORIES_CONFIG__' ||
            item.client_name === '__SYSTEM_CATEGORIES_CONFIG__'
          ) {
            if (item.notes) {
              try {
                const parsed = JSON.parse(item.notes);
                if (parsed && Array.isArray(parsed.income) && Array.isArray(parsed.expense)) {
                  remoteCategories = parsed;
                }
              } catch (e) {
                console.error("Gagal parse config row categories:", e);
              }
            }
            return false;
          }
          return true;
        });

        // Map transaction items
        const mappedData: Transaction[] = actualDbRows.map(item => {
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

        // Sync and merge categories into local storage
        if (remoteCategories) {
          const incomeSet = new Set<string>(remoteCategories.income);
          const expenseSet = new Set<string>(remoteCategories.expense);

          mappedData.forEach(t => {
            if (t.category && typeof t.category === 'string') {
              const cat = t.category.trim();
              if (cat) {
                if (t.type === 'income') incomeSet.add(cat);
                if (t.type === 'expense') expenseSet.add(cat);
              }
            }
          });

          const merged = {
            income: Array.from(incomeSet),
            expense: Array.from(expenseSet)
          };
          localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(merged));
        } else {
          const stored = localStorage.getItem(CATEGORIES_STORAGE_KEY);
          let currentIncome = ['Pembuatan Toko', 'Handle Toko', 'Shopee Affiliate', 'Lain-lain'];
          let currentExpense = ['Operational', 'Ads Spend', 'Freelancer / Sub-kontraktor', 'Tool / Langganan Software', 'Lain-lain'];
          if (stored) {
            try {
              const p = JSON.parse(stored);
              if (Array.isArray(p.income) && p.income.length > 0) currentIncome = p.income;
              if (Array.isArray(p.expense) && p.expense.length > 0) currentExpense = p.expense;
            } catch (e) {}
          }

          const incomeSet = new Set<string>(currentIncome);
          const expenseSet = new Set<string>(currentExpense);

          mappedData.forEach(t => {
            if (t.category && typeof t.category === 'string') {
              const cat = t.category.trim();
              if (cat) {
                if (t.type === 'income') incomeSet.add(cat);
                if (t.type === 'expense') expenseSet.add(cat);
              }
            }
          });

          const merged = {
            income: Array.from(incomeSet),
            expense: Array.from(expenseSet)
          };
          localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(merged));
        }
        
        // Save to local storage for caching/backup
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mappedData));
        return { data: mappedData, source: 'supabase' };
      }
    } catch (err: any) {
      console.error("Gagal menarik data dari Supabase, beralih ke Lokal:", err);
      return { 
        data: localData, 
        source: 'local', 
        error: `Supabase error: ${err.message || err}. Menampilkan data cadangan lokal.` 
      };
    }
  }

  // Fallback to Local Storage
  return { data: localData, source: 'local' };
}

function getLocalTransactions(): Transaction[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      // corrupt
    }
  }
  // Seed initial data if empty
  localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_TRANSACTIONS));
  return INITIAL_TRANSACTIONS;
}

export async function addTransaction(transaction: Omit<Transaction, 'id' | 'created_at'>): Promise<{ success: boolean; data?: Transaction; error?: string }> {
  const id = crypto.randomUUID();
  const created_at = new Date().toISOString();
  
  const newTransaction: Transaction = {
    ...transaction,
    id,
    created_at
  };

  // 1. Save to local storage
  const localTransactions = getLocalTransactions();
  const updatedLocal = [newTransaction, ...localTransactions];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedLocal));

  // 2. Save to Supabase if configured
  const supabase = getSupabaseClient();
  if (supabase) {
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

      let { error } = await supabase
        .from('transactions')
        .insert([payload]);

      if (error && isDpAmountColumnError(error)) {
        delete payload.dp_amount;
        const retry = await supabase.from('transactions').insert([payload]);
        error = retry.error;
      }

      if (error) throw error;
      return { success: true, data: newTransaction };
    } catch (err: any) {
      console.error("Gagal menambahkan ke Supabase:", err);
      return { 
        success: true, 
        data: newTransaction, 
        error: `Transaksi tersimpan di lokal, namun gagal sync ke Supabase: ${err.message || err}` 
      };
    }
  }

  return { success: true, data: newTransaction };
}

export async function updateTransaction(transaction: Transaction): Promise<{ success: boolean; data?: Transaction; error?: string }> {
  // 1. Update in local storage
  const localTransactions = getLocalTransactions();
  const updatedLocal = localTransactions.map(item => item.id === transaction.id ? transaction : item);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedLocal));

  // 2. Update in Supabase if configured
  const supabase = getSupabaseClient();
  if (supabase) {
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

      if (error) throw error;
      return { success: true, data: transaction };
    } catch (err: any) {
      console.error("Gagal mengupdate ke Supabase:", err);
      return { 
        success: true, 
        data: transaction, 
        error: `Transaksi terupdate di lokal, namun gagal sync ke Supabase: ${err.message || err}` 
      };
    }
  }

  return { success: true, data: transaction };
}

export async function deleteTransaction(id: string): Promise<{ success: boolean; error?: string }> {
  // 1. Delete in local storage
  const localTransactions = getLocalTransactions();
  const updatedLocal = localTransactions.filter(item => item.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedLocal));

  // 2. Delete in Supabase if configured
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error("Gagal menghapus dari Supabase:", err);
      return { 
        success: true, 
        error: `Transaksi terhapus di lokal, namun gagal sync ke Supabase: ${err.message || err}` 
      };
    }
  }

  return { success: true };
}

// Function to sync local transactions to Supabase (Upload all missing)
export async function syncLocalToSupabase(): Promise<{ success: boolean; count: number; error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, count: 0, error: 'Supabase belum dikonfigurasi atau dinonaktifkan.' };
  }

  try {
    const local = getLocalTransactions();
    
    // First fetch existing IDs from Supabase to prevent duplicates
    const { data: existing, error: fetchErr } = await supabase
      .from('transactions')
      .select('id');
      
    if (fetchErr) throw fetchErr;
    
    const existingIds = new Set((existing || []).map(item => item.id));
    const toInsert = local.filter(item => !existingIds.has(item.id));

    if (toInsert.length === 0) {
      return { success: true, count: 0 };
    }

    // Insert to Supabase
    const dbPayload = toInsert.map(item => ({
      id: item.id,
      created_at: item.created_at,
      date: item.date,
      type: item.type,
      category: item.category,
      client_name: item.client_name,
      amount: item.amount,
      dp_amount: item.dp_amount || null,
      payment_status: item.payment_status,
      notes: formatNotesWithDp(item.notes, item.dp_amount, item.payment_status)
    }));

    let { error: insertErr } = await supabase
      .from('transactions')
      .insert(dbPayload);

    if (insertErr && isDpAmountColumnError(insertErr)) {
      const strippedPayload = dbPayload.map(({ dp_amount, ...rest }) => rest);
      const retry = await supabase
        .from('transactions')
        .insert(strippedPayload);
      insertErr = retry.error;
    }

    if (insertErr) throw insertErr;

    return { success: true, count: toInsert.length };
  } catch (err: any) {
    console.error("Gagal melakukan sinkronisasi:", err);
    return { success: false, count: 0, error: err.message || err };
  }
}
