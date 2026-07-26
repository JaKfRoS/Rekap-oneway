import React, { useState } from 'react';
import { 
  LogIn, 
  UserPlus, 
  Mail, 
  Lock, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Eye, 
  EyeOff, 
  TrendingUp, 
  BarChart3, 
  Receipt, 
  Code2, 
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { getSupabaseClient } from '../utils/supabaseClient';

interface LoginPageProps {
  onLoginSuccess: () => void;
  onOpenSqlModal: () => void;
  onUseDemoMode: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ 
  onLoginSuccess, 
  onOpenSqlModal,
  onUseDemoMode
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!email || !password) {
      setErrorMsg('Harap isi Email dan Password dengan lengkap.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password minimal 6 karakter.');
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      setErrorMsg('Koneksi database Supabase tidak terdeteksi. Silakan periksa konfigurasi.');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        });

        if (error) {
          if (error.message.toLowerCase().includes('invalid login credentials')) {
            setErrorMsg('Email atau Password tidak cocok. Silakan periksa kembali.');
          } else if (error.message.toLowerCase().includes('email not confirmed')) {
            setErrorMsg('Email belum dikonfirmasi. Periksa kotak masuk/spam email Anda atau coba daftar ulang.');
          } else {
            setErrorMsg(`Gagal masuk: ${error.message}`);
          }
        } else if (data.user) {
          setSuccessMsg('Login berhasil! Mengalihkan ke Buku Kas...');
          setTimeout(() => {
            onLoginSuccess();
          }, 500);
        }
      } else {
        // Mode Register
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password,
        });

        if (error) {
          setErrorMsg(`Gagal mendaftar: ${error.message}`);
        } else if (data.user) {
          if (data.session) {
            setSuccessMsg('Pendaftaran akun berhasil! Anda langsung masuk ke sistem.');
            setTimeout(() => {
              onLoginSuccess();
            }, 800);
          } else {
            setSuccessMsg('Pendaftaran berhasil! Jika memerlukan konfirmasi email, silakan periksa email Anda, atau gunakan email aktif untuk masuk.');
            setTimeout(() => {
              setMode('login');
            }, 1500);
          }
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan pada server auth.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between selection:bg-emerald-500 selection:text-white">
      
      {/* Top Header Bar */}
      <header className="border-b border-slate-800/80 bg-slate-950/50 backdrop-blur-md px-6 py-4 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white border border-slate-700 rounded-xl flex items-center justify-center p-1 shadow-xs">
            <img src="/favicon.svg" alt="KasUsaha" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
              KASUSAHA
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-extrabold px-2 py-0.5 rounded-full border border-emerald-500/30">v2.5</span>
            </h1>
            <p className="text-[11px] text-slate-400">Aplikasi Pembukuan Keuangan Usaha Multi-User</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenSqlModal}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition-all"
          >
            <Code2 className="w-4 h-4 text-indigo-400" />
            <span className="hidden sm:inline">Script SQL Supabase</span>
          </button>
        </div>
      </header>

      {/* Main Content Split View */}
      <main className="flex-1 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 px-6 py-8 md:py-12 items-center">
        
        {/* Left Side: Product Showcase & Features */}
        <div className="lg:col-span-7 space-y-8 pr-0 lg:pr-6">
          
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
              <Sparkles className="w-4 h-4" />
              <span>Sistem Akses Multi-Pengguna Terpisah & Aman</span>
            </div>
            
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight tracking-tight">
              Kelola Transaksi Usaha Anda <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-200">Lebih Rapi & Terstruktur</span>
            </h2>
            
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
              Catat setiap pemasukan, pengeluaran, pembayaran DP/uang muka, serta pelunasan piutang usaha Anda secara langsung. Data Anda aman dan dapat diakses dari perangkat mana pun secara real-time.
            </p>
          </div>

          {/* Key Features Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 backdrop-blur-xs flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Dasbor Ringkasan Otomatis</h3>
                <p className="text-xs text-slate-400 mt-0.5">Statistik Omset, Pengeluaran, Laba Bersih, dan Piutang dalam satu tampilan.</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 backdrop-blur-xs flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/30">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Privasi Data Multi-User</h3>
                <p className="text-xs text-slate-400 mt-0.5">Setiap pemilik akun hanya dapat mengakses data catatan usahanya sendiri.</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 backdrop-blur-xs flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Kelola DP & Pelunasan</h3>
                <p className="text-xs text-slate-400 mt-0.5">Dukungan status Lunas, Belum Lunas, dan Pembayaran DP dengan kalkulasi otomatis.</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 backdrop-blur-xs flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center shrink-0 border border-teal-500/30">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Laporan & Ekspor Data</h3>
                <p className="text-xs text-slate-400 mt-0.5">Cetak nota transaksi dan ekspor laporan keuangan periodik dengan mudah.</p>
              </div>
            </div>

          </div>

        </div>

        {/* Right Side: Auth Form Card */}
        <div className="lg:col-span-5 w-full max-w-md mx-auto">
          <div className="bg-white text-slate-800 rounded-3xl shadow-2xl overflow-hidden border border-slate-100 p-6 sm:p-8 space-y-6">
            
            {/* Header Form */}
            <div className="text-center space-y-1">
              <h3 className="text-xl font-black text-slate-900">
                {mode === 'login' ? 'Masuk ke Akun Usaha Anda' : 'Buat Akun KasUsaha Baru'}
              </h3>
              <p className="text-xs text-slate-500">
                {mode === 'login' 
                  ? 'Masukkan email dan password untuk mengakses pembukuan Anda.' 
                  : 'Daftar sekarang untuk mulai mencatat keuangan usaha Anda.'}
              </p>
            </div>

            {/* Mode Switch Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => { setMode('login'); setErrorMsg(''); setSuccessMsg(''); }}
                className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  mode === 'login' 
                    ? 'bg-white text-emerald-700 shadow-xs' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <LogIn className="w-4 h-4" />
                Masuk
              </button>
              <button
                type="button"
                onClick={() => { setMode('register'); setErrorMsg(''); setSuccessMsg(''); }}
                className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  mode === 'register' 
                    ? 'bg-white text-emerald-700 shadow-xs' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                Daftar Akun
              </button>
            </div>

            {/* Alert Messages */}
            {errorMsg && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl flex items-start gap-2.5 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span className="leading-relaxed">{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-2xl flex items-start gap-2.5 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                <span className="leading-relaxed">{successMsg}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Alamat Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input 
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contoh: usaha@gmail.com"
                    required
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:border-emerald-600 focus:bg-white transition-all text-slate-800 placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input 
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:border-emerald-600 focus:bg-white transition-all text-slate-800 placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 p-0.5 rounded-lg"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Minimal 6 karakter</p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : mode === 'login' ? (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Masuk Ke Pembukuan</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Daftar Akun Baru</span>
                  </>
                )}
              </button>

            </form>

            <div className="pt-2 border-t border-slate-100 space-y-3 text-center">
              <p className="text-xs text-slate-500">
                Atau ingin mencoba fitur aplikasi terlebih dahulu?
              </p>
              <button
                type="button"
                onClick={onUseDemoMode}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Coba Mode Demo / Penyimpanan Lokal</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
              </button>
            </div>

          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/60 py-4 text-center text-xs text-slate-500">
        <p>© 2026 KASUSAHA — Platform Pembukuan Sederhana & Multi-User</p>
      </footer>

    </div>
  );
};
