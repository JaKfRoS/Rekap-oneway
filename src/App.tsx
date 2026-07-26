import React, { useState, useEffect } from 'react';
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
  X
} from 'lucide-react';
import { Transaction } from './utils/dummyData';
import { 
  getTransactions, 
  addTransaction, 
  updateTransaction, 
  deleteTransaction,
  getSupabaseClient
} from './utils/supabaseClient';
import { formatIDR, getActualIncomeAmount } from './utils/formatters';

// Component imports
import Dashboard from './components/Dashboard';
import Transactions from './components/Transactions';
import Reports from './components/Reports';

type TabId = 'dashboard' | 'transactions' | 'reports';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState<'supabase' | 'local'>('local');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Mobile menu open state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Edit Transaction state mapping across sections
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Fetch transactions on load and whenever config changes
  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await getTransactions();
      setTransactions(res.data);
      setDataSource(res.source);
      if (res.error) {
        setErrorMsg(res.error);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Gagal memuat transaksi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Re-fetch data automatically when user switches back to this tab or comes online
    const handleFocus = () => loadData();
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleFocus);

    // Attach Realtime Supabase Subscription if connected
    const supabase = getSupabaseClient();
    let channel: any = null;
    if (supabase) {
      try {
        channel = supabase
          .channel('db-realtime-sync')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
            loadData();
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
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  // CRUD Operations
  const handleAddTransaction = async (newTx: Omit<Transaction, 'id' | 'created_at'>) => {
    setLoading(true);
    const res = await addTransaction(newTx);
    if (res.success && res.data) {
      // Optimistic or simple full refresh
      await loadData();
      if (res.error) {
        alert(res.error);
      }
    } else {
      alert(`Gagal menambah transaksi: ${res.error}`);
      setLoading(false);
    }
  };

  const handleUpdateTransaction = async (updatedTx: Transaction) => {
    setLoading(true);
    const res = await updateTransaction(updatedTx);
    if (res.success && res.data) {
      await loadData();
      if (res.error) {
        alert(res.error);
      }
    } else {
      alert(`Gagal memperbarui transaksi: ${res.error}`);
      setLoading(false);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    setLoading(true);
    const res = await deleteTransaction(id);
    if (res.success) {
      await loadData();
      if (res.error) {
        alert(res.error);
      }
    } else {
      alert(`Gagal menghapus transaksi: ${res.error}`);
      setLoading(false);
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
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Aplikasi Pembukuan Sederhana</span>
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

            {/* Navigation Tabs (Desktop Only) */}
            <nav className="hidden md:flex space-x-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/50">
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
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
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
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
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
            />
          )}

          {activeTab === 'reports' && (
            <Reports transactions={transactions} />
          )}

        </div>

      </main>

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
