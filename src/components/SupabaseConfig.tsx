import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Settings, 
  Terminal, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Copy, 
  Check, 
  AlertTriangle,
  Info,
  Server
} from 'lucide-react';
import { 
  getSupabaseConfig, 
  saveSupabaseConfig, 
  getSupabaseClient, 
  syncLocalToSupabase 
} from '../utils/supabaseClient';

interface SupabaseConfigProps {
  onConfigChanged: () => void;
}

export default function SupabaseConfig({ onConfigChanged }: SupabaseConfigProps) {
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [isEnabled, setIsEnabled] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Connection Test State
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Sync State
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'failed'>('idle');
  const [syncCount, setSyncCount] = useState(0);

  // Load existing config
  useEffect(() => {
    const config = getSupabaseConfig();
    setUrl(config.url);
    setAnonKey(config.anonKey);
    setIsEnabled(config.isEnabled);
  }, []);

  // SQL Script
  const sqlScript = `CREATE TABLE transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  date DATE NOT NULL,
  type VARCHAR(10) CHECK (type IN ('income', 'expense')) NOT NULL,
  category VARCHAR(50) NOT NULL,
  client_name VARCHAR(255),
  amount NUMERIC NOT NULL,
  payment_status VARCHAR(20) DEFAULT 'paid' CHECK (payment_status IN ('paid', 'unpaid', 'partial')),
  notes TEXT
);

-- Opsional: Matikan RLS untuk kemudahan akses atau buat kebijakan RLS bebas
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Akses Publik Transaksi" 
ON transactions FOR ALL 
USING (true) 
WITH CHECK (true);`;

  const handleCopySQL = () => {
    navigator.clipboard.writeText(sqlScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    setTestStatus('idle');
    setErrorMessage('');
    
    saveSupabaseConfig({
      url: url.trim(),
      anonKey: anonKey.trim(),
      isEnabled
    });
    
    onConfigChanged();
  };

  const handleTestConnection = async () => {
    if (!url.trim() || !anonKey.trim()) {
      setTestStatus('failed');
      setErrorMessage('Harap isi URL dan Anon Key terlebih dahulu.');
      return;
    }

    setTestStatus('testing');
    setErrorMessage('');

    try {
      // Temporarily initialize client directly to test
      const tempConfig = { url: url.trim(), anonKey: anonKey.trim(), isEnabled: true };
      const client = getSupabaseClient(); // Wait, let's use a newly constructed client to test
      
      const { createClient } = await import('@supabase/supabase-js');
      const testClient = createClient(tempConfig.url, tempConfig.anonKey);

      // Perform light select query to test connection
      const { data, error } = await testClient
        .from('transactions')
        .select('id')
        .limit(1);

      if (error) {
        throw error;
      }

      setTestStatus('success');
    } catch (err: any) {
      console.error(err);
      setTestStatus('failed');
      setErrorMessage(err.message || 'Gagal terhubung. Pastikan tabel "transactions" sudah dibuat dan kebijakan RLS diijinkan.');
    }
  };

  const handleSyncData = async () => {
    setSyncStatus('syncing');
    setSyncCount(0);
    
    try {
      const result = await syncLocalToSupabase();
      if (result.success) {
        setSyncStatus('success');
        setSyncCount(result.count);
        onConfigChanged(); // Refresh parent database
      } else {
        throw new Error(result.error);
      }
    } catch (err: any) {
      setSyncStatus('failed');
      setErrorMessage(err.message || 'Gagal sinkronisasi data.');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" id="supabase-config-section">
      
      {/* Introduction Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-indigo-600 font-bold">
            <Database className="w-5 h-5" />
            <span>Konektivitas Cloud Database (Supabase)</span>
          </div>
          <h2 className="text-xl font-bold text-slate-800">Hubungkan Pembukuan ke Cloud</h2>
          <p className="text-sm text-slate-500 max-w-xl">
            Secara default, aplikasi menyimpan data secara aman di browser lokal Anda (Offline-First). 
            Aktifkan integrasi Supabase di bawah untuk menyimpan data di database cloud PostgreSQL Anda sendiri secara real-time!
          </p>
        </div>
        
        {/* Status Badge */}
        <div className="shrink-0 flex items-center gap-3">
          <div className={`p-4 rounded-2xl flex flex-col items-center justify-center border text-center min-w-[140px] ${
            isEnabled && url && anonKey 
              ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
              : 'bg-amber-50 border-amber-100 text-amber-800'
          }`}>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Mode Sistem</span>
            <span className="text-sm font-black mt-1 flex items-center gap-1">
              <span className={`w-2.5 h-2.5 rounded-full inline-block animate-pulse ${
                isEnabled && url && anonKey ? 'bg-emerald-500' : 'bg-amber-500'
              }`}></span>
              {isEnabled && url && anonKey ? 'SUPABASE CLOUD' : 'LOKAL (OFFLINE)'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Configuration Form Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-50 pb-3 mb-2">
            <Settings className="w-4 h-4 text-slate-500" />
            <h3 className="font-bold text-slate-800 text-base">Pengaturan Kredensial</h3>
          </div>

          <form onSubmit={handleSaveConfig} className="space-y-4">
            {/* Input URL */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Supabase Project URL</label>
              <input
                type="url"
                required={isEnabled}
                placeholder="https://your-project.supabase.co"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all"
              />
            </div>

            {/* Input Anon Key */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Supabase Anon Key</label>
              <textarea
                required={isEnabled}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your-anon-key..."
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                rows={3}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all"
              />
            </div>

            {/* Enable switch */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="space-y-0.5">
                <span className="block text-xs font-bold text-slate-700">Aktifkan Sinkronisasi Cloud</span>
                <span className="block text-[10px] text-slate-400">Hubungkan pembacaan dan penulisan transaksi langsung ke Supabase</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={isEnabled} 
                  onChange={(e) => setIsEnabled(e.target.checked)}
                  className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* Feedback messages */}
            {testStatus === 'success' && (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 text-emerald-800 p-3 rounded-xl text-xs font-semibold">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>Koneksi berhasil diuji! Database tersambung dengan sukses.</span>
              </div>
            )}
            {testStatus === 'failed' && (
              <div className="flex items-start gap-2 bg-rose-50 border border-rose-100 text-rose-800 p-3 rounded-xl text-xs">
                <XCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="font-bold">Gagal Terhubung</p>
                  <p className="text-[11px] leading-relaxed opacity-90">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleTestConnection}
                className="flex-1 py-2.5 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Uji Koneksi
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                Simpan Konfigurasi
              </button>
            </div>

          </form>

          {/* Sync Box (Available only if configured and enabled) */}
          {isEnabled && url && anonKey && (
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl space-y-3">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
                  <p className="text-[11px] leading-relaxed text-indigo-900 font-medium">
                    Sinkronisasikan transaksi lokal yang telah dicatat offline ke cloud Supabase agar data Anda menyatu dengan aman.
                  </p>
                </div>
                
                {syncStatus === 'success' && (
                  <div className="bg-white text-emerald-800 p-2.5 rounded-lg border border-emerald-100 text-xs font-bold flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>{syncCount} Transaksi offline berhasil disinkronkan ke Cloud!</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSyncData}
                  disabled={syncStatus === 'syncing'}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                  {syncStatus === 'syncing' ? 'Menyinkronkan...' : 'Sinkronkan Kas Offline ke Supabase'}
                </button>
              </div>
            </div>
          )}

        </div>

        {/* SQL Script / DDL Instructions */}
        <div className="bg-slate-900 p-6 rounded-2xl shadow-xs text-slate-200 space-y-4 flex flex-col justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
              <Terminal className="w-4 h-4" />
              <span>Instruksi SQL Setup</span>
            </div>
            <h3 className="font-bold text-white text-base">Inisialisasi Tabel Supabase</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Jalankan kueri SQL di bawah ini di bagian <strong>SQL Editor</strong> dasbor Supabase Anda 
              untuk membuat struktur tabel <code>transactions</code> beserta kebijakan keamanannya.
            </p>
          </div>

          {/* SQL Block */}
          <div className="relative mt-2 flex-1">
            <pre className="bg-slate-950 p-4 rounded-xl text-[10px] font-mono leading-relaxed text-slate-300 overflow-x-auto max-h-[220px] border border-slate-800">
              {sqlScript}
            </pre>
            <button
              onClick={handleCopySQL}
              className="absolute top-2.5 right-2.5 p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
              title="Salin SQL Script"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="text-[9px] font-bold">{copied ? 'Tersalin' : 'Salin'}</span>
            </button>
          </div>

          <div className="p-3.5 bg-slate-800/40 border border-slate-800 rounded-xl flex gap-3 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-slate-400 text-[11px] leading-relaxed">
              <strong>Penting:</strong> Supabase mewajibkan pencocokan skema tipe data secara tepat. 
              Gunakan script di atas tanpa modifikasi nama kolom agar sinkronisasi dan pembacaan berjalan sempurna.
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
