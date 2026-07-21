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
import { Transaction } from '../utils/dummyData';
import { formatIDR, formatLongDate, formatShortDate } from '../utils/formatters';

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
    const today = new Date('2026-07-21'); // Anchored to 2026-07-21 based on metadata
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

    const incomeCategories: Record<string, number> = {
      'Pembuatan Toko': 0,
      'Handle Toko': 0,
      'Shopee Affiliate': 0,
      'Lain-lain': 0
    };

    const expenseCategories: Record<string, number> = {
      'Operational': 0,
      'Ads Spend': 0,
      'Freelancer / Sub-kontraktor': 0,
      'Tool / Langganan Software': 0,
      'Lain-lain': 0
    };

    filteredTransactions.forEach(t => {
      if (t.type === 'income') {
        income += t.amount;
        if (incomeCategories[t.category] !== undefined) {
          incomeCategories[t.category] += t.amount;
        } else {
          incomeCategories['Lain-lain'] += t.amount;
        }

        if (t.payment_status === 'unpaid') {
          pending += t.amount;
        } else if (t.payment_status === 'partial') {
          pending += (t.amount * 0.5);
        }
      } else {
        expense += t.amount;
        if (expenseCategories[t.category] !== undefined) {
          expenseCategories[t.category] += t.amount;
        } else {
          expenseCategories['Lain-lain'] += t.amount;
        }
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

    const rows = filteredTransactions.map(t => [
      t.id,
      t.date,
      t.type === 'income' ? 'Masuk' : 'Keluar',
      t.category,
      t.client_name || '-',
      t.amount,
      t.type === 'income' ? (t.payment_status === 'paid' ? 'Lunas' : t.payment_status === 'partial' ? 'DP' : 'Belum Lunas') : '-',
      `"${(t.notes || '').replace(/"/g, '""')}"`
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
    link.setAttribute('download', `Laporan_Keuangan_Jasa_${fileRange}.csv`);
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
            padding: 24px;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
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
        className="bg-white p-8 md:p-12 rounded-2xl border border-slate-200 shadow-sm max-w-[800px] mx-auto text-slate-800"
      >
        {/* Print Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b-2 border-slate-900 pb-6">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">LAPORAN KEUANGAN JASA</h1>
            <p className="text-xs font-bold text-slate-500 tracking-wider mt-0.5">FREELANCE & AGENSI PEMBUKUAN INTEGRASI</p>
          </div>
          <div className="text-left sm:text-right mt-3 sm:mt-0 text-xs text-slate-500 space-y-0.5">
            <p><strong>Dicetak pada:</strong> {formatLongDate('2026-07-21')}</p>
            <p>
              <strong>Periode:</strong>{' '}
              {startDate && endDate 
                ? `${formatShortDate(startDate)} - ${formatShortDate(endDate)}` 
                : 'Semua Waktu'
              }
            </p>
          </div>
        </div>

        {/* Summary Metrics Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-6 border-b border-slate-100">
          
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Pemasukan</p>
            <p className="text-sm font-extrabold text-emerald-600 mt-1">{formatIDR(reportStats.income)}</p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Pengeluaran</p>
            <p className="text-sm font-extrabold text-rose-600 mt-1">{formatIDR(reportStats.expense)}</p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Laba Bersih (Net Profit)</p>
            <p className={`text-sm font-extrabold mt-1 ${reportStats.netProfit >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
              {formatIDR(reportStats.netProfit)}
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Outstanding / Piutang</p>
            <p className="text-sm font-extrabold text-amber-600 mt-1">{formatIDR(reportStats.pending)}</p>
          </div>

        </div>

        {/* Detailed Section: Categories Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-6 border-b border-slate-100">
          
          {/* Income categories */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-l-4 border-emerald-500 pl-2">
              Rincian Pemasukan per Layanan
            </h3>
            <div className="space-y-2">
              {reportStats.incomeCategories.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Tidak ada rincian pemasukan.</p>
              ) : (
                reportStats.incomeCategories.map(([name, val]) => {
                  const percent = reportStats.income > 0 ? ((val / reportStats.income) * 100).toFixed(1) : '0';
                  return (
                    <div key={name} className="flex justify-between items-center text-xs text-slate-600 py-1 border-b border-slate-50">
                      <span className="font-medium">{name}</span>
                      <span className="font-bold text-slate-800">{formatIDR(val)} <span className="font-normal text-slate-400">({percent}%)</span></span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Expense categories */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-l-4 border-rose-500 pl-2">
              Rincian Pengeluaran per Kategori
            </h3>
            <div className="space-y-2">
              {reportStats.expenseCategories.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Tidak ada rincian pengeluaran.</p>
              ) : (
                reportStats.expenseCategories.map(([name, val]) => {
                  const percent = reportStats.expense > 0 ? ((val / reportStats.expense) * 100).toFixed(1) : '0';
                  return (
                    <div key={name} className="flex justify-between items-center text-xs text-slate-600 py-1 border-b border-slate-50">
                      <span className="font-medium">{name}</span>
                      <span className="font-bold text-slate-800">{formatIDR(val)} <span className="font-normal text-slate-400">({percent}%)</span></span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

        {/* Transactions list */}
        <div className="py-6 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-l-4 border-slate-600 pl-2">
            Ringkasan Detail Transaksi Terlampir
          </h3>
          
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                <th className="p-2">Tanggal</th>
                <th className="p-2">Tipe</th>
                <th className="p-2">Kategori</th>
                <th className="p-2">Klien / Deskripsi</th>
                <th className="p-2 text-right">Jumlah (Nominal)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-slate-400 italic">
                    Belum ada transaksi terekam pada periode ini.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50/50">
                    <td className="p-2 text-slate-500 whitespace-nowrap">{formatShortDate(t.date)}</td>
                    <td className="p-2 font-bold whitespace-nowrap">
                      <span className={t.type === 'income' ? 'text-emerald-700' : 'text-rose-700'}>
                        {t.type === 'income' ? 'Masuk' : 'Keluar'}
                      </span>
                    </td>
                    <td className="p-2 text-slate-700">{t.category}</td>
                    <td className="p-2">
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

        {/* Footer Signature Block */}
        <div className="flex justify-between items-center pt-10 border-t border-slate-100 mt-12 text-[10px] text-slate-400">
          <p>Sistem Pembukuan Keuangan Usaha Jasa &bull; Otomatisasi Terintegrasi</p>
          <p className="text-right">Halaman 1 dari 1</p>
        </div>

      </div>
    </div>
  );
}
