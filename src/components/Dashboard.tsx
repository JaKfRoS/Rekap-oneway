import React, { useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  FileText, 
  Briefcase, 
  ShoppingBag, 
  Layers, 
  Clock, 
  ArrowUpRight, 
  ArrowDownRight,
  AlertCircle
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { Transaction } from '../utils/dummyData';
import { formatIDR, formatShortDate, getActualIncomeAmount, getPiutangAmount } from '../utils/formatters';

interface DashboardProps {
  transactions: Transaction[];
  onNavigateToTransactions: () => void;
  onEditTransaction: (tx: Transaction) => void;
}

export default function Dashboard({ transactions, onNavigateToTransactions, onEditTransaction }: DashboardProps) {
  // Determine "current month" based on the latest transaction date (to adapt to dummy/live data)
  const currentPeriod = useMemo(() => {
    if (transactions.length === 0) {
      const now = new Date();
      return { month: now.getMonth(), year: now.getFullYear(), label: 'Bulan Ini' };
    }
    
    // Sort transactions by date descending to find the latest
    const sorted = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const latestDate = new Date(sorted[0].date);
    
    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    
    return {
      month: latestDate.getMonth(),
      year: latestDate.getFullYear(),
      label: `${monthNames[latestDate.getMonth()]} ${latestDate.getFullYear()}`
    };
  }, [transactions]);

  // Calculations
  const stats = useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;
    let monthIncome = 0;
    let monthExpense = 0;
    let pendingInvoicesVal = 0;

    transactions.forEach(t => {
      const tDate = new Date(t.date);
      const isCurrentMonth = tDate.getMonth() === currentPeriod.month && tDate.getFullYear() === currentPeriod.year;
      
      if (t.type === 'income') {
        const actualCash = getActualIncomeAmount(t);
        const piutang = getPiutangAmount(t);

        totalIncome += actualCash;
        if (isCurrentMonth) monthIncome += actualCash;
        pendingInvoicesVal += piutang;
      } else {
        totalExpense += t.amount;
        if (isCurrentMonth) monthExpense += t.amount;
      }
    });

    return {
      totalIncome,
      totalExpense,
      netProfit: totalIncome - totalExpense,
      monthIncome,
      monthExpense,
      monthNetProfit: monthIncome - monthExpense,
      pendingInvoicesVal
    };
  }, [transactions, currentPeriod]);

  // Chart 1: Monthly Income vs Expense Trend
  const monthlyChartData = useMemo(() => {
    const monthlyMap: Record<string, { label: string; key: string; income: number; expense: number }> = {};
    
    transactions.forEach(t => {
      const date = new Date(t.date);
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      const yearKey = date.getFullYear();
      const monthKey = String(date.getMonth()).padStart(2, '0');
      const key = `${yearKey}-${monthKey}`;
      const label = `${monthNames[date.getMonth()]} ${String(yearKey).substring(2)}`;
      
      if (!monthlyMap[key]) {
        monthlyMap[key] = { label, key, income: 0, expense: 0 };
      }
      
      if (t.type === 'income') {
        monthlyMap[key].income += getActualIncomeAmount(t);
      } else {
        monthlyMap[key].expense += t.amount;
      }
    });

    return Object.values(monthlyMap)
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(-6);
  }, [transactions]);

  // Chart 2: Income Breakdown by Service Category
  const categoryChartData = useMemo(() => {
    const categoryTotals: Record<string, number> = {};

    transactions.forEach(t => {
      if (t.type === 'income') {
        const actualCash = getActualIncomeAmount(t);
        if (actualCash > 0) {
          const cat = t.category || 'Lain-lain';
          categoryTotals[cat] = (categoryTotals[cat] || 0) + actualCash;
        }
      }
    });

    return Object.entries(categoryTotals)
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0);
  }, [transactions]);

  const COLORS = ['#6366f1', '#06b6d4', '#f59e0b', '#64748b'];

  // Latest 5 Transactions
  const recentTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [transactions]);

  return (
    <div className="space-y-6" id="dashboard-section">
      {/* Welcome and Month Indicator */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Ringkasan Keuangan Usaha</h1>
          <p className="text-slate-500 text-sm mt-1">
            Sistem akuntansi
          </p>
        </div>
        <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
          <Clock className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-700">Periode Aktif: {currentPeriod.label}</span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Card 1: Total Pemasukan */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs relative overflow-hidden group hover:border-indigo-200 transition-all duration-200" id="card-pemasukan">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Pemasukan</p>
              <h3 className="text-xl font-bold text-slate-800 mt-2">{formatIDR(stats.totalIncome)}</h3>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <span className="font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center">
                  <ArrowUpRight className="w-3 h-3 inline" /> {formatIDR(stats.monthIncome)}
                </span>
                <span>bulan ini</span>
              </p>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
        </div>

        {/* Card 2: Total Pengeluaran */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs relative overflow-hidden group hover:border-indigo-200 transition-all duration-200" id="card-pengeluaran">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Pengeluaran</p>
              <h3 className="text-xl font-bold text-slate-800 mt-2">{formatIDR(stats.totalExpense)}</h3>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <span className="font-semibold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded flex items-center">
                  <ArrowDownRight className="w-3 h-3 inline" /> {formatIDR(stats.monthExpense)}
                </span>
                <span>bulan ini</span>
              </p>
            </div>
            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
              <TrendingDown className="w-6 h-6" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-rose-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
        </div>

        {/* Card 3: Laba Bersih */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs relative overflow-hidden group hover:border-indigo-200 transition-all duration-200" id="card-laba">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Laba Bersih</p>
              <h3 className={`text-xl font-bold mt-2 ${stats.netProfit >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                {formatIDR(stats.netProfit)}
              </h3>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <span className={`font-semibold bg-indigo-50 px-1.5 py-0.5 rounded ${stats.monthNetProfit >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                  {formatIDR(stats.monthNetProfit)}
                </span>
                <span>bulan ini</span>
              </p>
            </div>
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
        </div>

        {/* Card 4: Piutang / Tagihan Pending */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs relative overflow-hidden group hover:border-indigo-200 transition-all duration-200" id="card-piutang">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Piutang / Pending</p>
              <h3 className="text-xl font-bold text-amber-600 mt-2">{formatIDR(stats.pendingInvoicesVal)}</h3>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                <span>Tagihan DP / Belum Lunas</span>
              </p>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <FileText className="w-6 h-6" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
        </div>

      </div>

      {/* Visualisasi Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Trend Monthly (Bar/Line Chart) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs lg:col-span-2 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-base">Tren Bulanan</h3>
              <p className="text-xs text-slate-400 mt-0.5">Perbandingan pemasukan vs pengeluaran (6 bulan terakhir)</p>
            </div>
          </div>
          <div className="h-[280px] w-full">
            {monthlyChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                Belum ada data transaksi yang memadai.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyChartData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(val) => `Rp ${val/1000000}M`} />
                  <Tooltip 
                    formatter={(value: any) => [formatIDR(Number(value)), '']}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="income" name="Pemasukan" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name="Pengeluaran" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Pie Chart: Kategori Layanan Pemasukan */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-base">Sumber Pemasukan</h3>
            <p className="text-xs text-slate-400 mt-0.5">Proporsi pemasukan berdasarkan layanan utama</p>
          </div>
          
          <div className="h-[200px] w-full flex items-center justify-center my-4 relative">
            {categoryChartData.length === 0 ? (
              <div className="text-slate-400 text-sm">Belum ada pemasukan tercatat</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categoryChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => formatIDR(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="space-y-2 mt-2">
            {categoryChartData.map((item, index) => {
              const totalIncome = categoryChartData.reduce((acc, curr) => acc + curr.value, 0);
              const percent = totalIncome > 0 ? ((item.value / totalIncome) * 100).toFixed(1) : '0';
              return (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                    <span className="text-slate-600 font-medium">{item.name}</span>
                  </div>
                  <div className="text-slate-800 font-semibold flex items-center gap-1.5">
                    <span>{formatIDR(item.value)}</span>
                    <span className="text-slate-400 font-normal">({percent}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Recent Activities */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        <div className="p-5 flex items-center justify-between border-b border-slate-50">
          <div>
            <h3 className="font-bold text-slate-800 text-base">Aktivitas Transaksi Terbaru</h3>
            <p className="text-xs text-slate-400 mt-0.5">Ringkasan 5 transaksi masuk dan keluar paling terakhir</p>
          </div>
          <button 
            onClick={onNavigateToTransactions}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 group transition-all"
          >
            Lihat Semua Transaksi 
            <ArrowUpRight className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-100">
                <th className="py-3 px-6">Tanggal</th>
                <th className="py-3 px-6">Jenis</th>
                <th className="py-3 px-6">Kategori</th>
                <th className="py-3 px-6">Klien / Detail</th>
                <th className="py-3 px-6">Status</th>
                <th className="py-3 px-6 text-right">Jumlah (Nominal)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm">
              {recentTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Belum ada transaksi yang tercatat. Silakan tambah transaksi baru.
                  </td>
                </tr>
              ) : (
                recentTransactions.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/50 transition-colors cursor-pointer group" onClick={() => onEditTransaction(t)}>
                    <td className="py-4 px-6 text-slate-500 font-medium whitespace-nowrap">
                      {formatShortDate(t.date)}
                    </td>
                    <td className="py-4 px-6 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        t.type === 'income' 
                          ? 'bg-emerald-50 text-emerald-700' 
                          : 'bg-rose-50 text-rose-700'
                      }`}>
                        {t.type === 'income' ? 'Masuk' : 'Keluar'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-slate-700 font-medium whitespace-nowrap">
                      {t.category}
                    </td>
                    <td className="py-4 px-6">
                      <div className="max-w-[200px] truncate">
                        <p className="font-semibold text-slate-800">{t.client_name || '-'}</p>
                        <p className="text-xs text-slate-400 truncate">{t.notes || 'Tanpa catatan'}</p>
                      </div>
                    </td>
                    <td className="py-4 px-6 whitespace-nowrap">
                      {t.type === 'income' ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          t.payment_status === 'paid' 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : t.payment_status === 'partial' 
                            ? 'bg-amber-100 text-amber-800' 
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {t.payment_status === 'paid' ? 'Lunas' : t.payment_status === 'partial' ? 'DP (Sebagian)' : 'Belum Lunas'}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </td>
                    <td className={`py-4 px-6 text-right font-bold whitespace-nowrap group-hover:text-indigo-600 transition-colors ${
                      t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {t.type === 'income' ? '+' : '-'} {formatIDR(t.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
