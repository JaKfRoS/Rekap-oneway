-- ====================================================================
-- SKRIP SETUP SUPABASE KASUSAHA (MULTI-USER & REALTIME SINKRONISASI)
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

-- 3. Aktifkan Row Level Security (RLS) agar tiap pengguna hanya melihat datanya sendiri
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- 4. Hapus policy lama jika ada agar tidak bentrok
DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can delete own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow anon public access" ON public.transactions;

-- 5. Buat Kebijakan Keamanan Multi-Pengguna (RLS Policies)
-- Memungkinkan pengguna melihat data milik mereka sendiri (atau data publik tanpa user_id)
CREATE POLICY "Users can view own transactions" 
ON public.transactions FOR SELECT 
USING (auth.uid() = user_id OR user_id IS NULL);

-- Memungkinkan pengguna menambah transaksi baru untuk akun mereka
CREATE POLICY "Users can insert own transactions" 
ON public.transactions FOR INSERT 
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Memungkinkan pengguna mengedit transaksi mereka
CREATE POLICY "Users can update own transactions" 
ON public.transactions FOR UPDATE 
USING (auth.uid() = user_id OR user_id IS NULL);

-- Memungkinkan pengguna menghapus transaksi mereka
CREATE POLICY "Users can delete own transactions" 
ON public.transactions FOR DELETE 
USING (auth.uid() = user_id OR user_id IS NULL);

-- 6. Tambahkan indeks performa untuk query berbasis user_id
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(date);

-- 7. Aktifkan fitur Supabase Realtime Sinkronisasi untuk tabel transactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
