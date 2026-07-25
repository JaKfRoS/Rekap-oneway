import React, { useState, useEffect } from 'react';
import { X, Plus, Edit2, Trash2, Check, AlertCircle, Tag } from 'lucide-react';
import { 
  getCategories, 
  addCategory, 
  updateCategory, 
  deleteCategory, 
  CategoryData 
} from '../utils/categories';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCategoriesChanged: () => void;
  initialType?: 'income' | 'expense';
}

export default function CategoryManagerModal({
  isOpen,
  onClose,
  onCategoriesChanged,
  initialType = 'income'
}: CategoryManagerModalProps) {
  const [activeTab, setActiveTab] = useState<'income' | 'expense'>(initialType);
  const [categories, setCategories] = useState<CategoryData>({ income: [], expense: [] });
  const [newCatName, setNewCatName] = useState('');
  
  // Inline edit state
  const [editingCatName, setEditingCatName] = useState<string | null>(null);
  const [editInputValue, setEditInputValue] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialType);
      refreshData();
    }
  }, [isOpen, initialType]);

  const refreshData = () => {
    const data = getCategories();
    setCategories(data);
    setErrorMsg('');
  };

  if (!isOpen) return null;

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const trimmed = newCatName.trim();
    if (!trimmed) return;

    const list = activeTab === 'income' ? categories.income : categories.expense;
    if (list.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      setErrorMsg(`Kategori "${trimmed}" sudah ada.`);
      return;
    }

    addCategory(activeTab, trimmed);
    setNewCatName('');
    refreshData();
    onCategoriesChanged();
  };

  const handleStartEdit = (catName: string) => {
    setEditingCatName(catName);
    setEditInputValue(catName);
    setErrorMsg('');
  };

  const handleSaveEdit = (oldName: string) => {
    setErrorMsg('');
    const trimmed = editInputValue.trim();
    if (!trimmed) {
      setErrorMsg('Nama kategori tidak boleh kosong.');
      return;
    }

    const list = activeTab === 'income' ? categories.income : categories.expense;
    if (trimmed.toLowerCase() !== oldName.toLowerCase() && list.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      setErrorMsg(`Kategori "${trimmed}" sudah ada.`);
      return;
    }

    updateCategory(activeTab, oldName, trimmed);
    setEditingCatName(null);
    refreshData();
    onCategoriesChanged();
  };

  const handleDelete = (catName: string) => {
    setErrorMsg('');
    const list = activeTab === 'income' ? categories.income : categories.expense;
    if (list.length <= 1) {
      setErrorMsg('Minimal harus ada 1 kategori.');
      return;
    }

    if (window.confirm(`Yakin ingin menghapus kategori "${catName}"?`)) {
      deleteCategory(activeTab, catName);
      refreshData();
      onCategoriesChanged();
    }
  };

  const currentList = activeTab === 'income' ? categories.income : categories.expense;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">Kelola Kategori Transaksi</h3>
              <p className="text-xs text-slate-500">Tambah, ubah, atau hapus kategori kustom</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-100 bg-slate-50/50 p-2 gap-2">
          <button
            onClick={() => { setActiveTab('income'); setErrorMsg(''); setEditingCatName(null); }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'income' 
                ? 'bg-emerald-600 text-white shadow-xs' 
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Pemasukan ({categories.income.length})
          </button>
          <button
            onClick={() => { setActiveTab('expense'); setErrorMsg(''); setEditingCatName(null); }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'expense' 
                ? 'bg-rose-600 text-white shadow-xs' 
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Pengeluaran ({categories.expense.length})
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          
          {errorMsg && (
            <div className="flex items-center gap-2 bg-rose-50 border border-rose-100 text-rose-700 p-3 rounded-xl text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form Add New Category */}
          <form onSubmit={handleAddCategory} className="flex gap-2">
            <input
              type="text"
              placeholder={`Tambah kategori ${activeTab === 'income' ? 'pemasukan' : 'pengeluaran'} baru...`}
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-medium"
            />
            <button
              type="submit"
              disabled={!newCatName.trim()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs flex items-center gap-1 shadow-xs transition-all cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              Tambah
            </button>
          </form>

          {/* List of categories */}
          <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Daftar Kategori Terdaftar
            </label>
            
            {currentList.map((catName) => (
              <div 
                key={catName} 
                className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-100 transition-colors"
              >
                {editingCatName === catName ? (
                  <div className="flex items-center gap-2 w-full">
                    <input
                      type="text"
                      value={editInputValue}
                      onChange={(e) => setEditInputValue(e.target.value)}
                      className="flex-1 px-2.5 py-1 bg-white border border-indigo-400 rounded-lg text-xs font-semibold text-slate-800 outline-none"
                      autoFocus
                    />
                    <button
                      onClick={() => handleSaveEdit(catName)}
                      className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer"
                      title="Simpan"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setEditingCatName(null)}
                      className="p-1.5 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition-colors cursor-pointer"
                      title="Batal"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="text-xs font-semibold text-slate-700">
                      {catName}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleStartEdit(catName)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                        title="Ubah nama"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(catName)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Hapus"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
          >
            Selesai
          </button>
        </div>

      </div>
    </div>
  );
}
