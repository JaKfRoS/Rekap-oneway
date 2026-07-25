import React, { useState, useEffect } from 'react';
import { X, CheckCircle, Calendar, FileText, User, DollarSign, AlertCircle } from 'lucide-react';
import { Transaction } from '../utils/dummyData';
import { formatIDR, formatShortDate, getActualIncomeAmount, getPiutangAmount } from '../utils/formatters';

interface PelunasanModalProps {
  transaction: Transaction | null;
  onClose: () => void;
  onConfirmPelunasan: (updatedTx: Transaction) => void;
}

export default function PelunasanModal({
  transaction,
  onClose,
  onConfirmPelunasan
}: PelunasanModalProps) {
  const [settleDate, setSettleDate] = useState(new Date().toISOString().split('T')[0]);
  const [settleNote, setSettleNote] = useState('');

  useEffect(() => {
    if (transaction) {
      setSettleDate(new Date().toISOString().split('T')[0]);
      setSettleNote('');
    }
  }, [transaction]);

  if (!transaction) return null;

  const currentReceived = getActualIncomeAmount(transaction);
  const remainingPiutang = getPiutangAmount(transaction);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const appendNote = settleNote.trim() 
      ? ` | Pelunasan Rp ${formatIDR(remainingPiutang)} tgl ${formatShortDate(settleDate)} (${settleNote.trim()})`
      : ` | Pelunasan Rp ${formatIDR(remainingPiutang)} tgl ${formatShortDate(settleDate)}`;

    const updatedTx: Transaction = {
      ...transaction,
      payment_status: 'paid',
      dp_amount: transaction.amount, // Now fully paid
      notes: (transaction.notes || '') + appendNote
    };

    onConfirmPelunasan(updatedTx);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden">
        
        {/* Header */}
        <div className="p-5 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-amber-900 text-base">Pelunasan Piutang / Tagihan</h3>
              <p className="text-xs text-amber-700">Konfirmasi pencatatan sisa pembayaran dari klien</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-amber-200/50 rounded-xl text-amber-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          {/* Detail Card Summary */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex justify-between items-start border-b border-slate-200/60 pb-2.5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Nama Klien / Project</p>
                <p className="font-bold text-slate-800 text-sm">{transaction.client_name || '-'}</p>
              </div>
              <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full">
                {transaction.payment_status === 'partial' ? 'DP (Sebagian)' : 'Belum Lunas'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs pt-1">
              <div>
                <p className="text-slate-400 font-medium">Nilai Total</p>
                <p className="font-bold text-slate-800 mt-0.5">{formatIDR(transaction.amount)}</p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">DP Masuk</p>
                <p className="font-bold text-emerald-600 mt-0.5">{formatIDR(currentReceived)}</p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">Sisa Piutang</p>
                <p className="font-bold text-amber-600 mt-0.5">{formatIDR(remainingPiutang)}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            
            {/* Field: Tanggal Pelunasan */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Tanggal Pelunasan Diterima</label>
              <div className="relative">
                <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  required
                  value={settleDate}
                  onChange={(e) => setSettleDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm"
                />
              </div>
            </div>

            {/* Field: Catatan Pelunasan */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Catatan Pelunasan (Opsional)</label>
              <div className="relative">
                <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Contoh: Transfer Lunas via Bank BCA"
                  value={settleNote}
                  onChange={(e) => setSettleNote(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm"
                />
              </div>
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 text-xs flex items-start gap-2">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <div>
                <p className="font-bold">Efek Perubahan Kas:</p>
                <p className="mt-0.5">
                  Pemasukan kas akan bertambah sebesar <strong>+{formatIDR(remainingPiutang)}</strong> dan status transaksi diubah menjadi <strong className="uppercase">Lunas</strong>.
                </p>
              </div>
            </div>

          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-semibold text-sm transition-all cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-xs hover:shadow transition-all cursor-pointer flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Proses & Tandai Lunas
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
