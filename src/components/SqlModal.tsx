import React, { useState } from 'react';
import { Database, Copy, Check, X, ExternalLink, Code2 } from 'lucide-react';

interface SqlModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SQL_SCRIPT = `-- ====================================================================
-- SKRIP SETUP SUPABASE KASUSAHA (MULTI-USER, CATEGORIES & REALTIME)
-- ====================================================================
-- Petunjuk Penggunaan:
-- 1. Buka dashboard Supabase Anda (https://supabase.com/dashboard)
-- 2. Pilih Proyek Anda -> Klik menu 'SQL Editor' di sidebar kiri
-- 3. Klik 'New query'
-- 4. Salin (copy) seluruh isi teks file ini dan tempel (paste) ke editor
-- 5. Klik tombol 'Run' di kanan bawah editor Supabase.
-- ====================================================================

-- 1. Buat Tabel transactions jika belum ada
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    date DATE NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
    category TEXT NOT NULL,
    client_name TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    dp_amount NUMERIC DEFAULT NULL,
    payment_status VARCHAR(20) NOT NULL CHECK (payment_status IN ('paid', 'unpaid', 'partial')),
    notes TEXT DEFAULT '',
    user_id UUID DEFAULT auth.uid()
);

-- 2. Pastikan kolom user_id & dp_amount ada jika tabel dibuat sebelumnya
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='user_id') THEN
        ALTER TABLE public.transactions ADD COLUMN user_id UUID DEFAULT auth.uid();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='dp_amount') THEN
        ALTER TABLE public.transactions ADD COLUMN dp_amount NUMERIC DEFAULT NULL;
    END IF;
END $$;

-- 3. Aktifkan Row Level Security (RLS) untuk transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can delete own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow anon public access" ON public.transactions;

CREATE POLICY "Users can view own transactions" 
ON public.transactions FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions" 
ON public.transactions FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions" 
ON public.transactions FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions" 
ON public.transactions FOR DELETE 
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(date);

-- ====================================================================
-- 4. Buat Tabel Kategori Kustom (public.categories)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID DEFAULT auth.uid(),
    type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
    name TEXT NOT NULL,
    CONSTRAINT categories_user_type_name_key UNIQUE (user_id, type, name)
);

-- Aktifkan Row Level Security (RLS) untuk categories
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can insert own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can update own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can delete own categories" ON public.categories;

CREATE POLICY "Users can view own categories" 
ON public.categories FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own categories" 
ON public.categories FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories" 
ON public.categories FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories" 
ON public.categories FOR DELETE 
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_categories_user_id ON public.categories(user_id);

-- 5. Aktifkan fitur Supabase Realtime Sinkronisasi untuk tabel transactions dan categories
DO $$
BEGIN
    -- Aktifkan Realtime untuk tabel transactions (abaikan jika sudah aktif)
    BEGIN
        EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions';
    EXCEPTION
        WHEN duplicate_object THEN NULL;
        WHEN OTHERS THEN NULL;
    END;

    -- Aktifkan Realtime untuk tabel categories (abaikan jika sudah aktif)
    BEGIN
        EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.categories';
    EXCEPTION
        WHEN duplicate_object THEN NULL;
        WHEN OTHERS THEN NULL;
    END;
END $$;
`;

export const SqlModal: React.FC<SqlModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(SQL_SCRIPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-100 my-8">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-6 relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center border border-indigo-500/30">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Kode SQL Setup Supabase</h3>
              <p className="text-xs text-slate-300">Salin dan jalankan di SQL Editor Dashboard Supabase Anda</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-4">
          
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3.5 rounded-xl text-xs space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <Code2 className="w-4 h-4 text-amber-600 shrink-0" />
              Langkah Mudah Setup Database Multi-User:
            </p>
            <ol className="list-decimal list-inside space-y-1 pl-1 text-slate-700">
              <li>Klik tombol <strong>"Salin Kode SQL"</strong> di bawah ini.</li>
              <li>Buka dashboard <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-emerald-700 underline font-semibold inline-flex items-center gap-0.5">Supabase <ExternalLink className="w-3 h-3" /></a> lalu pilih proyek Anda.</li>
              <li>Klik menu <strong>SQL Editor</strong> di sidebar kiri &gt; pilih <strong>New query</strong>.</li>
              <li>Tempelkan (Paste) kode SQL lalu klik tombol <strong>Run</strong>. Selesai!</li>
            </ol>
          </div>

          <div className="relative">
            <div className="flex items-center justify-between bg-slate-800 text-slate-300 px-4 py-2 rounded-t-xl text-xs font-mono border-b border-slate-700">
              <span>supabase_setup.sql</span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-sans font-semibold text-xs transition-all shadow-xs"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Tersalin!' : 'Salin Kode SQL'}</span>
              </button>
            </div>
            <pre className="p-4 bg-slate-900 text-slate-100 font-mono text-xs rounded-b-xl overflow-x-auto max-h-72 leading-relaxed selection:bg-indigo-500 selection:text-white">
              {SQL_SCRIPT}
            </pre>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-all"
            >
              Tutup Window
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
