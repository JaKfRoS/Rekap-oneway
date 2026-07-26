import React, { useState, useMemo, useEffect } from 'react';
import { 
  PlusCircle, 
  Search, 
  Trash2, 
  Edit2, 
  X, 
  Calendar, 
  User, 
  DollarSign, 
  BookOpen, 
  ArrowUpCircle, 
  ArrowDownCircle,
  AlertCircle,
  CheckCircle,
  Undo,
  Tag,
  Clock,
  Check
} from 'lucide-react';
import { Transaction } from '../utils/dummyData';
import { formatIDR, formatShortDate, getActualIncomeAmount, getPiutangAmount } from '../utils/formatters';
import { getCategories, CategoryData } from '../utils/categories';
import CategoryManagerModal from './CategoryManagerModal';
import PelunasanModal from './PelunasanModal';

interface TransactionsProps {
  transactions: Transaction[];
  onAddTransaction: (tx: Omit<Transaction, 'id' | 'created_at'>) => void;
  onUpdateTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
  editingTransaction: Transaction | null;
  setEditingTransaction: (tx: Transaction | null) => void;
  userId?: string;
}

export default function Transactions({
  transactions,
  onAddTransaction,
  onUpdateTransaction,
  onDeleteTransaction,
  editingTransaction,
  setEditingTransaction,
  userId
}: TransactionsProps) {
  // Navigation & Form Toggle
  const [showForm, setShowForm] = useState<'income' | 'expense' | null>(null);

  // Custom Categories state & version trigger
  const [customCatVersion, setCustomCatVersion] = useState(0);
  const categoriesList = useMemo(() => {
    return getCategories(userId);
  }, [customCatVersion, userId]);

  const [isCatModalOpen, setIsCatModalOpen] = useState(false);

  // Pelunasan Modal state
  const [pelunasanTx, setPelunasanTx] = useState<Transaction | null>(null);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense' | 'piutang'>('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Form States (for Create & Edit)
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formCategory, setFormCategory] = useState('');
  const [formClientName, setFormClientName] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDpAmount, setFormDpAmount] = useState('');
  const [formPaymentStatus, setFormPaymentStatus] = useState<'paid' | 'unpaid' | 'partial'>('paid');
  const [formNotes, setFormNotes] = useState('');
  
  // Validation State
  const [valError, setValError] = useState('');

  // Refresh categories from storage
  const handleCategoriesChanged = () => {
    setCustomCatVersion(prev => prev + 1);
  };

  // Auto-set default category when form type changes
  useEffect(() => {
    if (showForm === 'income') {
      const incCats = categoriesList.income;
      setFormCategory(incCats[0] || 'Pembuatan Toko');
      setFormPaymentStatus('paid');
      setFormDpAmount('');
    } else if (showForm === 'expense') {
      const expCats = categoriesList.expense;
      setFormCategory(expCats[0] || 'Operational');
      setFormClientName('');
      setFormPaymentStatus('paid');
      setFormDpAmount('');
    }
  }, [showForm, categoriesList]);

  // Set form states if we are EDITING
  useEffect(() => {
    if (editingTransaction) {
      setShowForm(editingTransaction.type);
      setFormDate(editingTransaction.date);
      setFormCategory(editingTransaction.category);
      setFormClientName(editingTransaction.client_name || '');
      setFormAmount(String(editingTransaction.amount));
      setFormDpAmount(editingTransaction.dp_amount ? String(editingTransaction.dp_amount) : '');
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
    setFormDpAmount('');
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
      setValError('Jumlah nominal total harus berupa angka positif lebih besar dari 0');
      return;
    }

    let numDpAmount = 0;
    if (showForm === 'income' && formPaymentStatus === 'partial') {
      numDpAmount = Number(formDpAmount.replace(/[^0-9.-]+/g, ""));
      if (isNaN(numDpAmount) || numDpAmount <= 0) {
        setValError('Nominal DP (Down Payment) harus berupa angka positif');
        return;
      }
      if (numDpAmount >= numAmount) {
        setValError('Nominal DP harus lebih kecil dari Total Deal (jika sudah lunas, pilih status "Lunas")');
        return;
      }
    } else if (showForm === 'income' && formPaymentStatus === 'paid') {
      numDpAmount = numAmount;
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
      dp_amount: showForm === 'income' && formPaymentStatus === 'partial' ? numDpAmount : (formPaymentStatus === 'paid' ? numAmount : 0),
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
      // 1. Search term (Client Name or Notes or Category)
      const matchesSearch = 
        (t.client_name && t.client_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (t.notes && t.notes.toLowerCase().includes(searchTerm.toLowerCase())) ||
        t.category.toLowerCase().includes(searchTerm.toLowerCase());

      // 2. Type / Piutang filter
      let matchesType = true;
      if (filterType === 'income') {
        matchesType = t.type === 'income';
      } else if (filterType === 'expense') {
        matchesType = t.type === 'expense';
      } else if (filterType === 'piutang') {
        matchesType = t.type === 'income' && t.payment_status !== 'paid';
      }

      // 3. Category filter
      const matchesCategory = filterCategory === 'all' ? true : t.category === filterCategory;

      // 4. Date ranges
      const transactionDate = new Date(t.date).getTime();
      const matchesStartDate = startDate ? transactionDate >= new Date(startDate).getTime() : true;
      const matchesEndDate = endDate ? transactionDate <= new Date(endDate).getTime() : true;

      return matchesSearch && matchesType && matchesCategory && matchesStartDate && matchesEndDate;
    });
  }, [transactions, searchTerm, filterType, filterCategory, startDate, endDate]);

  // Counts for quick stats
  const piutangCount = useMemo(() => {
    return transactions.filter(t => t.type === 'income' && t.payment_status !== 'paid').length;
  }, [transactions]);

  return (
    <div className="space-y-6" id="transactions-section">
      
      {/* Category Management Modal */}
      <CategoryManagerModal
        isOpen={isCatModalOpen}
        onClose={() => setIsCatModalOpen(false)}
        onCategoriesChanged={handleCategoriesChanged}
        initialType={showForm === 'expense' ? 'expense' : 'income'}
        userId={userId}
      />

      {/* Pelunasan Confirmation Modal */}
      <PelunasanModal
        transaction={pelunasanTx}
        onClose={() => setPelunasanTx(null)}
        onConfirmPelunasan={(updatedTx) => {
          onUpdateTransaction(updatedTx);
          setPelunasanTx(null);
        }}
      />

      {/* Top Banner & Fast Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Catatan Kas & Transaksi</h2>
          <p className="text-sm text-slate-500 mt-1">
            Kelola pencatatan pengeluaran operasional, pemasukan usaha, dan pelunasan piutang DP.
          </p>
        </div>
        
        {!showForm && (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setIsCatModalOpen(true)}
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-3.5 py-2.5 rounded-xl transition-all cursor-pointer"
              title="Kelola Kategori Kustom"
            >
              <Tag className="w-3.5 h-3.5 text-indigo-600" />
              Kelola Kategori
            </button>
            <button
              onClick={() => setShowForm('income')}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-4 py-2.5 rounded-xl shadow-xs hover:shadow transition-all cursor-pointer"
              id="btn-tambah-pemasukan"
            >
              <PlusCircle className="w-4 h-4" />
              Pemasukan
            </button>
            <button
              onClick={() => setShowForm('expense')}
              className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm px-4 py-2.5 rounded-xl shadow-xs hover:shadow transition-all cursor-pointer"
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
              className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
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
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                  />
                </div>
              </div>

              {/* Field: Kategori + Quick Manage Button */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Kategori</label>
                  <button
                    type="button"
                    onClick={() => setIsCatModalOpen(true)}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    + Kelola
                  </button>
                </div>
                <div className="relative">
                  <BookOpen className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm appearance-none cursor-pointer"
                  >
                    {showForm === 'income' 
                      ? categoriesList.income.map(c => <option key={c} value={c}>{c}</option>)
                      : categoriesList.expense.map(c => <option key={c} value={c}>{c}</option>)
                    }
                  </select>
                </div>
              </div>

              {/* Field: Total Nominal (Rp) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  {showForm === 'income' ? 'Total Nilai Deal / Project (Rp)' : 'Nominal / Jumlah (Rp)'}
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="number"
                    required
                    placeholder="Contoh: 3000000"
                    value={formAmount}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormAmount(val);
                      // Auto calculate 50% DP default if DP empty
                      if (showForm === 'income' && formPaymentStatus === 'partial' && (!formDpAmount || Number(formDpAmount) === Math.round(Number(formAmount) / 2))) {
                        const num = Number(val);
                        if (!isNaN(num) && num > 0) {
                          setFormDpAmount(String(Math.round(num / 2)));
                        }
                      }
                    }}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-bold placeholder:font-normal focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
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
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
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
                      onChange={(e) => {
                        const newStatus = e.target.value as any;
                        setFormPaymentStatus(newStatus);
                        if (newStatus === 'partial' && !formDpAmount) {
                          const num = Number(formAmount);
                          if (!isNaN(num) && num > 0) {
                            setFormDpAmount(String(Math.round(num / 2)));
                          }
                        }
                      }}
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm appearance-none cursor-pointer"
                    >
                      <option value="paid">Lunas (100% Paid)</option>
                      <option value="partial">Bayar Sebagian (DP)</option>
                      <option value="unpaid">Belum Lunas (Unpaid / Piutang)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Field: Nominal DP (Pemasukan with Status 'partial' Only) */}
              {showForm === 'income' && formPaymentStatus === 'partial' && (
                <div className="space-y-1.5 animate-fade-in">
                  <label className="block text-xs font-bold uppercase tracking-wider text-amber-600">Nominal DP Masuk (Rp)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
                    <input
                      type="number"
                      required
                      placeholder="Masukkan nominal DP yang dibayarkan"
                      value={formDpAmount}
                      onChange={(e) => setFormDpAmount(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-amber-50/50 border border-amber-300 rounded-xl text-slate-800 font-bold focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm"
                    />
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
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                  />
                </div>
              </div>

            </div>

            {/* Live Calculation Feedback for DP Partial Income */}
            {showForm === 'income' && formPaymentStatus === 'partial' && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1 text-amber-900 animate-fade-in">
                <div className="flex flex-wrap items-center justify-between gap-2 font-medium">
                  <span>Pemasukan Kas Tercatat (DP): <strong className="text-emerald-700">{formatIDR(Number(formDpAmount) || 0)}</strong></span>
                  <span>Sisa Piutang: <strong className="text-amber-700">{formatIDR(Math.max(0, (Number(formAmount) || 0) - (Number(formDpAmount) || 0)))}</strong></span>
                </div>
                <p className="text-[11px] text-amber-700">
                  * Uang yang masuk ke catatan pemasukan kas hanya sebesar nominal DP. Sisa piutang dapat dilunasi kapan saja melalui tombol "Lunas".
                </p>
              </div>
            )}

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
                className={`px-5 py-2.5 rounded-xl font-bold text-sm text-white shadow-xs hover:shadow transition-all cursor-pointer ${
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
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
            />
          </div>

          {/* Type Filter Tabs */}
          <div className="flex flex-wrap gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200 self-start md:self-auto">
            <button
              onClick={() => { setFilterType('all'); setFilterCategory('all'); }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterType === 'all' 
                  ? 'bg-white text-indigo-600 shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => { setFilterType('income'); setFilterCategory('all'); }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterType === 'income' 
                  ? 'bg-white text-emerald-600 shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Masuk (Pemasukan)
            </button>
            <button
              onClick={() => { setFilterType('expense'); setFilterCategory('all'); }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterType === 'expense' 
                  ? 'bg-white text-rose-600 shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Keluar (Pengeluaran)
            </button>
            <button
              onClick={() => { setFilterType('piutang'); setFilterCategory('all'); }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterType === 'piutang' 
                  ? 'bg-amber-500 text-white shadow-xs' 
                  : 'text-amber-700 hover:bg-amber-100/60'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Piutang / DP Pending ({piutangCount})
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
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">Semua Kategori</option>
              {(filterType === 'all' || filterType === 'piutang') && (
                <>
                  <option disabled value="">── Kategori Pemasukan ──</option>
                  {categoriesList.income.map(c => <option key={`inc-${c}`} value={c}>Masuk: {c}</option>)}
                  <option disabled value="">── Kategori Pengeluaran ──</option>
                  {categoriesList.expense.map(c => <option key={`exp-${c}`} value={c}>Keluar: {c}</option>)}
                </>
              )}
              {filterType === 'income' && categoriesList.income.map(c => <option key={c} value={c}>{c}</option>)}
              {filterType === 'expense' && categoriesList.expense.map(c => <option key={c} value={c}>{c}</option>)}
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

        {/* Mobile View: Cards */}
        <div className="block md:hidden divide-y divide-slate-100">
          {filteredTransactions.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-sm">
              Tidak ditemukan transaksi yang cocok dengan kriteria filter Anda.
            </div>
          ) : (
            filteredTransactions.map((t) => {
              const actualReceived = getActualIncomeAmount(t);
              const remainingPiutang = getPiutangAmount(t);

              return (
                <div key={`m-${t.id}`} className="p-4 hover:bg-slate-50/50 transition-colors space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          t.type === 'income' 
                            ? 'bg-emerald-50 text-emerald-700' 
                            : 'bg-rose-50 text-rose-700'
                        }`}>
                          {t.type === 'income' ? 'Masuk' : 'Keluar'}
                        </span>
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-[11px] font-bold">
                          {t.category}
                        </span>
                      </div>
                      <p className="font-bold text-slate-800 text-sm">{t.client_name || t.category}</p>
                      <p className="text-xs text-slate-500">{t.notes || 'Tanpa keterangan'}</p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`block font-extrabold text-sm ${t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {t.type === 'income' ? '+' : '-'} {formatIDR(t.type === 'income' ? actualReceived : t.amount)}
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium">
                        {formatShortDate(t.date)}
                      </span>
                    </div>
                  </div>

                  {t.type === 'income' && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-50 text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.payment_status === 'paid' 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : t.payment_status === 'partial' 
                            ? 'bg-amber-100 text-amber-800' 
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {t.payment_status === 'paid' ? 'Lunas' : t.payment_status === 'partial' ? 'DP (Sebagian)' : 'Belum Lunas'}
                        </span>
                        {t.payment_status !== 'paid' && remainingPiutang > 0 && (
                          <span className="font-semibold text-amber-600 text-[11px]">
                            Sisa: {formatIDR(remainingPiutang)}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-50">
                    {t.type === 'income' && t.payment_status !== 'paid' && (
                      <button
                        onClick={() => setPelunasanTx(t)}
                        className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Lunas
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setEditingTransaction(t);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="p-1.5 bg-slate-50 hover:bg-indigo-50 text-slate-600 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Yakin ingin menghapus transaksi ini?\nKlien: ${t.client_name || '-'}\nNominal: ${formatIDR(t.amount)}`)) {
                          onDeleteTransaction(t.id);
                        }
                      }}
                      className="p-1.5 bg-slate-50 hover:bg-rose-50 text-rose-600 border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[750px] text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-100">
                <th className="py-3 px-6">Tanggal</th>
                <th className="py-3 px-6">Jenis</th>
                <th className="py-3 px-6">Kategori</th>
                <th className="py-3 px-6">Klien & Keterangan</th>
                <th className="py-3 px-6">Status Pembayaran</th>
                <th className="py-3 px-6 text-right">Pemasukan Kas</th>
                <th className="py-3 px-6 text-center">Aksi & Pelunasan</th>
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
                filteredTransactions.map((t) => {
                  const actualReceived = getActualIncomeAmount(t);
                  const remainingPiutang = getPiutangAmount(t);

                  return (
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
                          <div className="space-y-1">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold ${
                              t.payment_status === 'paid' 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : t.payment_status === 'partial' 
                                ? 'bg-amber-100 text-amber-800' 
                                : 'bg-rose-100 text-rose-800'
                            }`}>
                              {t.payment_status === 'paid' ? 'Lunas' : t.payment_status === 'partial' ? 'DP (Sebagian)' : 'Belum Lunas'}
                            </span>
                            {t.payment_status !== 'paid' && remainingPiutang > 0 && (
                              <p className="text-[11px] font-semibold text-amber-600">
                                Sisa Piutang: {formatIDR(remainingPiutang)}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>

                      {/* Jumlah (Kas Real) */}
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        {t.type === 'income' ? (
                          <div>
                            <span className="font-bold text-emerald-600">
                              + {formatIDR(actualReceived)}
                            </span>
                            {t.payment_status === 'partial' && (
                              <p className="text-[10px] text-slate-400 font-medium">
                                Nilai Project : {formatIDR(t.amount)}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="font-bold text-rose-600">
                            - {formatIDR(t.amount)}
                          </span>
                        )}
                      </td>

                      {/* Aksi & Pelunasan */}
                      <td className="py-4 px-6 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          
                          {/* Tombol Lunas (if piutang / partial / unpaid) */}
                          {t.type === 'income' && t.payment_status !== 'paid' && (
                            <button
                              onClick={() => setPelunasanTx(t)}
                              className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-2xs hover:shadow cursor-pointer"
                              title="Lunas (Pelunasan Piutang)"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Lunas
                            </button>
                          )}

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
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
      </div>

    </div>
  );
}
