# KasUsaha lewat Chat (MCP Server)

Folder `api/` menambahkan MCP server (Model Context Protocol) ke aplikasi
ini, supaya KasUsaha bisa dihubungkan sebagai **custom connector** di
Claude.ai — sehingga transaksi, kategori, dan ringkasan keuangan bisa
diakses & diubah langsung lewat chat, dari perangkat mana saja.

Server ini jalan sebagai Vercel Serverless Functions di domain yang sama
dengan aplikasi web KasUsaha (tidak perlu hosting terpisah).

## 1. Jalankan migrasi SQL

Buka **Supabase Dashboard → SQL Editor → New query**, salin seluruh isi
file [`mcp_setup.sql`](./mcp_setup.sql), tempel, lalu klik **Run**.

Skrip ini membuat 3 tabel baru (`mcp_oauth_clients`, `mcp_oauth_codes`,
`mcp_oauth_tokens`) yang dipakai server untuk menyimpan pendaftaran
aplikasi chat dan token akses. Tabel-tabel ini dikunci dengan RLS tanpa
policy sama sekali — hanya bisa diakses lewat Service Role Key di server,
**tidak pernah** lewat anon key dari browser.

Aman dijalankan berkali-kali dan tidak menyentuh data transaksi/kategori
yang sudah ada.

## 2. Tambahkan Service Role Key di Vercel

Server butuh **Supabase Service Role Key** untuk mengelola tabel OAuth di
atas (kunci ini berbeda dari anon key yang sudah dipakai di aplikasi web).

1. Buka **Supabase Dashboard → Settings → API**.
2. Salin nilai **`service_role` secret** (bukan `anon` key).
3. Buka **Vercel Dashboard → Project KasUsaha → Settings → Environment Variables**.
4. Tambahkan variable baru:
   - Name: `SUPABASE_SERVICE_ROLE_KEY`
   - Value: (paste service role key dari langkah 2)
   - Environment: Production (dan Preview jika perlu)
5. **Redeploy** project agar environment variable ini terbaca.

> ⚠️ Kunci ini sangat sensitif — jangan pernah menaruhnya di kode, commit
> git, atau di sisi frontend. Hanya boleh ada di Environment Variables
> Vercel.

## 3. Hubungkan sebagai Custom Connector di Claude.ai

1. Buka **claude.ai → Settings → Connectors → Add custom connector**.
2. Masukkan URL: `https://<domain-vercel-kamu>/api/mcp`
   (mis. `https://rekaponeway.vercel.app/api/mcp`)
3. Claude.ai akan mendaftarkan dirinya secara otomatis lalu mengarahkan
   kamu ke halaman login KasUsaha.
4. Masuk dengan **email & password akun KasUsaha yang sama** seperti yang
   kamu pakai di aplikasi web. Setelah berhasil, Claude.ai akan
   diarahkan kembali dan connector siap dipakai.

Semua akses lewat chat mengikuti aturan keamanan (RLS) yang sama seperti
aplikasi web — hanya bisa melihat/mengubah data milik akun yang login.

## Yang bisa dilakukan lewat chat

- **Lihat transaksi** (`list_transactions`) — dengan filter jenis,
  status pembayaran, kategori, rentang tanggal, atau pencarian teks.
- **Tambah transaksi** (`add_transaction`)
- **Ubah transaksi** (`update_transaction`)
- **Hapus transaksi** (`delete_transaction`)
- **Ringkasan keuangan** (`get_financial_summary`) — total pemasukan,
  pengeluaran, laba bersih, dan piutang pada rentang tanggal tertentu.
- **Lihat / tambah / ubah / hapus kategori** (`list_categories`,
  `add_category`, `update_category`, `delete_category`)

Contoh perintah chat: *"Catat pemasukan Rp 500.000 dari Klien Budi
kategori Jasa & Layanan hari ini, status lunas"*, atau *"Berapa laba
bersih bulan ini?"*.

## Catatan penting

Spesifikasi otorisasi MCP untuk connector remote termasuk hal yang masih
cukup baru dan terus berkembang. Alur di atas sudah diuji secara lokal
(pendaftaran client, validasi, endpoint metadata, dan penolakan akses
tanpa token semuanya berjalan sesuai standar), **tapi belum bisa diuji
end-to-end langsung terhadap Claude.ai** dari lingkungan pengembangan ini
karena keterbatasan akses jaringan & tidak adanya akun Supabase
live untuk proyek ini di sesi ini.

Kalau saat menghubungkan connector di Claude.ai ada error atau macet di
suatu langkah, **screenshot atau salin pesan errornya** dan kirim ke saya
— itu akan sangat membantu untuk debug cepat.
