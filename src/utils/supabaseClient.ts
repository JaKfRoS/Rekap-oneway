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

// Format date helper for database/display
export function formatDate(dateStr: string): string {
  return dateStr; // Keep as string YYYY-MM-DD
}

// Core functions to fetch, add, update, delete
export async function getTransactions(): Promise<{ data: Transaction[]; source: 'supabase' | 'local'; error?: string }> {
  const supabase = getSupabaseClient();
  
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
        // Map any field mappings if necessary
        const mappedData: Transaction[] = data.map(item => ({
          id: item.id,
          created_at: item.created_at,
          date: item.date,
          type: item.type as 'income' | 'expense',
          category: item.category,
          client_name: item.client_name,
          amount: Number(item.amount),
          payment_status: item.payment_status as 'paid' | 'unpaid' | 'partial',
          notes: item.notes || ''
        }));
        
        // Save to local storage for caching/backup
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mappedData));
        return { data: mappedData, source: 'supabase' };
      }
    } catch (err: any) {
      console.error("Gagal menarik data dari Supabase, beralih ke Lokal:", err);
      const localData = getLocalTransactions();
      return { 
        data: localData, 
        source: 'local', 
        error: `Supabase error: ${err.message || err}. Menampilkan data cadangan lokal.` 
      };
    }
  }

  // Fallback to Local Storage
  const localData = getLocalTransactions();
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
      const { error } = await supabase
        .from('transactions')
        .insert([{
          id,
          created_at,
          date: newTransaction.date,
          type: newTransaction.type,
          category: newTransaction.category,
          client_name: newTransaction.client_name,
          amount: newTransaction.amount,
          payment_status: newTransaction.payment_status,
          notes: newTransaction.notes
        }]);

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
      const { error } = await supabase
        .from('transactions')
        .update({
          date: transaction.date,
          type: transaction.type,
          category: transaction.category,
          client_name: transaction.client_name,
          amount: transaction.amount,
          payment_status: transaction.payment_status,
          notes: transaction.notes
        })
        .eq('id', transaction.id);

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
      payment_status: item.payment_status,
      notes: item.notes
    }));

    const { error: insertErr } = await supabase
      .from('transactions')
      .insert(dbPayload);

    if (insertErr) throw insertErr;

    return { success: true, count: toInsert.length };
  } catch (err: any) {
    console.error("Gagal melakukan sinkronisasi:", err);
    return { success: false, count: 0, error: err.message || err };
  }
}
