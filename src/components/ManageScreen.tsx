/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Plus,
  Pencil,
  Scale,
  Archive,
  Trash2,
  Download,
  FileText,
  FileSpreadsheet,
  X,
  Check,
  Tag,
  Search,
  AlertTriangle,
} from 'lucide-react';
import { Account, AccountType, CurrencyCode, Transaction, UserProfile } from '../types/finance';
import { CategoryItem, StorageService } from '../services/storageService';
import { formatCurrency, getCachedRates } from '../services/currencyService';
import { ExportService } from '../services/exportService';
import { DynamicIcon, IconPickerModal, ColorPicker } from './IconAndColorPicker';

interface ManageScreenProps {
  profile: UserProfile;
  accounts: Account[];
  categories: CategoryItem[];
  transactions: Transaction[];
  onAddAccount: (acc: any) => void;
  onUpdateAccount: (acc: Account) => void;
  onAdjustBalance: (id: string, newBalance: number, notes?: string) => void;
  onToggleArchive: (id: string) => void;
  onDeleteAccount: (id: string) => void;
  onAddCategory: (cat: any) => void;
  onUpdateCategory?: (cat: CategoryItem) => void;
  onDeleteCategory: (id: string) => void;
  initialOpenAddAccount?: boolean;
}

export const ManageScreen: React.FC<ManageScreenProps> = ({
  profile,
  accounts,
  categories,
  transactions,
  onAddAccount,
  onUpdateAccount,
  onAdjustBalance,
  onToggleArchive,
  onDeleteAccount,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  initialOpenAddAccount = false,
}) => {
  const prefCurrency = profile.preferredCurrency;
  const rates = getCachedRates().rates;

  // Segmented Tabs: Accounts (count), Categories (count), Statement & Export
  const [activeTab, setActiveTab] = useState<'accounts' | 'categories' | 'export'>('accounts');

  // Account Modals & State
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(initialOpenAddAccount);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustingAccount, setAdjustingAccount] = useState<Account | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustNotes, setAdjustNotes] = useState('');

  // Account Form State
  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState<AccountType>('bank');
  const [accBalance, setAccBalance] = useState('');
  const [accCurrency, setAccCurrency] = useState<CurrencyCode>(prefCurrency);
  const [accColor, setAccColor] = useState('#2563EB');
  const [accIcon, setAccIcon] = useState('Landmark');
  const [accNotes, setAccNotes] = useState('');
  const [isAccIconPickerOpen, setIsAccIconPickerOpen] = useState(false);

  // Category State & Modals
  const [categorySearch, setCategorySearch] = useState('');
  const [categoryTypeFilter, setCategoryTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);

  // Category Form State
  const [catName, setCatName] = useState('');
  const [catType, setCatType] = useState<'expense' | 'income'>('expense');
  const [catColor, setCatColor] = useState('#F59E0B');
  const [catIcon, setCatIcon] = useState('Tag');
  const [catIsDefault, setCatIsDefault] = useState(false);
  const [isCatIconPickerOpen, setIsCatIconPickerOpen] = useState(false);

  // Safe Category Deletion Dialog
  const [deletingCat, setDeletingCat] = useState<CategoryItem | null>(null);
  const [affectedTxCount, setAffectedTxCount] = useState<number>(0);

  // Account Form Handlers
  const handleOpenCreateAccount = () => {
    setAccName('');
    setAccType('bank');
    setAccBalance('');
    setAccCurrency(prefCurrency);
    setAccColor('#2563EB');
    setAccIcon('Landmark');
    setAccNotes('');
    setEditingAccount(null);
    setIsAddAccountModalOpen(true);
  };

  const handleOpenEditAccount = (acc: Account) => {
    setEditingAccount(acc);
    setAccName(acc.name);
    setAccType(acc.type);
    setAccBalance(acc.balance.toString());
    setAccCurrency(acc.currency);
    setAccColor(acc.color || '#2563EB');
    setAccIcon(acc.icon || 'Landmark');
    setAccNotes(acc.notes || '');
    setIsAddAccountModalOpen(true);
  };

  const handleAccountFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accName.trim()) return;
    const bal = parseFloat(accBalance) || 0;

    if (editingAccount) {
      onUpdateAccount({
        ...editingAccount,
        name: accName.trim().toUpperCase(),
        type: accType,
        color: accColor,
        icon: accIcon,
        notes: accNotes.trim(),
        updatedAt: new Date().toISOString(),
      });
    } else {
      onAddAccount({
        name: accName.trim().toUpperCase(),
        type: accType,
        balance: bal,
        openingPosition: bal,
        currency: accCurrency,
        color: accColor,
        icon: accIcon,
        notes: accNotes.trim(),
      });
    }

    setIsAddAccountModalOpen(false);
    setEditingAccount(null);
  };

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingAccount) return;
    const newBal = parseFloat(adjustAmount);
    if (isNaN(newBal)) return;

    onAdjustBalance(adjustingAccount.id, newBal, adjustNotes);
    setIsAdjustModalOpen(false);
    setAdjustingAccount(null);
    setAdjustAmount('');
    setAdjustNotes('');
  };

  // Category Form Handlers
  const handleOpenCreateCategory = () => {
    setCatName('');
    setCatType('expense');
    setCatColor('#F59E0B');
    setCatIcon('Tag');
    setCatIsDefault(false);
    setEditingCategory(null);
    setIsAddCategoryOpen(true);
  };

  const handleOpenEditCategory = (cat: CategoryItem) => {
    setEditingCategory(cat);
    setCatName(cat.name);
    setCatType(cat.type);
    setCatColor(cat.color);
    setCatIcon(cat.icon || 'Tag');
    setCatIsDefault(Boolean(cat.isDefault));
    setIsAddCategoryOpen(true);
  };

  const handleCategoryFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;

    if (editingCategory) {
      const updated: CategoryItem = {
        ...editingCategory,
        name: catName.trim(),
        type: catType,
        color: catColor,
        icon: catIcon,
        isDefault: catIsDefault,
      };
      if (onUpdateCategory) {
        onUpdateCategory(updated);
      } else {
        StorageService.updateCategory(updated);
      }
    } else {
      onAddCategory({
        name: catName.trim(),
        type: catType,
        color: catColor,
        icon: catIcon,
        isDefault: catIsDefault,
      });
    }

    setIsAddCategoryOpen(false);
    setEditingCategory(null);
  };

  const handlePromptDeleteCategory = (cat: CategoryItem) => {
    const txs = StorageService.getTransactionsUsingCategory(cat.name);
    setAffectedTxCount(txs.length);
    setDeletingCat(cat);
  };

  const handleConfirmDeleteCategory = () => {
    if (!deletingCat) return;
    StorageService.deleteCategory(deletingCat.id, 'General');
    onDeleteCategory(deletingCat.id);
    setDeletingCat(null);
  };

  // Filter Categories
  const filteredCategories = categories.filter((cat) => {
    if (categoryTypeFilter !== 'all' && cat.type !== categoryTypeFilter) return false;
    if (categorySearch.trim()) {
      return cat.name.toLowerCase().includes(categorySearch.toLowerCase());
    }
    return true;
  });

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-4 pb-28 md:pb-12 space-y-5">
      {/* 1. Horizontally Scrollable Segmented Navigation Tabs (Requirement 7 - No Clipping) */}
      <div className="bg-[#EEF2F6] dark:bg-slate-800 p-1 rounded-2xl flex items-center gap-1 overflow-x-auto scrollbar-none shadow-2xs">
        <button
          onClick={() => setActiveTab('accounts')}
          className={`flex-1 min-w-[120px] py-2.5 px-3 text-center rounded-xl transition cursor-pointer text-xs whitespace-nowrap ${
            activeTab === 'accounts'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Accounts ({accounts.length})
        </button>

        <button
          onClick={() => setActiveTab('categories')}
          className={`flex-1 min-w-[130px] py-2.5 px-3 text-center rounded-xl transition cursor-pointer text-xs whitespace-nowrap ${
            activeTab === 'categories'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Categories ({categories.length})
        </button>

        <button
          onClick={() => setActiveTab('export')}
          className={`flex-1 min-w-[150px] py-2.5 px-3 text-center rounded-xl transition cursor-pointer text-xs whitespace-nowrap ${
            activeTab === 'export'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Statement & Export
        </button>
      </div>

      {/* TAB 1: ACCOUNTS */}
      {activeTab === 'accounts' && (
        <div className="space-y-4">
          {/* Top Action Row */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Manage Your Accounts ({accounts.length})
            </span>
            <button
              onClick={handleOpenCreateAccount}
              className="py-2.5 px-4 rounded-xl bg-[#0B1528] hover:bg-[#111e38] text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-md active:scale-[0.99] transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Account</span>
            </button>
          </div>

          {/* Empty State (Screenshot 7) */}
          {accounts.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-8 text-center shadow-xs space-y-3">
              <h3 className="text-base font-extrabold text-[#0B1528] dark:text-white">
                No accounts created yet
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
                Start fresh by creating your own Bank, Cash, Personal, or Business accounts.
              </p>
              <button
                onClick={handleOpenCreateAccount}
                className="py-2.5 px-6 rounded-xl bg-[#0B1528] hover:bg-[#111e38] text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 shadow-md active:scale-[0.99] transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create First Account</span>
              </button>
            </div>
          ) : (
            /* Accounts Grid (Multi-column on desktop) */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {accounts.map((acc) => (
                <div
                  key={acc.id}
                  className={`bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4 transition ${
                    acc.archived ? 'opacity-60 bg-slate-50 dark:bg-slate-950' : ''
                  }`}
                >
                  {/* Top Header Row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                        style={{ backgroundColor: acc.color || '#2563EB' }}
                      >
                        <DynamicIcon name={acc.icon || 'Landmark'} className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-extrabold text-[#0B1528] dark:text-white uppercase tracking-wide">
                            {acc.name}
                          </h3>
                          {acc.archived && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold">
                              Archived
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                          {acc.type} · Created {acc.createdAt}
                        </span>
                      </div>
                    </div>

                    <div className="text-base font-extrabold font-mono-numbers text-[#0B1528] dark:text-white">
                      {formatCurrency(acc.balance, acc.currency)}
                    </div>
                  </div>

                  {/* 3 Mini Stats Columns */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-left">
                    <div>
                      <span className="text-[11px] text-slate-400 block font-medium">Opening Pos.</span>
                      <span className="text-xs font-bold font-mono-numbers text-slate-800 dark:text-slate-200">
                        {formatCurrency(acc.openingPosition ?? acc.balance, acc.currency)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block font-medium">Adjustments</span>
                      <span className="text-xs font-bold font-mono-numbers text-slate-800 dark:text-slate-200">
                        {formatCurrency(acc.adjustments ?? 0, acc.currency)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block font-medium">Net Transfers</span>
                      <span className="text-xs font-bold font-mono-numbers text-slate-800 dark:text-slate-200">
                        {formatCurrency(acc.netTransfers ?? 0, acc.currency)}
                      </span>
                    </div>
                  </div>

                  {/* 4 Action Buttons Row (Screenshot 8) */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => handleOpenEditAccount(acc)}
                      className="border border-slate-200/90 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                    >
                      <Pencil className="w-3.5 h-3.5 text-slate-500" />
                      <span>Edit</span>
                    </button>

                    <button
                      onClick={() => {
                        setAdjustingAccount(acc);
                        setAdjustAmount(acc.balance.toString());
                        setIsAdjustModalOpen(true);
                      }}
                      className="border border-slate-200/90 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                    >
                      <Scale className="w-3.5 h-3.5 text-slate-500" />
                      <span>Adjust Balance</span>
                    </button>

                    <button
                      onClick={() => onToggleArchive(acc.id)}
                      className="border border-slate-200/90 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                    >
                      <Archive className="w-3.5 h-3.5 text-slate-500" />
                      <span>{acc.archived ? 'Unarchive' : 'Archive'}</span>
                    </button>

                    <button
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete "${acc.name}"?`)) {
                          onDeleteAccount(acc.id);
                        }
                      }}
                      className="border border-rose-200 dark:border-rose-900 rounded-xl px-3 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/40 hover:bg-rose-100 flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CATEGORIES (Requirement 1: Search, Filter, Edit, Delete, Custom Icon & Color) */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          {/* Top Controls: Search, Filter, Add */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                placeholder="Search categories..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Filter Buttons & Add Button */}
            <div className="flex items-center gap-2">
              <div className="bg-[#EEF2F6] dark:bg-slate-800 p-1 rounded-xl flex items-center text-xs font-semibold text-slate-500 dark:text-slate-400">
                {(['all', 'expense', 'income'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setCategoryTypeFilter(t)}
                    className={`px-3 py-1.5 rounded-lg transition capitalize cursor-pointer ${
                      categoryTypeFilter === t
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
                        : 'hover:text-slate-800 dark:hover:text-white'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <button
                onClick={handleOpenCreateCategory}
                className="py-2 px-3.5 rounded-xl bg-[#0B1528] hover:bg-[#111e38] text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-md transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Category</span>
              </button>
            </div>
          </div>

          {/* Categories Grid (2 columns on mobile, 3 on desktop) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredCategories.map((cat) => (
              <div
                key={cat.id}
                className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 flex items-center justify-between transition group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-2xs"
                    style={{ backgroundColor: cat.color }}
                  >
                    <DynamicIcon name={cat.icon || 'Tag'} className="w-4 h-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {cat.name}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        {cat.type}
                      </span>
                      {cat.isDefault && (
                        <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1 rounded font-semibold">
                          Default
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Edit & Delete Action Buttons */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEditCategory(cat)}
                    className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                    title="Edit category"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handlePromptDeleteCategory(cat)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                    title="Delete category"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: STATEMENT & EXPORT */}
      {activeTab === 'export' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-extrabold text-[#0B1528] dark:text-white">
                Export Financial Statements & Ledger
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Download your complete authenticated ledger ({transactions.length} total entries) directly in standard PDF, CSV, or Excel formats.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-300 font-medium">Consolidated Ledger Entries</span>
              <span className="font-bold font-mono-numbers text-slate-900 dark:text-white">{transactions.length}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => ExportService.generatePdfStatement(transactions, accounts, profile)}
                className="p-3.5 rounded-xl bg-[#0B1528] hover:bg-[#111e38] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
              >
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>Export PDF</span>
              </button>

              <button
                onClick={() => ExportService.exportExcelSheet(transactions, accounts, profile)}
                className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-2 shadow-2xs transition cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Export Excel / CSV</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT ACCOUNT MODAL (Requirement 9: Custom Icon & Color) */}
      {isAddAccountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-2xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-[#0B1528] dark:text-white">
                {editingAccount ? 'Edit Account' : 'Create New Account'}
              </h3>
              <button
                onClick={() => setIsAddAccountModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Account Card Live Preview */}
            <div
              className="p-4 rounded-2xl text-white shadow-md relative overflow-hidden"
              style={{ backgroundColor: accColor }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-white/20">
                  {accType}
                </span>
                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                  <DynamicIcon name={accIcon} className="w-4 h-4 text-white" />
                </div>
              </div>
              <div className="text-sm font-extrabold tracking-wide uppercase truncate">
                {accName || 'ACCOUNT NAME'}
              </div>
              <div className="text-lg font-extrabold font-mono-numbers mt-1">
                {formatCurrency(parseFloat(accBalance) || 0, accCurrency)}
              </div>
            </div>

            <form onSubmit={handleAccountFormSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Account Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HDFC BANK, CASH, PAYTM WALLET"
                  value={accName}
                  onChange={(e) => setAccName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white uppercase bg-slate-50 dark:bg-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Account Type
                  </label>
                  <select
                    value={accType}
                    onChange={(e) => setAccType(e.target.value as AccountType)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-white bg-slate-50 dark:bg-slate-800 cursor-pointer"
                  >
                    <option value="bank">Bank</option>
                    <option value="cash">Cash</option>
                    <option value="personal">Personal</option>
                    <option value="business">Business</option>
                    <option value="savings">Savings</option>
                    <option value="credit">Credit Card</option>
                    <option value="upi">UPI</option>
                    <option value="wallet">Wallet</option>
                    <option value="custom">Custom Account</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Currency
                  </label>
                  <select
                    disabled={Boolean(editingAccount)}
                    value={accCurrency}
                    onChange={(e) => setAccCurrency(e.target.value as CurrencyCode)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-white bg-slate-50 dark:bg-slate-800 cursor-pointer disabled:opacity-60"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="AED">AED (د.إ)</option>
                    <option value="SAR">SAR (﷼)</option>
                    <option value="CAD">CAD (C$)</option>
                    <option value="AUD">AUD (A$)</option>
                    <option value="SGD">SGD (S$)</option>
                    <option value="JPY">JPY (¥)</option>
                  </select>
                </div>
              </div>

              {!editingAccount && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Opening Balance
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={accBalance}
                    onChange={(e) => setAccBalance(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-mono-numbers font-bold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              {/* Account Icon Picker Trigger */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Account Icon
                </label>
                <button
                  type="button"
                  onClick={() => setIsAccIconPickerOpen(true)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 flex items-center justify-between text-xs transition cursor-pointer"
                >
                  <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-bold">
                    <DynamicIcon name={accIcon} className="w-4 h-4 text-blue-600" />
                    <span>{accIcon}</span>
                  </div>
                  <span className="text-[11px] text-blue-600 font-semibold">Change Icon →</span>
                </button>
              </div>

              {/* Color Palette Selector */}
              <ColorPicker
                selectedColor={accColor}
                onChangeColor={setAccColor}
                label="Account Background Color"
              />

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Notes / Description (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Primary salary account"
                  value={accNotes}
                  onChange={(e) => setAccNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddAccountModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#0B1528] hover:bg-[#111e38] text-white font-bold text-xs shadow-md transition cursor-pointer"
                >
                  {editingAccount ? 'Save Changes' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE / EDIT CATEGORY MODAL (Requirement 1) */}
      {isAddCategoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-2xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-[#0B1528] dark:text-white">
                {editingCategory ? 'Edit Category' : 'Create Custom Category'}
              </h3>
              <button
                onClick={() => setIsAddCategoryOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Category Live Preview Badge */}
            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-2xs"
                style={{ backgroundColor: catColor }}
              >
                <DynamicIcon name={catIcon} className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {catName || 'Category Preview'}
                </div>
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  {catType}
                </div>
              </div>
            </div>

            <form onSubmit={handleCategoryFormSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Groceries, Gym, Dividends"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Category Type
                </label>
                <select
                  value={catType}
                  onChange={(e) => setCatType(e.target.value as any)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-white bg-slate-50 dark:bg-slate-800 cursor-pointer"
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </div>

              {/* Icon Picker Trigger */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Category Icon
                </label>
                <button
                  type="button"
                  onClick={() => setIsCatIconPickerOpen(true)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 flex items-center justify-between text-xs transition cursor-pointer"
                >
                  <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-bold">
                    <DynamicIcon name={catIcon} className="w-4 h-4 text-blue-600" />
                    <span>{catIcon}</span>
                  </div>
                  <span className="text-[11px] text-blue-600 font-semibold">Browse Icons →</span>
                </button>
              </div>

              {/* Color Picker */}
              <ColorPicker
                selectedColor={catColor}
                onChangeColor={setCatColor}
                label="Category Color"
              />

              {/* Set as Default checkbox */}
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={catIsDefault}
                  onChange={(e) => setCatIsDefault(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Set as default category for {catType}</span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddCategoryOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#0B1528] hover:bg-[#111e38] text-white font-bold text-xs shadow-md transition cursor-pointer"
                >
                  {editingCategory ? 'Update Category' : 'Save Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SAFE CATEGORY DELETION MODAL (Requirement 1) */}
      {deletingCat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-2xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="text-base font-extrabold text-[#0B1528] dark:text-white">
                Delete Category?
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Are you sure you want to delete <span className="font-bold text-slate-900 dark:text-white">"{deletingCat.name}"</span>?
            </p>

            {affectedTxCount > 0 ? (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                <div className="font-bold">Historical Financial Protection Active:</div>
                <div>
                  <strong>{affectedTxCount} historical transactions</strong> currently reference this category. They will be safely reassigned to <strong>"General"</strong> to prevent data corruption.
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                No transactions currently use this category. It will be safely removed.
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingCat(null)}
                className="px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCategory}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADJUST BALANCE MODAL */}
      {isAdjustModalOpen && adjustingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-2xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-[#0B1528] dark:text-white">
                  Adjust Balance
                </h3>
                <span className="text-xs text-slate-500">{adjustingAccount.name}</span>
              </div>
              <button onClick={() => setIsAdjustModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  New Adjusted Balance ({adjustingAccount.currency}) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  autoFocus
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-lg font-mono-numbers font-bold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Reason / Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bank reconciliation, interest credit"
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#0B1528] text-white font-bold text-xs shadow-md"
                >
                  Confirm Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ACCOUNT ICON PICKER MODAL */}
      <IconPickerModal
        isOpen={isAccIconPickerOpen}
        onClose={() => setIsAccIconPickerOpen(false)}
        selectedIcon={accIcon}
        onSelectIcon={setAccIcon}
        previewColor={accColor}
      />

      {/* CATEGORY ICON PICKER MODAL */}
      <IconPickerModal
        isOpen={isCatIconPickerOpen}
        onClose={() => setIsCatIconPickerOpen(false)}
        selectedIcon={catIcon}
        onSelectIcon={setCatIcon}
        previewColor={catColor}
      />
    </div>
  );
};
