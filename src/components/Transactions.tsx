import React, { useState, useMemo, useEffect } from 'react';
import { 
  PlusCircle, 
  Search, 
  Filter, 
  Trash2, 
  Edit2, 
  X, 
  Calendar, 
  User, 
  DollarSign, 
  BookOpen, 
  ArrowUpCircle, 
  ArrowDownCircle,
  HelpCircle,
  AlertCircle,
  CheckCircle,
  Undo
} from 'lucide-react';
import { Transaction } from '../utils/dummyData';
import { formatIDR, formatShortDate } from '../utils/formatters';

interface TransactionsProps {
  transactions: Transaction[];
  onAddTransaction: (tx: Omit<Transaction, 'id' | 'created_at'>) => void;
  onUpdateTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
  editingTransaction: Transaction | null;
  setEditingTransaction: (tx: Transaction | null) => void;
}

const INCOME_CATEGORIES = ['Pembuatan Toko', 'Handle Toko', 'Shopee Affiliate', 'Lain-lain'];
const EXPENSE_CATEGORIES = ['Operational', 'Ads Spend', 'Freelancer / Sub-kontraktor', 'Tool / Langganan Software', 'Lain-lain'];

export default function Transactions({
  transactions,
  onAddTransaction,
  onUpdateTransaction,
  onDeleteTransaction,
  editingTransaction,
  setEditingTransaction
}: TransactionsProps) {
  // Navigation & Form Toggle
  const [showForm, setShowForm] = useState<'income' | 'expense' | null>(null);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Form States (for Create)
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formCategory, setFormCategory] = useState('');
  const [formClientName, setFormClientName] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formPaymentStatus, setFormPaymentStatus] = useState<'paid' | 'unpaid' | 'partial'>('paid');
  const [formNotes, setFormNotes] = useState('');
  
  // Validation State
  const [valError, setValError] = useState('');

  // Auto-set default category when form type changes
  useEffect(() => {
    if (showForm === 'income') {
      setFormCategory(INCOME_CATEGORIES[0]);
      setFormPaymentStatus('paid');
    } else if (showForm === 'expense') {
      setFormCategory(EXPENSE_CATEGORIES[0]);
      setFormClientName('');
      setFormPaymentStatus('paid'); // not relevant, but safe
    }
  }, [showForm]);

  // Set form states if we are EDITING
  useEffect(() => {
    if (editingTransaction) {
      setShowForm(editingTransaction.type);
      setFormDate(editingTransaction.date);
      setFormCategory(editingTransaction.category);
      setFormClientName(editingTransaction.client_name || '');
      setFormAmount(String(editingTransaction.amount));
      setFormPaymentStatus(editingTransaction.payment_status);
      setFormNotes(editingTransaction.notes);
    }
  }, [editingTransaction]);

  // Handle Cancel Form
  const handleCancel = () => {
    setShowForm(null);
    setEditingTransaction(null);
    setValError('');
    // reset defaults
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormClientName('');
    setFormAmount('');
    setFormNotes('');
  };

  // Submit Form (Add or Edit)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValError('');

    // Validation
    if (!formDate) {
      setValError('Tanggal transaksi wajib diisi');
      return;
    }
    const numAmount = Number(formAmount.replace(/[^0-9.-]+/g, ""));
    if (isNaN(numAmount) || numAmount <= 0) {
      setValError('Jumlah nominal harus berupa angka positif lebih besar dari 0');
      return;
    }
    if (showForm === 'income' && !formClientName.trim()) {
      setValError('Nama Klien / Project wajib diisi untuk transaksi masuk');
      return;
    }
    if (!formCategory) {
      setValError('Pilih kategori transaksi');
      return;
    }

    const payload = {
      date: formDate,
      type: showForm as 'income' | 'expense',
      category: formCategory,
      client_name: showForm === 'income' ? formClientName.trim() : null,
      amount: numAmount,
      payment_status: showForm === 'income' ? formPaymentStatus : 'paid',
      notes: formNotes.trim()
    };

    if (editingTransaction) {
      onUpdateTransaction({
        ...editingTransaction,
        ...payload
      });
    } else {
      onAddTransaction(payload);
    }

    // Success and Reset
    handleCancel();
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearchTerm('');
    setFilterType('all');
    setFilterCategory('all');
    setStartDate('');
    setEndDate('');
  };

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      // 1. Search term (Client Name or Notes)
      const matchesSearch = 
        (t.client_name && t.client_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (t.notes && t.notes.toLowerCase().includes(searchTerm.toLowerCase())) ||
        t.category.toLowerCase().includes(searchTerm.toLowerCase());

      // 2. Type filter
      const matchesType = filterType === 'all' ? true : t.type === filterType;

      // 3. Category filter
      const matchesCategory = filterCategory === 'all' ? true : t.category === filterCategory;

      // 4. Date ranges
      const transactionDate = new Date(t.date).getTime();
      const matchesStartDate = startDate ? transactionDate >= new Date(startDate).getTime() : true;
      const matchesEndDate = endDate ? transactionDate <= new Date(endDate).getTime() : true;

      return matchesSearch && matchesType && matchesCategory && matchesStartDate && matchesEndDate;
    });
  }, [transactions, searchTerm, filterType, filterCategory, startDate, endDate]);

  return (
    <div className="space-y-6" id="transactions-section">
      
      {/* Top Banner & Fast Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Catatan Kas & Transaksi</h2>
          <p className="text-sm text-slate-500 mt-1">
            Kelola pencatatan pengeluaran operasional dan pemasukan jasa agensi.
          </p>
        </div>
        
        {!showForm && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowForm('income')}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-4 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer"
              id="btn-tambah-pemasukan"
            >
              <PlusCircle className="w-4 h-4" />
              Pemasukan
            </button>
            <button
              onClick={() => setShowForm('expense')}
              className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm px-4 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer"
              id="btn-tambah-pengeluaran"
            >
              <PlusCircle className="w-4 h-4" />
              Pengeluaran
            </button>
          </div>
        )}
      </div>

      {/* Transaction Form (Slide down / Open inline) */}
      {showForm && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-xs animate-fade-in" id="transaction-form-panel">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-5">
            <div className="flex items-center gap-2">
              <span className={`p-2 rounded-lg ${showForm === 'income' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                {showForm === 'income' ? <ArrowUpCircle className="w-5 h-5" /> : <ArrowDownCircle className="w-5 h-5" />}
              </span>
              <h3 className="font-bold text-slate-800 text-lg">
                {editingTransaction ? 'Edit Transaksi' : 'Catat Transaksi Baru'}{' '}
                <span className={showForm === 'income' ? 'text-emerald-600' : 'text-rose-600'}>
                  ({showForm === 'income' ? 'Pemasukan/Masuk' : 'Pengeluaran/Keluar'})
                </span>
              </h3>
            </div>
            <button
              onClick={handleCancel}
              className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {valError && (
              <div className="flex items-center gap-2 bg-rose-50 text-rose-700 p-3 rounded-xl border border-rose-100 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{valError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              
              {/* Field: Tanggal */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Tanggal Transaksi</label>
                <div className="relative">
                  <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm"
                  />
                </div>
              </div>

              {/* Field: Kategori */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Kategori</label>
                <div className="relative">
                  <BookOpen className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm appearance-none cursor-pointer"
                  >
                    {showForm === 'income' 
                      ? INCOME_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)
                      : EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)
                    }
                  </select>
                </div>
              </div>

              {/* Field: Nominal (Rp) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Nominal / Jumlah (Rp)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="number"
                    required
                    placeholder="Contoh: 1500000"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-bold placeholder:font-normal focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm"
                  />
                </div>
              </div>

              {/* Field: Klien (Pemasukan Only) */}
              {showForm === 'income' && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Nama Klien / Project</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Masukkan nama klien atau instansi"
                      value={formClientName}
                      onChange={(e) => setFormClientName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Field: Status Pembayaran (Pemasukan Only) */}
              {showForm === 'income' && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Status Pembayaran</label>
                  <div className="relative">
                    <CheckCircle className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <select
                      value={formPaymentStatus}
                      onChange={(e) => setFormPaymentStatus(e.target.value as any)}
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm appearance-none cursor-pointer"
                    >
                      <option value="paid">Lunas (Paid)</option>
                      <option value="partial">DP / Sebagian (Partial)</option>
                      <option value="unpaid">Belum Lunas (Unpaid)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Field: Deskripsi / Catatan */}
              <div className="space-y-1.5 lg:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Keterangan / Catatan Tambahan</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Tambahkan detail deskripsi transaksi ini..."
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm"
                  />
                </div>
              </div>

            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-semibold text-sm transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className={`px-5 py-2.5 rounded-xl font-bold text-sm text-white shadow-sm hover:shadow transition-all cursor-pointer ${
                  showForm === 'income' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {editingTransaction ? 'Simpan Perubahan' : 'Rekam Transaksi'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Advanced Filters & Search Section */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
        
        {/* Row 1: Search and Type selector */}
        <div className="flex flex-col md:flex-row gap-4">
          
          {/* Search bar */}
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama klien, deskripsi catatan, atau kategori..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm"
            />
          </div>

          {/* Type Filter Tabs */}
          <div className="flex gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200 self-start md:self-auto">
            <button
              onClick={() => { setFilterType('all'); setFilterCategory('all'); }}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterType === 'all' 
                  ? 'bg-white text-indigo-600 shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => { setFilterType('income'); setFilterCategory('all'); }}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterType === 'income' 
                  ? 'bg-white text-emerald-600 shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Masuk (Pemasukan)
            </button>
            <button
              onClick={() => { setFilterType('expense'); setFilterCategory('all'); }}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterType === 'expense' 
                  ? 'bg-white text-rose-600 shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Keluar (Pengeluaran)
            </button>
          </div>

        </div>

        {/* Row 2: Category and Date filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2 border-t border-slate-50">
          
          {/* Category Dropdown */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Kategori</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">Semua Kategori</option>
              {filterType === 'all' && (
                <>
                  <optgroup label="Kategori Pemasukan">
                    {INCOME_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </optgroup>
                  <optgroup label="Kategori Pengeluaran">
                    {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </optgroup>
                </>
              )}
              {filterType === 'income' && INCOME_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              {filterType === 'expense' && EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Date Range Start */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Dari Tanggal</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Date Range End */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Hingga Tanggal</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Clear Filters Button */}
          <div className="flex items-end">
            <button
              onClick={handleResetFilters}
              disabled={!searchTerm && filterType === 'all' && filterCategory === 'all' && !startDate && !endDate}
              className="w-full py-2 flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold transition-all cursor-pointer"
            >
              <Undo className="w-3.5 h-3.5" />
              Reset Filter
            </button>
          </div>

        </div>

      </div>

      {/* Transactions Table Container */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        
        <div className="p-5 flex items-center justify-between border-b border-slate-50">
          <div>
            <span className="text-sm font-bold text-slate-800">Daftar Transaksi Kas</span>
            <span className="ml-2 px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs font-bold">
              {filteredTransactions.length} item
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-100">
                <th className="py-3 px-6">Tanggal</th>
                <th className="py-3 px-6">Jenis</th>
                <th className="py-3 px-6">Kategori</th>
                <th className="py-3 px-6">Klien & Keterangan</th>
                <th className="py-3 px-6">Status Pembayaran</th>
                <th className="py-3 px-6 text-right">Nominal</th>
                <th className="py-3 px-6 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Tidak ditemukan transaksi yang cocok dengan kriteria filter Anda.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/40 transition-colors group">
                    
                    {/* Tanggal */}
                    <td className="py-4 px-6 text-slate-500 font-medium whitespace-nowrap">
                      {formatShortDate(t.date)}
                    </td>

                    {/* Jenis */}
                    <td className="py-4 px-6 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        t.type === 'income' 
                          ? 'bg-emerald-50 text-emerald-700' 
                          : 'bg-rose-50 text-rose-700'
                      }`}>
                        {t.type === 'income' ? 'Masuk' : 'Keluar'}
                      </span>
                    </td>

                    {/* Kategori */}
                    <td className="py-4 px-6 text-slate-700 font-medium whitespace-nowrap">
                      {t.category}
                    </td>

                    {/* Detail / Notes */}
                    <td className="py-4 px-6">
                      <div className="max-w-[240px]">
                        <p className="font-semibold text-slate-800 truncate">{t.client_name || '-'}</p>
                        <p className="text-xs text-slate-400 truncate mt-0.5">{t.notes || 'Tanpa keterangan tambahan'}</p>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-4 px-6 whitespace-nowrap">
                      {t.type === 'income' ? (
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ${
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

                    {/* Jumlah */}
                    <td className={`py-4 px-6 text-right font-bold whitespace-nowrap ${
                      t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {t.type === 'income' ? '+' : '-'} {formatIDR(t.amount)}
                    </td>

                    {/* Aksi */}
                    <td className="py-4 px-6 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            setEditingTransaction(t);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="p-1.5 bg-slate-50 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                          title="Edit Transaksi"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Yakin ingin menghapus transaksi ini?\nKlien: ${t.client_name || '-'}\nNominal: ${formatIDR(t.amount)}`)) {
                              onDeleteTransaction(t.id);
                            }
                          }}
                          className="p-1.5 bg-slate-50 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                          title="Hapus Transaksi"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
