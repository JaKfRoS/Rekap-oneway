-- ====================================================================
-- SKRIP SETUP MCP SERVER KASUSAHA (OAuth untuk Chat Connector)
-- ====================================================================
-- Skrip ini membuat tabel-tabel internal yang dipakai oleh MCP server
-- (di folder /api) agar KasUsaha bisa diakses lewat chat (Claude.ai
-- custom connector) menggunakan alur OAuth standar.
--
-- PENTING: tabel-tabel ini HANYA boleh diakses oleh backend tepercaya
-- (lewat Supabase Service Role Key), TIDAK PERNAH oleh anon key dari
-- browser. RLS diaktifkan tanpa policy sama sekali, artinya secara
-- default semua akses via anon/authenticated key akan DITOLAK, dan
-- hanya service_role (yang otomatis melewati RLS) yang bisa baca/tulis.
--
-- Petunjuk Penggunaan: sama seperti supabase_setup.sql — buka SQL
-- Editor di dashboard Supabase, tempel skrip ini, lalu klik Run.
-- ====================================================================

-- 1. Klien OAuth yang terdaftar (mis. saat Claude.ai mendaftar sebagai
--    connector lewat Dynamic Client Registration)
CREATE TABLE IF NOT EXISTS public.mcp_oauth_clients (
    client_id TEXT PRIMARY KEY,
    client_secret_hash TEXT,
    client_name TEXT,
    redirect_uris TEXT[] NOT NULL,
    token_endpoint_auth_method TEXT NOT NULL DEFAULT 'none',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Kode otorisasi sementara (short-lived, sekali pakai) yang mengikat
--    sesi login Supabase pengguna ke satu percobaan alur OAuth
CREATE TABLE IF NOT EXISTS public.mcp_oauth_codes (
    code_hash TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES public.mcp_oauth_clients(client_id) ON DELETE CASCADE,
    redirect_uri TEXT NOT NULL,
    code_challenge TEXT,
    code_challenge_method TEXT,
    supabase_user_id UUID NOT NULL,
    supabase_refresh_token TEXT NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

-- 3. Token akses & refresh yang diberikan ke klien (mis. Claude.ai)
--    setelah pengguna berhasil login
CREATE TABLE IF NOT EXISTS public.mcp_oauth_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id TEXT NOT NULL REFERENCES public.mcp_oauth_clients(client_id) ON DELETE CASCADE,
    supabase_user_id UUID NOT NULL,
    supabase_refresh_token TEXT NOT NULL,
    access_token_hash TEXT NOT NULL,
    access_token_expires_at TIMESTAMPTZ NOT NULL,
    refresh_token_hash TEXT UNIQUE NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcp_oauth_tokens_access_hash ON public.mcp_oauth_tokens(access_token_hash);
CREATE INDEX IF NOT EXISTS idx_mcp_oauth_tokens_refresh_hash ON public.mcp_oauth_tokens(refresh_token_hash);
CREATE INDEX IF NOT EXISTS idx_mcp_oauth_codes_expires_at ON public.mcp_oauth_codes(expires_at);

-- 4. Kunci semua tabel ini dari akses langsung anon/authenticated key
ALTER TABLE public.mcp_oauth_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_oauth_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_oauth_tokens ENABLE ROW LEVEL SECURITY;
-- Sengaja TIDAK ada CREATE POLICY di sini. Tanpa policy, RLS menolak
-- semua akses kecuali dari service_role (dipakai oleh /api/oauth/* dan
-- /api/mcp lewat SUPABASE_SERVICE_ROLE_KEY).
