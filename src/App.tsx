import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  Receipt, 
  FilePieChart, 
  TrendingUp,
  TrendingDown,
  Scale,
  RefreshCw,
  Wallet,
  Menu,
  X,
  UserCheck,
  LogIn,
  LogOut,
  Database,
  Sparkles,
  PlusCircle
} from 'lucide-react';
import { Transaction } from './utils/dummyData';
import { 
  getTransactions, 
  addTransaction, 
  updateTransaction, 
  deleteTransaction,
  clearAllData,
  getSupabaseClient
} from './utils/supabaseClient';
import { fetchCategoriesAsync } from './utils/categories';
import { Trash2 } from 'lucide-react';
import { formatIDR, getActualIncomeAmount } from './utils/formatters';

// Component imports
import Dashboard from './components/Dashboard';
import Transactions from './components/Transactions';
import Reports from './components/Reports';
import { AuthModal } from './components/AuthModal';
import { SqlModal } from './components/SqlModal';
import { LoginPage } from './components/LoginPage';

type TabId = 'dashboard' | 'transactions' | 'reports';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState<'supabase' | 'local'>('local');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Auth and Modals State
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);

  // Mobile menu open state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Quick action trigger for modal pop-up from mobile bottom nav bar
  const [autoOpenType, setAutoOpenType] = useState<'income' | 'expense' | null>(null);

  // Edit Transaction state mapping across sections
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Ref guard to prevent overlapping loadData calls and stale closures
  const isFetchingRef = useRef<boolean>(false);
  const currentUserRef = useRef<any>(currentUser);
  const isDemoModeRef = useRef<boolean>(isDemoMode);

  useEffect(() => {
    currentUserRef.current = currentUser;
    isDemoModeRef.current = isDemoMode;
  }, [currentUser, isDemoMode]);

  // Fetch transactions on load and whenever config changes
  const loadData = async (demoOverride?: boolean, userOverride?: any, force: boolean = false, silent: boolean = false) => {
    const activeDemo = demoOverride !== undefined ? demoOverride : isDemoModeRef.current;
    const activeUser = userOverride !== undefined ? userOverride : currentUserRef.current;

    if (isFetchingRef.current && !force) return;
    isFetchingRef.current = true;
    if (!silent) {
      setLoading(true);
      setErrorMsg(null);
    }
    try {
      // Sync categories from database in background
      fetchCategoriesAsync(activeUser?.id).catch(() => {});

      const res = await getTransactions(activeDemo, activeUser?.id);
      setTransactions(res.data || []);
      setDataSource(activeDemo ? 'local' : res.source);
      if (res.error && !silent) {
        setErrorMsg(res.error);
      }
    } catch (err: any) {
      console.error(err);
      if (!silent) {
        setErrorMsg('Gagal memuat transaksi.');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    // Safety fallback timeout to ensure auth check never blocks forever
    const authFallbackTimeout = setTimeout(() => {
      setIsAuthChecking(false);
    }, 2500);

    // Listen to Supabase Auth State
    const supabase = getSupabaseClient();
    let authListener: any = null;

    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        const user = session?.user ?? null;
        setCurrentUser(user);
        currentUserRef.current = user;
        setIsAuthChecking(false);
        clearTimeout(authFallbackTimeout);
        loadData(false, user);
      }).catch(() => {
        setIsAuthChecking(false);
        clearTimeout(authFallbackTimeout);
        loadData(isDemoModeRef.current, currentUserRef.current);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        const user = session?.user ?? null;
        setCurrentUser(user);
        currentUserRef.current = user;
        setTransactions([]);
        if (user) {
          setIsDemoMode(false);
          isDemoModeRef.current = false;
        }
        setIsAuthChecking(false);
        clearTimeout(authFallbackTimeout);
        loadData(user ? false : isDemoModeRef.current, user, true);
      });
      authListener = subscription;
    } else {
      setIsAuthChecking(false);
      clearTimeout(authFallbackTimeout);
      loadData(isDemoModeRef.current, currentUserRef.current);
    }

    // Re-fetch data automatically when user switches back to this tab or comes online
    const handleFocus = () => loadData(isDemoModeRef.current, currentUserRef.current, false, true);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleFocus);

    // Attach Realtime Supabase Subscription if connected
    let channel: any = null;
    if (supabase) {
      try {
        channel = supabase
          .channel('db-realtime-sync')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
            loadData(isDemoModeRef.current, currentUserRef.current, true, true);
          })
          .subscribe();
      } catch (e) {
        console.warn("Realtime subscription notice:", e);
      }
    }

    // Ensure favicon is applied and updated in browser tab using SVG
    try {
      const existingFavicons = document.querySelectorAll("link[rel*='icon']");
      existingFavicons.forEach(el => el.remove());

      const svgFaviconUrl = '/favicon.svg?v=3';

      const link = document.createElement('link');
      link.type = 'image/svg+xml';
      link.rel = 'icon';
      link.href = svgFaviconUrl;
      document.head.appendChild(link);

      const shortcutLink = document.createElement('link');
      shortcutLink.type = 'image/svg+xml';
      shortcutLink.rel = 'shortcut icon';
      shortcutLink.href = svgFaviconUrl;
      document.head.appendChild(shortcutLink);
    } catch (e) {
      console.error(e);
    }

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleFocus);
      if (authListener) authListener.unsubscribe();
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  const handleLogout = async () => {
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    setCurrentUser(null);
    setIsDemoMode(false);
    setTransactions([]);
  };

  // CRUD Operations
  const handleAddTransaction = async (newTx: Omit<Transaction, 'id' | 'created_at'>) => {
    try {
      const res = await addTransaction(newTx, isDemoMode, currentUser?.id);
      if (res.success && res.data) {
        const created = res.data;
        // Optimistically update React state immediately
        setTransactions(prev => [created, ...prev.filter(t => t.id !== created.id)]);
        // Non-blocking silent background sync
        loadData(isDemoMode, currentUser, true, true);
      } else {
        alert(`Gagal menambah transaksi: ${res.error}`);
      }
    } catch (e: any) {
      alert(`Terjadi kesalahan: ${e.message || e}`);
    }
  };

  const handleUpdateTransaction = async (updatedTx: Transaction) => {
    try {
      const res = await updateTransaction(updatedTx, isDemoMode, currentUser?.id);
      if (res.success && res.data) {
        const updated = res.data;
        // Optimistically update React state immediately
        setTransactions(prev => prev.map(t => t.id === updated.id ? updated : t));
        // Non-blocking silent background sync
        loadData(isDemoMode, currentUser, true, true);
      } else {
        alert(`Gagal memperbarui transaksi: ${res.error}`);
      }
    } catch (e: any) {
      alert(`Terjadi kesalahan: ${e.message || e}`);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      const res = await deleteTransaction(id, isDemoMode, currentUser?.id);
      if (res.success) {
        // Optimistically update React state immediately
        setTransactions(prev => prev.filter(t => t.id !== id));
        // Non-blocking silent background sync
        loadData(isDemoMode, currentUser, true, true);
      } else {
        alert(`Gagal menghapus transaksi: ${res.error}`);
      }
    } catch (e: any) {
      alert(`Terjadi kesalahan: ${e.message || e}`);
    }
  };

  const handleResetAllData = async () => {
    if (window.confirm('Apakah Anda yakin ingin MENGHAPUS SEMUA DATA transaksi? Semua catatan pemasukan dan pengeluaran Anda akan dikosongkan secara permanen.')) {
      setLoading(true);
      try {
        await clearAllData(isDemoMode, currentUser?.id);
        setTransactions([]);
        await loadData(isDemoMode, currentUser, true);
        alert('Semua data transaksi telah berhasil dihapus!');
      } catch (e: any) {
        alert(`Gagal menghapus data: ${e.message || e}`);
      } finally {
        setLoading(false);
      }
    }
  };



  // Quick Global Balances Header Card
  const globalBalances = React.useMemo(() => {
    let income = 0;
    let expense = 0;
    transactions.forEach(t => {
      if (t.type === 'income') {
        income += getActualIncomeAmount(t);
      } else {
        expense += t.amount;
      }
    });
    return {
      income,
      expense,
      balance: income - expense
    };
  }, [transactions]);

  // Navigate to edit in transactions tab
  const handleEditFromDashboard = (tx: Transaction) => {
    setEditingTransaction(tx);
    setActiveTab('transactions');
  };

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center p-1.5 shadow-xl mb-4 animate-bounce">
          <img src="/favicon.svg" alt="KasUsaha" className="w-full h-full object-contain" />
        </div>
        <p className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
          Memeriksa Sesi Akun...
        </p>
      </div>
    );
  }

  if (!currentUser && !isDemoMode) {
    return (
      <>
        <LoginPage 
          onLoginSuccess={() => {
            setIsDemoMode(false);
            loadData();
          }}
          onOpenSqlModal={() => setIsSqlModalOpen(true)}
          onUseDemoMode={() => {
            setIsDemoMode(true);
            loadData(true, null);
          }}
        />
        <SqlModal 
          isOpen={isSqlModalOpen} 
          onClose={() => setIsSqlModalOpen(false)} 
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 antialiased">
      
      {/* Main Header */}
      <header className="bg-white border-b border-slate-100 shadow-xs sticky top-0 z-40 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            
            {/* Logo / Brand */}
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
              <div className="w-10 h-10 bg-white border border-slate-200/80 rounded-xl flex items-center justify-center shadow-xs hover:shadow transition-all overflow-hidden p-1">
                <img 
                  src="/favicon.svg" 
                  alt="Logo KasUsaha" 
                  className="w-full h-full object-contain rounded-lg" 
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <span className="block font-black text-slate-900 leading-none text-base tracking-tight">KASUSAHA</span>
                <p className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Aplikasi pembukuan usaha sederhana</p>
              </div>
            </div>

            {/* Quick Balance indicators (Desktop Only) */}
            <div className="hidden lg:flex items-center gap-6">
              
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><TrendingUp className="w-4 h-4" /></span>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase leading-none">Pemasukan</span>
                  <span className="text-xs font-bold text-slate-700">{formatIDR(globalBalances.income)}</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-rose-50 text-rose-600 rounded-lg"><TrendingDown className="w-4 h-4" /></span>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase leading-none">Pengeluaran</span>
                  <span className="text-xs font-bold text-slate-700">{formatIDR(globalBalances.expense)}</span>
                </div>
              </div>

              <div className="h-8 w-px bg-slate-200"></div>

              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Scale className="w-4 h-4" /></span>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase leading-none">Saldo Kas</span>
                  <span className={`text-xs font-bold ${globalBalances.balance >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                    {formatIDR(globalBalances.balance)}
                  </span>
                </div>
              </div>

            </div>

            {/* Navigation Tabs & Auth Actions (Desktop Only) */}
            <div className="hidden md:flex items-center gap-3">
              <nav className="flex space-x-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/50">
                {[
                  { id: 'dashboard', label: 'Dasbor', icon: LayoutDashboard },
                  { id: 'transactions', label: 'Transaksi', icon: Receipt },
                  { id: 'reports', label: 'Laporan', icon: FilePieChart }
                ].map(tab => {
                  const IconComp = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id as TabId);
                        setMobileMenuOpen(false);
                      }}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        activeTab === tab.id 
                          ? 'bg-white text-indigo-600 shadow-xs' 
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <IconComp className="w-4 h-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>

              {/* Reset Data Icon Button */}
              <button
                onClick={handleResetAllData}
                title="Hapus / Reset Seluruh Data Transaksi"
                aria-label="Hapus Semua Data"
                className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-all border border-rose-200/60 cursor-pointer shadow-xs hover:scale-105 active:scale-95 shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              {/* User Auth Status Icon Buttons */}
              {currentUser ? (
                <div className="flex items-center gap-1 bg-slate-100/90 border border-slate-200/80 p-1 rounded-xl shrink-0">
                  <div 
                    className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg cursor-help flex items-center justify-center"
                    title={`Terhubung: ${currentUser.email}`}
                  >
                    <UserCheck className="w-4 h-4 text-emerald-600" />
                  </div>
                  <button
                    onClick={handleLogout}
                    title={`Keluar dari Akun (${currentUser.email})`}
                    aria-label="Keluar"
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : isDemoMode ? (
                <div className="flex items-center gap-1 bg-slate-100/90 border border-slate-200/80 p-1 rounded-xl shrink-0">
                  <div 
                    className="px-2 py-1 bg-amber-50 text-amber-800 rounded-lg text-[10px] font-extrabold border border-amber-200/60 flex items-center gap-1 cursor-help"
                    title="Mode Demo (Data Lokal)"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                    <span>Demo</span>
                  </div>
                  <button
                    onClick={() => setIsDemoMode(false)}
                    title="Masuk ke Akun Cloud"
                    aria-label="Masuk"
                    className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all shadow-xs cursor-pointer"
                  >
                    <LogIn className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  title="Masuk / Daftar Akun"
                  aria-label="Masuk / Daftar"
                  className="p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all shadow-xs hover:scale-105 active:scale-95 cursor-pointer shrink-0"
                >
                  <LogIn className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Mobile Hamburger menu toggle */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl outline-none"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* Mobile Drawer Navigation Panel */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-slate-200 shadow-md p-4 space-y-3 no-print animate-fade-in">
          
          {/* Quick Stats Grid in Mobile Drawer */}
          <div className="grid grid-cols-3 gap-2 pb-4 border-b border-slate-100 text-center">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <span className="block text-[9px] font-bold text-emerald-600 uppercase">Masuk</span>
              <span className="text-[10px] font-extrabold text-slate-700">{formatIDR(globalBalances.income)}</span>
            </div>
            <div className="p-2 bg-rose-50 rounded-lg">
              <span className="block text-[9px] font-bold text-rose-600 uppercase">Keluar</span>
              <span className="text-[10px] font-extrabold text-slate-700">{formatIDR(globalBalances.expense)}</span>
            </div>
            <div className="p-2 bg-indigo-50 rounded-lg">
              <span className="block text-[9px] font-bold text-indigo-600 uppercase">Saldo</span>
              <span className="text-[10px] font-extrabold text-slate-700">{formatIDR(globalBalances.balance)}</span>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="space-y-1">
            {[
              { id: 'dashboard', label: 'Dasbor Rekapan', icon: LayoutDashboard },
              { id: 'transactions', label: 'Catat & Kelola Transaksi', icon: Receipt },
              { id: 'reports', label: 'Ekspor & Cetak Laporan', icon: FilePieChart }
            ].map(tab => {
              const IconComp = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as TabId);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all cursor-pointer ${
                    activeTab === tab.id 
                      ? 'bg-indigo-50 text-indigo-700' 
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <IconComp className="w-5 h-5 shrink-0" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">

            <button
              onClick={() => { handleResetAllData(); setMobileMenuOpen(false); }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-50 text-rose-700 rounded-xl font-bold text-xs"
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>Hapus / Bersihkan Semua Data</span>
            </button>

            {currentUser ? (
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex items-center gap-2 min-w-0">
                  <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-xs font-bold text-slate-700 truncate">{currentUser.email}</span>
                </div>
                <button
                  onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                  className="px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Keluar</span>
                </button>
              </div>
            ) : isDemoMode ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-amber-900">Mode Demo (Lokal)</span>
                  <span className="text-[10px] text-amber-700">Penyimpanan Browser</span>
                </div>
                <button
                  onClick={() => { setIsDemoMode(false); setMobileMenuOpen(false); }}
                  className="w-full py-2 bg-emerald-600 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Masuk ke Akun Cloud</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setIsAuthModalOpen(true); setMobileMenuOpen(false); }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl font-bold text-xs shadow-xs cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Masuk / Daftar Akun</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-28 md:pb-8">
        
        {/* Error Notification Toast/Banner */}
        {errorMsg && (
          <div className="mb-6 bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-xl flex items-start gap-3 text-xs md:text-sm no-print shadow-xs animate-fade-in">
            <span className="p-1 bg-amber-500 text-white rounded-lg font-bold shrink-0">!</span>
            <div className="space-y-1">
              <p className="font-bold">Pemberitahuan Sistem</p>
              <p className="opacity-90">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Global Loading Spinner */}
        {loading && (
          <div className="fixed inset-0 bg-slate-900/10 backdrop-blur-xs flex items-center justify-center z-50 no-print">
            <div className="bg-white p-5 rounded-2xl shadow-xl flex items-center gap-3 border border-slate-200">
              <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin" />
              <span className="text-sm font-bold text-slate-800">Loading ...</span>
            </div>
          </div>
        )}

        {/* Active Tab Screen */}
        <div className="transition-all duration-200">
          
          {activeTab === 'dashboard' && (
            <Dashboard 
              transactions={transactions} 
              onNavigateToTransactions={() => setActiveTab('transactions')}
              onEditTransaction={handleEditFromDashboard}
            />
          )}

          {activeTab === 'transactions' && (
            <Transactions 
              transactions={transactions}
              onAddTransaction={handleAddTransaction}
              onUpdateTransaction={handleUpdateTransaction}
              onDeleteTransaction={handleDeleteTransaction}
              editingTransaction={editingTransaction}
              setEditingTransaction={setEditingTransaction}
              userId={currentUser?.id}
              autoOpenType={autoOpenType}
              onCloseAutoOpen={() => setAutoOpenType(null)}
            />
          )}

          {activeTab === 'reports' && (
            <Reports transactions={transactions} />
          )}

        </div>

      </main>

      {/* Mobile Bottom Navigation Bar (Optimized for One-Hand Mobile Thumb Navigation) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-2xl px-3 py-2 flex items-center justify-around no-print">
        {/* Item 1: Dasbor */}
        <button
          onClick={() => {
            setActiveTab('dashboard');
            setMobileMenuOpen(false);
          }}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === 'dashboard' 
              ? 'text-indigo-600 font-extrabold scale-105' 
              : 'text-slate-400 hover:text-slate-600 font-medium'
          }`}
        >
          <LayoutDashboard className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Dasbor</span>
        </button>

        {/* Item 2: Transaksi */}
        <button
          onClick={() => {
            setActiveTab('transactions');
            setMobileMenuOpen(false);
          }}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === 'transactions' 
              ? 'text-indigo-600 font-extrabold scale-105' 
              : 'text-slate-400 hover:text-slate-600 font-medium'
          }`}
        >
          <Receipt className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Transaksi</span>
        </button>

        {/* Center Prominent Quick Add FAB: + Catat */}
        <button
          onClick={() => {
            setActiveTab('transactions');
            setAutoOpenType('income');
            setMobileMenuOpen(false);
          }}
          className="flex flex-col items-center justify-center -mt-6 cursor-pointer group"
          title="Catat Transaksi Baru"
        >
          <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30 group-active:scale-95 transition-all ring-4 ring-white">
            <PlusCircle className="w-7 h-7" />
          </div>
          <span className="text-[10px] font-extrabold text-emerald-700 mt-0.5">+ Catat</span>
        </button>

        {/* Item 3: Laporan */}
        <button
          onClick={() => {
            setActiveTab('reports');
            setMobileMenuOpen(false);
          }}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === 'reports' 
              ? 'text-indigo-600 font-extrabold scale-105' 
              : 'text-slate-400 hover:text-slate-600 font-medium'
          }`}
        >
          <FilePieChart className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Laporan</span>
        </button>

        {/* Item 4: Menu */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer ${
            mobileMenuOpen 
              ? 'text-indigo-600 font-extrabold scale-105' 
              : 'text-slate-400 hover:text-slate-600 font-medium'
          }`}
        >
          <Menu className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Menu</span>
        </button>
      </nav>

      {/* Auth Modal & SQL Guide Modal */}
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        onSuccess={() => loadData()} 
      />

      <SqlModal 
        isOpen={isSqlModalOpen} 
        onClose={() => setIsSqlModalOpen(false)} 
      />

      {/* Standard Footer */}
      <footer className="bg-white border-t border-slate-100 py-6 mt-12 text-center text-xs text-slate-400 no-print">
        <div className="max-w-7xl mx-auto px-4">
          <p className="font-medium">KasUsaha &bull; Bebas ribet, kelola kas jadi lebih jelas.</p>
          <p className="mt-1 opacity-80">&copy; 2026 OneWay media. All rights reserved.</p>
        </div>
      </footer>

    </div>
  );
}
