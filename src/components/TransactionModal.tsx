import React, { useState, useEffect } from 'react';
import { 
  X, 
  Calendar, 
  User, 
  DollarSign, 
  BookOpen, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  AlertCircle, 
  CheckCircle, 
  Tag,
  PlusCircle,
  FileText
} from 'lucide-react';
import { Transaction } from '../utils/dummyData';
import { formatIDR } from '../utils/formatters';
import { CategoryData } from '../utils/categories';

interface TransactionModalProps {
  isOpen: boolean;
  initialType: 'income' | 'expense';
  onClose: () => void;
  onSubmit: (payload: {
    date: string;
    type: 'income' | 'expense';
    category: string;
    client_name: string | null;
    amount: number;
    dp_amount: number;
    payment_status: 'paid' | 'unpaid' | 'partial';
    notes: string;
  }) => void;
  editingTransaction: Transaction | null;
  categoriesList: CategoryData;
  onOpenCategoryManager: () => void;
}

export default function TransactionModal({
  isOpen,
  initialType,
  onClose,
  onSubmit,
  editingTransaction,
  categoriesList,
  onOpenCategoryManager
}: TransactionModalProps) {
  const [type, setType] = useState<'income' | 'expense'>(initialType);

  // Form States
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formCategory, setFormCategory] = useState('');
  const [formClientName, setFormClientName] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDpAmount, setFormDpAmount] = useState('');
  const [formPaymentStatus, setFormPaymentStatus] = useState<'paid' | 'unpaid' | 'partial'>('paid');
  const [formNotes, setFormNotes] = useState('');
  
  // Validation Error State
  const [valError, setValError] = useState('');

  // Sync state when modal opens or editing transaction changes
  useEffect(() => {
    if (!isOpen) return;

    if (editingTransaction) {
      setType(editingTransaction.type);
      setFormDate(editingTransaction.date || new Date().toISOString().split('T')[0]);
      setFormCategory(editingTransaction.category || '');
      setFormClientName(editingTransaction.client_name || '');
      setFormAmount(String(editingTransaction.amount || ''));
      setFormDpAmount(editingTransaction.dp_amount ? String(editingTransaction.dp_amount) : '');
      setFormPaymentStatus(editingTransaction.payment_status || 'paid');
      setFormNotes(editingTransaction.notes || '');
      setValError('');
    } else {
      const activeType = initialType;
      setType(activeType);
      setFormDate(new Date().toISOString().split('T')[0]);
      
      const cats = activeType === 'income' ? categoriesList.income : categoriesList.expense;
      setFormCategory(cats[0] || (activeType === 'income' ? 'Pembuatan Toko' : 'Operational'));
      
      setFormClientName('');
      setFormAmount('');
      setFormDpAmount('');
      setFormPaymentStatus('paid');
      setFormNotes('');
      setValError('');
    }
  }, [isOpen, editingTransaction, initialType, categoriesList]);

  // Handle category default when type changes inside modal
  const handleTypeChange = (newType: 'income' | 'expense') => {
    setType(newType);
    setValError('');
    const cats = newType === 'income' ? categoriesList.income : categoriesList.expense;
    if (!cats.includes(formCategory)) {
      setFormCategory(cats[0] || (newType === 'income' ? 'Pembuatan Toko' : 'Operational'));
    }
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValError('');

    // Validations
    if (!formDate) {
      setValError('Tanggal transaksi wajib diisi.');
      return;
    }

    const numAmount = Number(formAmount.replace(/[^0-9.-]+/g, ""));
    if (isNaN(numAmount) || numAmount <= 0) {
      setValError('Nominal transaksi harus berupa angka lebih dari 0.');
      return;
    }

    let numDpAmount = 0;
    if (type === 'income' && formPaymentStatus === 'partial') {
      numDpAmount = Number(formDpAmount.replace(/[^0-9.-]+/g, ""));
      if (isNaN(numDpAmount) || numDpAmount <= 0) {
        setValError('Nominal DP (Down Payment) harus berupa angka positif.');
        return;
      }
      if (numDpAmount >= numAmount) {
        setValError('Nominal DP harus lebih kecil dari Total Deal (jika sudah lunas, pilih status "Lunas").');
        return;
      }
    } else if (type === 'income' && formPaymentStatus === 'paid') {
      numDpAmount = numAmount;
    }

    if (type === 'income' && !formClientName.trim()) {
      setValError('Nama Klien / Project wajib diisi untuk transaksi pemasukan.');
      return;
    }

    if (!formCategory) {
      setValError('Pilih kategori transaksi.');
      return;
    }

    onSubmit({
      date: formDate,
      type,
      category: formCategory,
      client_name: type === 'income' ? formClientName.trim() : null,
      amount: numAmount,
      dp_amount: type === 'income' && formPaymentStatus === 'partial' ? numDpAmount : (formPaymentStatus === 'paid' ? numAmount : 0),
      payment_status: type === 'income' ? formPaymentStatus : 'paid',
      notes: formNotes.trim()
    });
  };

  const isIncome = type === 'income';

  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-100 relative my-8 overflow-hidden text-slate-800 animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className={`p-6 sm:px-8 sm:pt-8 sm:pb-6 ${isIncome ? 'bg-emerald-50/70 border-b border-emerald-100' : 'bg-rose-50/70 border-b border-rose-100'}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md ${
                isIncome 
                  ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-emerald-500/20' 
                  : 'bg-gradient-to-tr from-rose-600 to-pink-500 shadow-rose-500/20'
              }`}>
                {isIncome ? <ArrowUpCircle className="w-6 h-6" /> : <ArrowDownCircle className="w-6 h-6" />}
              </div>
              <div>
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider mb-1 ${
                  isIncome ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {editingTransaction ? 'Mode Edit' : 'Catat Transaksi'}
                </span>
                <h3 className="text-xl font-bold text-slate-900">
                  {editingTransaction ? 'Edit Data Transaksi' : (isIncome ? 'Tambah Pemasukan Kas' : 'Tambah Pengeluaran Kas')}
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white/80 rounded-full transition-all cursor-pointer"
              title="Tutup Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Type Selector Tabs (Only if creating new transaction) */}
          {!editingTransaction && (
            <div className="mt-5 p-1 bg-white/80 backdrop-blur-xs rounded-2xl border border-slate-200/80 flex gap-1">
              <button
                type="button"
                onClick={() => handleTypeChange('income')}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  isIncome 
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
                }`}
              >
                <ArrowUpCircle className="w-4 h-4" />
                Pemasukan (+)
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange('expense')}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  !isIncome 
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
                }`}
              >
                <ArrowDownCircle className="w-4 h-4" />
                Pengeluaran (-)
              </button>
            </div>
          )}
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5">
          {/* Validation Error Alert */}
          {valError && (
            <div className="flex items-center gap-2.5 bg-rose-50 text-rose-700 p-3.5 rounded-2xl border border-rose-200 text-xs font-medium animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{valError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Field 1: Tanggal Transaksi */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                Tanggal Transaksi
              </label>
              <div className="relative">
                <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  required
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm transition-all"
                />
              </div>
            </div>

            {/* Field 2: Kategori */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Kategori
                </label>
                <button
                  type="button"
                  onClick={onOpenCategoryManager}
                  className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Tag className="w-3 h-3" />
                  + Kelola
                </button>
              </div>
              <div className="relative">
                <BookOpen className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm appearance-none cursor-pointer transition-all"
                >
                  {isIncome 
                    ? categoriesList.income.map(c => <option key={c} value={c}>{c}</option>)
                    : categoriesList.expense.map(c => <option key={c} value={c}>{c}</option>)
                  }
                </select>
              </div>
            </div>

            {/* Field 3: Nominal / Total Deal */}
            <div className={`space-y-1.5 ${isIncome ? 'sm:col-span-2' : 'sm:col-span-2'}`}>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                {isIncome ? 'Total Nilai Deal / Project (Rp)' : 'Nominal Pengeluaran (Rp)'}
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">Rp</span>
                <input
                  type="number"
                  required
                  placeholder="Contoh: 1500000"
                  value={formAmount}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormAmount(val);
                    if (isIncome && formPaymentStatus === 'partial' && (!formDpAmount || Number(formDpAmount) === Math.round(Number(formAmount) / 2))) {
                      const num = Number(val);
                      if (!isNaN(num) && num > 0) {
                        setFormDpAmount(String(Math.round(num / 2)));
                      }
                    }
                  }}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-xl text-slate-800 font-bold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-base transition-all"
                />
              </div>
            </div>

            {/* Income Specific Fields */}
            {isIncome && (
              <>
                {/* Field 4: Nama Klien / Project */}
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                    Nama Klien / Instansi / Project
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Masukkan nama klien atau instansi"
                      value={formClientName}
                      onChange={(e) => setFormClientName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm transition-all"
                    />
                  </div>
                </div>

                {/* Field 5: Status Pembayaran */}
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                    Status Pembayaran
                  </label>
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
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm appearance-none cursor-pointer transition-all"
                    >
                      <option value="paid">Lunas (100% Paid)</option>
                      <option value="partial">Bayar Sebagian (DP / Down Payment)</option>
                      <option value="unpaid">Belum Lunas (Unpaid / Piutang)</option>
                    </select>
                  </div>
                </div>

                {/* Field 6: Nominal DP (If status == partial) */}
                {formPaymentStatus === 'partial' && (
                  <div className="space-y-1.5 sm:col-span-2 animate-fade-in">
                    <label className="block text-xs font-bold uppercase tracking-wider text-amber-600">
                      Nominal DP Masuk Sekarang (Rp)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-amber-500 text-sm">Rp</span>
                      <input
                        type="number"
                        required
                        placeholder="Masukkan nominal DP"
                        value={formDpAmount}
                        onChange={(e) => setFormDpAmount(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-amber-50/60 border border-amber-300 rounded-xl text-slate-900 font-bold focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm transition-all"
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Field 7: Keterangan / Catatan */}
            <div className="space-y-1.5 sm:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                Keterangan / Catatan Tambahan
              </label>
              <div className="relative">
                <FileText className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <textarea
                  rows={2}
                  placeholder="Tambahkan rincian atau keterangan transaksi ini..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm resize-none transition-all"
                />
              </div>
            </div>

          </div>

          {/* Live DP Calculation Card */}
          {isIncome && formPaymentStatus === 'partial' && (
            <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-2xl text-xs space-y-1 text-amber-900 animate-fade-in shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 font-bold text-xs">
                <span>Kas Masuk (DP): <strong className="text-emerald-700 text-sm">{formatIDR(Number(formDpAmount) || 0)}</strong></span>
                <span>Sisa Piutang: <strong className="text-amber-700 text-sm">{formatIDR(Math.max(0, (Number(formAmount) || 0) - (Number(formDpAmount) || 0)))}</strong></span>
              </div>
              <p className="text-[11px] text-amber-700/80 mt-1">
                * Kas tercatat sebesar nominal DP. Piutang dapat dilunasi kapan saja melalui tombol "Pelunasan".
              </p>
            </div>
          )}

          {/* Action Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-semibold text-sm transition-all cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className={`px-6 py-2.5 rounded-xl font-bold text-sm text-white shadow-md hover:shadow-lg transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2 ${
                isIncome 
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700' 
                  : 'bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              {editingTransaction ? 'Simpan Perubahan' : (isIncome ? 'Simpan Pemasukan' : 'Simpan Pengeluaran')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
