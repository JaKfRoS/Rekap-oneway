-- ====================================================================
-- SKRIP SETUP SUPABASE KASUSAHA (MULTI-USER, CATEGORIES & REALTIME)
-- ====================================================================
-- Petunjuk Penggunaan:
-- 1. Buka dashboard Supabase Anda (https://supabase.com/dashboard)
-- 2. Pilih Proyek Anda -> Klik menu 'SQL Editor' di sidebar kiri
-- 3. Klik 'New query'
-- 4. Salin (copy) seluruh isi teks file ini dan tempel (paste) ke editor
-- 5. Klik tombol 'Run' di kanan bawah editor Supabase.
--
-- Catatan: skrip ini sinkron dengan kode SQL bawaan di dalam aplikasi
-- (menu "Kode SQL Setup Supabase"). Jalankan ulang skrip ini kapan saja
-- untuk memastikan kebijakan keamanan (RLS) selalu dalam kondisi terbaru.
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

-- 4. Hapus policy lama jika ada agar tidak bentrok (termasuk kebijakan lama
--    yang mengizinkan akses publik ke baris tanpa user_id -- TIDAK aman
--    untuk data multi-user dan sengaja dihapus di sini)
DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can delete own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow anon public access" ON public.transactions;

-- 5. Buat Kebijakan Keamanan Multi-Pengguna (RLS Policies)
-- Setiap pengguna HANYA dapat melihat & mengubah data miliknya sendiri.
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

-- 6. Tambahkan indeks performa untuk query berbasis user_id
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(date);

-- ====================================================================
-- 7. Buat Tabel Kategori Kustom (public.categories)
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

-- 8. Aktifkan fitur Supabase Realtime Sinkronisasi untuk tabel transactions dan categories
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
