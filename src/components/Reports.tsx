import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  Download, 
  Printer, 
  FileText, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Briefcase, 
  Layers,
  ArrowRight
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
import { formatIDR, formatLongDate, formatShortDate, getActualIncomeAmount, getPiutangAmount } from '../utils/formatters';

interface ReportsProps {
  transactions: Transaction[];
}

type PresetRange = 'hari-ini' | 'bulan-ini' | 'bulan-lalu' | 'tahun-ini' | 'semua' | 'custom';

export default function Reports({ transactions }: ReportsProps) {
  const [preset, setPreset] = useState<PresetRange>('bulan-ini');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Apply range based on preset or custom input
  const dateRange = useMemo(() => {
    const today = new Date();
    let start = '';
    let end = '';

    const formatDateStr = (d: Date) => d.toISOString().split('T')[0];

    switch (preset) {
      case 'hari-ini': {
        const d = new Date(today);
        start = formatDateStr(d);
        end = formatDateStr(d);
        break;
      }
      case 'bulan-ini': {
        const s = new Date(today.getFullYear(), today.getMonth(), 1);
        const e = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        start = formatDateStr(s);
        end = formatDateStr(e);
        break;
      }
      case 'bulan-lalu': {
        const s = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const e = new Date(today.getFullYear(), today.getMonth(), 0);
        start = formatDateStr(s);
        end = formatDateStr(e);
        break;
      }
      case 'tahun-ini': {
        const s = new Date(today.getFullYear(), 0, 1);
        const e = new Date(today.getFullYear(), 11, 31);
        start = formatDateStr(s);
        end = formatDateStr(e);
        break;
      }
      case 'semua': {
        start = '';
        end = '';
        break;
      }
      case 'custom': {
        start = startDate;
        end = endDate;
        break;
      }
    }

    return { start, end };
  }, [preset, startDate, endDate]);

  // Synchronize start/end inputs when selecting presets
  React.useEffect(() => {
    if (preset !== 'custom') {
      setStartDate(dateRange.start);
      setEndDate(dateRange.end);
    }
  }, [preset, dateRange]);

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const tTime = new Date(t.date).getTime();
      const matchesStart = dateRange.start ? tTime >= new Date(dateRange.start).getTime() : true;
      const matchesEnd = dateRange.end ? tTime <= new Date(dateRange.end).getTime() : true;
      return matchesStart && matchesEnd;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Ascending for report chronological order
  }, [transactions, dateRange]);

  // Calculations for report range
  const reportStats = useMemo(() => {
    let income = 0;
    let expense = 0;
    let pending = 0;

    const incomeCategories: Record<string, number> = {};
    const expenseCategories: Record<string, number> = {};

    filteredTransactions.forEach(t => {
      if (t.type === 'income') {
        const actualCash = getActualIncomeAmount(t);
        const piutang = getPiutangAmount(t);

        income += actualCash;
        pending += piutang;

        if (actualCash > 0) {
          const cat = t.category || 'Lain-lain';
          incomeCategories[cat] = (incomeCategories[cat] || 0) + actualCash;
        }
      } else {
        expense += t.amount;
        const cat = t.category || 'Lain-lain';
        expenseCategories[cat] = (expenseCategories[cat] || 0) + t.amount;
      }
    });

    return {
      income,
      expense,
      netProfit: income - expense,
      pending,
      incomeCategories: Object.entries(incomeCategories).filter(([_, v]) => v > 0),
      expenseCategories: Object.entries(expenseCategories).filter(([_, v]) => v > 0)
    };
  }, [filteredTransactions]);

  // Chart 1: Monthly or Periodic Income vs Expense
  const chartData = useMemo(() => {
    const monthlyMap: Record<string, { label: string; key: string; income: number; expense: number }> = {};
    
    filteredTransactions.forEach(t => {
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

    const result = Object.values(monthlyMap).sort((a, b) => a.key.localeCompare(b.key));
    
    if (result.length <= 1) {
      return [
        { label: 'Total Periode Ini', key: 'total', income: reportStats.income, expense: reportStats.expense }
      ];
    }
    return result;
  }, [filteredTransactions, reportStats]);

  // Chart 2: Category Pie Chart Data
  const pieCategoryData = useMemo(() => {
    return reportStats.incomeCategories.map(([name, value]) => ({
      name,
      value
    }));
  }, [reportStats]);

  const COLORS = ['#10b981', '#6366f1', '#f59e0b', '#06b6d4', '#ec4899', '#64748b'];

  // Export to Excel / CSV
  const handleExportCSV = () => {
    if (filteredTransactions.length === 0) {
      alert('Tidak ada transaksi untuk diekspor pada rentang tanggal ini.');
      return;
    }

    const headers = [
      'ID Transaksi',
      'Tanggal',
      'Jenis',
      'Kategori',
      'Klien/Project',
      'Jumlah (IDR)',
      'Status Pembayaran',
      'Catatan/Keterangan'
    ];

    const csvField = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

    const rows = filteredTransactions.map(t => [
      csvField(t.id),
      csvField(t.date),
      csvField(t.type === 'income' ? 'Masuk' : 'Keluar'),
      csvField(t.category),
      csvField(t.client_name || '-'),
      csvField(t.amount),
      csvField(t.type === 'income' ? (t.payment_status === 'paid' ? 'Lunas' : t.payment_status === 'partial' ? 'DP' : 'Belum Lunas') : '-'),
      csvField(t.notes || '')
    ]);

    // Construct CSV String
    const csvContent =
      "\uFEFF" + // UTF-8 BOM to open correctly in Excel
      [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const fileRange = preset === 'custom' 
      ? `${startDate}_ke_${endDate}` 
      : preset;
      
    link.setAttribute('href', url);
    link.setAttribute('download', `Ringkasan_Keuangan_${fileRange}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print PDF Trigger
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6" id="reports-section">
      {/* Dynamic styles injected just for printing this specific container */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 10mm;
          }
          /* Hide everything except print-area */
          body * {
            visibility: hidden;
            background-color: white !important;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
          .page-break {
            page-break-before: always !important;
            break-before: page !important;
            margin-top: 0 !important;
            padding-top: 12px !important;
          }
          .print-grid-2 {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 12px !important;
          }
          .print-grid-4 {
            display: grid !important;
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
            gap: 8px !important;
          }
        }
      `}</style>

      {/* Control Panel Card (No-print) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4 no-print">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Cetak Laporan & Ekspor</h2>
          <p className="text-sm text-slate-500 mt-1">
            Saring laporan keuangan berdasarkan rentang tanggal tertentu, cetak sebagai PDF, atau unduh file Excel/CSV.
          </p>
        </div>

        {/* Presets Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            { id: 'hari-ini', label: 'Hari Ini' },
            { id: 'bulan-ini', label: 'Bulan Ini' },
            { id: 'bulan-lalu', label: 'Bulan Lalu' },
            { id: 'tahun-ini', label: 'Tahun Ini' },
            { id: 'semua', label: 'Semua Waktu' },
            { id: 'custom', label: 'Tanggal Kustom' }
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setPreset(p.id as PresetRange)}
              className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                preset === p.id 
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs' 
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom Date Inputs */}
        {preset === 'custom' && (
          <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 animate-fade-in">
            <div className="w-full sm:w-auto flex-1 space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Tanggal Mulai (Start Date)</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 hidden sm:block shrink-0 mt-4" />
            <div className="w-full sm:w-auto flex-1 space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Tanggal Selesai (End Date)</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        )}

        {/* Action triggers */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={handlePrint}
            disabled={filteredTransactions.length === 0}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-all cursor-pointer shadow-xs disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            Cetak Laporan / PDF
          </button>
          <button
            onClick={handleExportCSV}
            disabled={filteredTransactions.length === 0}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-all cursor-pointer shadow-xs disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Unduh Excel / CSV
          </button>
          
          <div className="text-xs text-slate-400 ml-auto w-full lg:w-auto text-center lg:text-right mt-1 lg:mt-0">
            Terfilter: <strong>{filteredTransactions.length} transaksi</strong> pada periode ini.
          </div>
        </div>
      </div>

      {/* REPORT PREVIEW CONTAINER (Styled as an A4 Paper layout) */}
      <div 
        id="print-area" 
        className="bg-white p-6 md:p-10 rounded-2xl border border-slate-200 shadow-xs max-w-[850px] mx-auto text-slate-800 space-y-6"
      >
        {/* ================= PAGE 1 ================= */}
        <div className="space-y-4">
          {/* Print Header Page 1 */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b-2 border-slate-900 pb-3">
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">RINGKASAN KEUANGAN</h1>
              <p className="text-xs font-bold text-slate-500 tracking-wider mt-0.5">Ikhtisar Pendapatan & Kas Masuk/Keluar</p>
            </div>
            <div className="text-left sm:text-right mt-2 sm:mt-0 text-xs text-slate-500 space-y-0.5">
              <p><strong>Dicetak pada:</strong> {formatLongDate(new Date().toISOString().split('T')[0])}</p>
              <p>
                <strong>Periode:</strong>{' '}
                {startDate && endDate 
                  ? `${formatShortDate(startDate)} - ${formatShortDate(endDate)}` 
                  : 'Semua Waktu'
                }
              </p>
            </div>
          </div>

          {/* Summary Metrics Row (4 Columns forced) */}
          <div className="grid grid-cols-2 md:grid-cols-4 print-grid-4 gap-2.5">
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Pemasukan</p>
              <p className="text-sm font-black text-emerald-600 mt-0.5">{formatIDR(reportStats.income)}</p>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Pengeluaran</p>
              <p className="text-sm font-black text-rose-600 mt-0.5">{formatIDR(reportStats.expense)}</p>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Laba Bersih</p>
              <p className={`text-sm font-black mt-0.5 ${reportStats.netProfit >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                {formatIDR(reportStats.netProfit)}
              </p>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Outstanding / Piutang</p>
              <p className="text-sm font-black text-amber-600 mt-0.5">{formatIDR(reportStats.pending)}</p>
            </div>
          </div>

          {/* Visual Chart / Grafik Keuangan (Side-by-Side 2 Columns Forced) */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-l-4 border-indigo-600 pl-2">
              Grafik Perbandingan & Proporsi Keuangan
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 print-grid-2 gap-3">
              
              {/* Bar Chart */}
              <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/80">
                <p className="text-[11px] font-bold text-slate-700 mb-1 text-center">Pemasukan vs Pengeluaran</p>
                <div className="h-36 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 8, fill: '#64748b' }} tickFormatter={(val) => `${val / 1000}k`} axisLine={false} tickLine={false} />
                      <Tooltip 
                        formatter={(value: any) => [formatIDR(Number(value)), '']}
                        contentStyle={{ backgroundColor: '#ffffff', borderRadius: '6px', fontSize: '10px', border: '1px solid #e2e8f0' }}
                      />
                      <Bar dataKey="income" name="Pemasukan" fill="#10b981" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="expense" name="Pengeluaran" fill="#f43f5e" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Pie Chart / Category Breakdown */}
              <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/80">
                <p className="text-[11px] font-bold text-slate-700 mb-1 text-center">Proporsi Pemasukan Layanan</p>
                {pieCategoryData.length === 0 ? (
                  <div className="h-36 flex items-center justify-center text-xs text-slate-400 italic">
                    Belum ada data pemasukan
                  </div>
                ) : (
                  <div className="h-36 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieCategoryData}
                          cx="50%"
                          cy="42%"
                          innerRadius={24}
                          outerRadius={46}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {pieCategoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(val: any) => [formatIDR(Number(val)), 'Nominal']} />
                        <Legend formatter={(value) => <span className="text-[9px] text-slate-600">{value}</span>} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Detailed Section: Categories Breakdown (2 Columns forced) */}
          <div className="grid grid-cols-1 md:grid-cols-2 print-grid-2 gap-3 pt-1">
            {/* Income categories */}
            <div className="space-y-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-l-4 border-emerald-500 pl-2">
                Rincian Pemasukan per Layanan
              </h3>
              <div className="space-y-1 bg-slate-50/50 p-2 rounded-lg border border-slate-100">
                {reportStats.incomeCategories.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Tidak ada rincian pemasukan.</p>
                ) : (
                  reportStats.incomeCategories.map(([name, val]) => {
                    const percent = reportStats.income > 0 ? ((val / reportStats.income) * 100).toFixed(1) : '0';
                    return (
                      <div key={name} className="flex justify-between items-center text-[11px] text-slate-600 py-0.5 border-b border-slate-100 last:border-0">
                        <span className="font-medium truncate max-w-[150px]">{name}</span>
                        <span className="font-bold text-slate-800">{formatIDR(val)} <span className="font-normal text-slate-400">({percent}%)</span></span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Expense categories */}
            <div className="space-y-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-l-4 border-rose-500 pl-2">
                Rincian Pengeluaran per Kategori
              </h3>
              <div className="space-y-1 bg-slate-50/50 p-2 rounded-lg border border-slate-100">
                {reportStats.expenseCategories.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Tidak ada rincian pengeluaran.</p>
                ) : (
                  reportStats.expenseCategories.map(([name, val]) => {
                    const percent = reportStats.expense > 0 ? ((val / reportStats.expense) * 100).toFixed(1) : '0';
                    return (
                      <div key={name} className="flex justify-between items-center text-[11px] text-slate-600 py-0.5 border-b border-slate-100 last:border-0">
                        <span className="font-medium truncate max-w-[150px]">{name}</span>
                        <span className="font-bold text-slate-800">{formatIDR(val)} <span className="font-normal text-slate-400">({percent}%)</span></span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Footer Page 1 */}
          <div className="flex justify-between items-center pt-3 border-t border-slate-200 text-[10px] text-slate-400">
            <p>KASUSAHA &bull; Ringkasan Keuangan Usaha</p>
            <p className="text-right font-semibold text-slate-600">Halaman 1 dari 2</p>
          </div>
        </div>

        {/* ================= PAGE 2 (STARTING FROM PAGE 2) ================= */}
        <div className="page-break pt-4 border-t-2 border-dashed border-slate-200 mt-6 space-y-4">
          {/* Print Header Page 2 */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b-2 border-slate-900 pb-3">
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-slate-900">RINGKASAN KEUANGAN</h2>
              <p className="text-xs font-bold text-slate-500 tracking-wider mt-0.5">Lampiran Detail Transaksi Keuangan</p>
            </div>
            <div className="text-left sm:text-right mt-2 sm:mt-0 text-xs text-slate-500">
              <p><strong>Periode:</strong> {startDate && endDate ? `${formatShortDate(startDate)} - ${formatShortDate(endDate)}` : 'Semua Waktu'}</p>
            </div>
          </div>

          {/* Transactions List */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-l-4 border-slate-700 pl-2">
              Daftar Rincian Transaksi Terlampir
            </h3>
            
            <table className="w-full text-left text-xs border-collapse border border-slate-200">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <th className="p-2 border-r border-slate-200">Tanggal</th>
                  <th className="p-2 border-r border-slate-200">Tipe</th>
                  <th className="p-2 border-r border-slate-200">Kategori</th>
                  <th className="p-2 border-r border-slate-200">Klien / Deskripsi</th>
                  <th className="p-2 text-right">Jumlah (Nominal)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-slate-400 italic">
                      Belum ada transaksi terekam pada periode ini.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50/50">
                      <td className="p-2 text-slate-600 whitespace-nowrap border-r border-slate-100">{formatShortDate(t.date)}</td>
                      <td className="p-2 font-bold whitespace-nowrap border-r border-slate-100">
                        <span className={t.type === 'income' ? 'text-emerald-700' : 'text-rose-700'}>
                          {t.type === 'income' ? 'Masuk' : 'Keluar'}
                        </span>
                      </td>
                      <td className="p-2 text-slate-700 border-r border-slate-100">{t.category}</td>
                      <td className="p-2 border-r border-slate-100">
                        <p className="font-bold text-slate-800 truncate max-w-[200px]">{t.client_name || '-'}</p>
                        <p className="text-[10px] text-slate-400 truncate max-w-[200px]">{t.notes || 'Tanpa catatan'}</p>
                      </td>
                      <td className={`p-2 text-right font-extrabold whitespace-nowrap ${
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

          {/* Footer Page 2 */}
          <div className="flex justify-between items-center pt-6 border-t border-slate-200 text-[10px] text-slate-400">
            <p>KASUSAHA &bull; Lampiran Detail Transaksi Keuangan</p>
            <p className="text-right font-semibold text-slate-600">Halaman 2 dari 2</p>
          </div>
        </div>

      </div>
    </div>
  );
}

