/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, Trash2, ArrowRightLeft, ArrowDownLeft, ArrowUpRight, Loader2, AlertCircle, Check } from 'lucide-react';
import { Account, CurrencyCode, PaymentMode, SUPPORTED_CURRENCIES, Transaction, TransactionType, UserProfile } from '../types/finance';
import { CategoryItem } from '../services/storageService';
import { formatCurrency } from '../services/currencyService';
import { DynamicIcon } from './IconAndColorPicker';

interface EditTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  profile: UserProfile;
  accounts: Account[];
  categories: CategoryItem[];
  onSaveTransaction: (updated: Transaction) => Promise<boolean | void> | void;
  onDeleteTransaction: (id: string) => Promise<boolean | void> | void;
}

export const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  isOpen,
  onClose,
  transaction,
  profile,
  accounts,
  categories,
  onSaveTransaction,
  onDeleteTransaction,
}) => {
  const [formType, setFormType] = useState<TransactionType>('expense');
  const [formAmount, setFormAmount] = useState('');
  const [formCurrency, setFormCurrency] = useState<CurrencyCode>('INR');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formAccountId, setFormAccountId] = useState('');
  const [formToAccountId, setFormToAccountId] = useState('');
  const [formPaymentMode, setFormPaymentMode] = useState<PaymentMode>('UPI');
  const [formDate, setFormDate] = useState('');
  const [formTime, setFormTime] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (transaction) {
      setFormType(transaction.type);
      setFormAmount(String(transaction.amount));
      setFormCurrency(transaction.currency);
      setFormDescription(transaction.description || '');
      setFormCategory(transaction.category || categories[0]?.name || 'General');
      setFormAccountId(transaction.accountId || accounts[0]?.id || '');
      setFormToAccountId(transaction.toAccountId || accounts[1]?.id || accounts[0]?.id || '');
      setFormPaymentMode(transaction.paymentMode || 'UPI');
      setFormDate(transaction.date || new Date().toISOString().split('T')[0]);
      setFormTime(transaction.time || new Date().toTimeString().slice(0, 5));
      setFormNotes(transaction.notes || '');
      setShowDeleteConfirm(false);
      setErrorMessage(null);
    }
  }, [transaction, categories, accounts]);

  if (!isOpen || !transaction) return null;

  const paymentModes: PaymentMode[] = [
    'UPI',
    'Credit Card',
    'Debit Card',
    'Net Banking',
    'Cash',
    'Wallet',
    'Other',
  ];

  const relevantCategories = categories.filter(
    (c) => (formType === 'expense' ? c.type === 'expense' : c.type === 'income')
  );

  const selectedCatObj = categories.find((c) => c.name === formCategory);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const amt = parseFloat(formAmount);
    if (!amt || isNaN(amt) || amt <= 0) {
      setErrorMessage('Please enter a valid amount.');
      return;
    }

    if (formType === 'transfer') {
      if (!formToAccountId) {
        setErrorMessage('Please select a destination account for the transfer.');
        return;
      }
      if (formToAccountId === formAccountId) {
        setErrorMessage('Source and destination accounts must be different.');
        return;
      }
    }

    const updated: Transaction = {
      ...transaction,
      type: formType,
      amount: amt,
      currency: formCurrency,
      description: formDescription.trim() || formCategory,
      category: formType === 'transfer' ? 'Transfer' : formCategory,
      accountId: formAccountId,
      paymentMode: formPaymentMode,
      date: formDate,
      time: formTime,
      notes: formNotes.trim(),
    };

    if (formType === 'transfer' && formToAccountId) {
      updated.toAccountId = formToAccountId;
    } else {
      delete updated.toAccountId;
    }

    setIsSaving(true);
    try {
      await onSaveTransaction(updated);
      onClose();
    } catch (err: any) {
      console.error('Failed to update transaction:', err);
      setErrorMessage(err?.message || 'Failed to update transaction. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setErrorMessage(null);
    try {
      await onDeleteTransaction(transaction.id);
      onClose();
    } catch (err: any) {
      console.error('Failed to delete transaction:', err);
      setErrorMessage(err?.message || 'Failed to delete transaction. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-2xs animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto space-y-4 text-slate-900 dark:text-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs ${
                formType === 'income' ? 'bg-emerald-500' : formType === 'transfer' ? 'bg-blue-600' : 'bg-rose-500'
              }`}
            >
              {formType === 'income' ? (
                <ArrowDownLeft className="w-4 h-4" />
              ) : formType === 'transfer' ? (
                <ArrowRightLeft className="w-4 h-4" />
              ) : (
                <ArrowUpRight className="w-4 h-4" />
              )}
            </div>
            <h3 className="text-base font-extrabold text-[#0B1528] dark:text-white">Edit Entry</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Delete Confirmation Warning Box */}
        {showDeleteConfirm ? (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 space-y-3">
            <div className="flex items-start gap-2.5">
              <Trash2 className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-rose-900 dark:text-rose-200">Delete this transaction?</h4>
                <p className="text-[11px] text-rose-700 dark:text-rose-300 mt-0.5 leading-relaxed">
                  Account balance and financial statements will be recalculated immediately.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDelete}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Confirm Delete</span>
                )}
              </button>
            </div>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Type Switcher */}
          <div className="bg-[#EEF2F6] dark:bg-slate-800 p-1 rounded-xl flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            {(['expense', 'income', 'transfer'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setFormType(t);
                  const firstMatch = categories.find((c) => c.type === (t === 'income' ? 'income' : 'expense'));
                  if (firstMatch) setFormCategory(firstMatch.name);
                }}
                className={`flex-1 py-1.5 px-2 text-center rounded-lg transition cursor-pointer capitalize ${
                  formType === t
                    ? t === 'income'
                      ? 'bg-emerald-500 text-white font-bold shadow-xs'
                      : t === 'transfer'
                      ? 'bg-blue-600 text-white font-bold shadow-xs'
                      : 'bg-rose-500 text-white font-bold shadow-xs'
                    : 'hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Amount & Currency */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Amount *</label>
              <input
                type="number"
                step="any"
                required
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-lg font-mono-numbers font-extrabold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Currency</label>
              <select
                value={formCurrency}
                onChange={(e) => setFormCurrency(e.target.value as CurrencyCode)}
                className="w-full px-2 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-white cursor-pointer"
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.symbol})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              Description / Merchant (Optional)
            </label>
            <input
              type="text"
              placeholder="Optional description..."
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Category */}
          {formType !== 'transfer' && (
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Category</label>
              <div className="flex items-center gap-2">
                {selectedCatObj && (
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-2xs"
                    style={{ backgroundColor: selectedCatObj.color || '#2563EB', color: '#FFFFFF' }}
                  >
                    <DynamicIcon name={selectedCatObj.icon || 'Tag'} className="w-4 h-4" />
                  </div>
                )}
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-white cursor-pointer"
                >
                  {(relevantCategories.length > 0 ? relevantCategories : categories).map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Account Selection as Compact Horizontal Selectable Cards */}
          {accounts.length === 0 ? (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-300">
              No accounts available.
            </div>
          ) : formType === 'transfer' ? (
            <div className="space-y-3.5 pt-1">
              {/* Transfer: From Source Account */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <span>From Account (Source)</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">Debited</span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1.5 pt-0.5 no-scrollbar">
                  {accounts.map((acc) => {
                    const isSelected = formAccountId === acc.id;
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => {
                          setFormAccountId(acc.id);
                          setFormCurrency(acc.currency);
                          if (formToAccountId === acc.id) {
                            const next = accounts.find((a) => a.id !== acc.id);
                            if (next) setFormToAccountId(next.id);
                          }
                        }}
                        className={`flex-shrink-0 w-36 sm:w-40 p-2.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 shadow-xs ring-2 ring-blue-500/30'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        )}
                        <div className="flex items-center gap-2 mb-1.5">
                          <div
                            className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 shadow-2xs"
                            style={{ backgroundColor: acc.color || '#3B82F6', color: '#FFFFFF' }}
                          >
                            <DynamicIcon name={acc.icon || 'Landmark'} className="w-3.5 h-3.5 text-white" />
                          </div>
                          <span className="text-xs font-bold truncate max-w-[85px] leading-tight">
                            {acc.name}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono font-bold text-slate-900 dark:text-white truncate">
                          {formatCurrency(acc.balance, acc.currency)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Transfer: To Destination Account */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <span>To Account (Destination)</span>
                    <span className="text-emerald-500">*</span>
                  </label>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Credited</span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1.5 pt-0.5 no-scrollbar">
                  {accounts.map((acc) => {
                    const isSelected = formToAccountId === acc.id;
                    const isSameAsSource = formAccountId === acc.id;
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        disabled={isSameAsSource}
                        onClick={() => setFormToAccountId(acc.id)}
                        className={`flex-shrink-0 w-36 sm:w-40 p-2.5 rounded-xl border text-left transition-all relative ${
                          isSameAsSource
                            ? 'opacity-35 cursor-not-allowed border-dashed border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50'
                            : isSelected
                            ? 'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100 shadow-xs ring-2 ring-emerald-500/30 cursor-pointer'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer'
                        }`}
                      >
                        {isSelected && !isSameAsSource && (
                          <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        )}
                        <div className="flex items-center gap-2 mb-1.5">
                          <div
                            className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 shadow-2xs"
                            style={{ backgroundColor: acc.color || '#10B981', color: '#FFFFFF' }}
                          >
                            <DynamicIcon name={acc.icon || 'Landmark'} className="w-3.5 h-3.5 text-white" />
                          </div>
                          <span className="text-xs font-bold truncate max-w-[85px] leading-tight">
                            {acc.name}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono font-bold text-slate-900 dark:text-white truncate">
                          {formatCurrency(acc.balance, acc.currency)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              {/* Income / Expense: Select Account */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <span>Account</span>
                    <span className="text-blue-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">{accounts.length} available</span>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1.5 pt-0.5 no-scrollbar">
                  {accounts.map((acc) => {
                    const isSelected = formAccountId === acc.id;
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => {
                          setFormAccountId(acc.id);
                          setFormCurrency(acc.currency);
                        }}
                        className={`flex-shrink-0 w-36 sm:w-40 p-2.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 shadow-xs ring-2 ring-blue-500/30'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        )}
                        <div className="flex items-center gap-2 mb-1.5">
                          <div
                            className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 shadow-2xs"
                            style={{ backgroundColor: acc.color || '#3B82F6', color: '#FFFFFF' }}
                          >
                            <DynamicIcon name={acc.icon || 'Landmark'} className="w-3.5 h-3.5 text-white" />
                          </div>
                          <span className="text-xs font-bold truncate max-w-[85px] leading-tight">
                            {acc.name}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono font-bold text-slate-900 dark:text-white truncate">
                          {formatCurrency(acc.balance, acc.currency)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Payment Mode Selector */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Mode
                </label>
                <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {paymentModes.map((m) => {
                    const isSelected = formPaymentMode === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setFormPaymentMode(m)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                          isSelected
                            ? 'bg-[#0B1528] dark:bg-blue-600 text-white shadow-xs'
                            : 'bg-[#EEF2F6] dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Date</label>
              <input
                type="date"
                required
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-white cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Time</label>
              <input
                type="time"
                value={formTime}
                onChange={(e) => setFormTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-white cursor-pointer"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Notes</label>
            <input
              type="text"
              placeholder="Remark or memo..."
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-white"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              disabled={isSaving || isDeleting}
              onClick={() => setShowDeleteConfirm(true)}
              className="py-2 px-3 rounded-xl border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isSaving || isDeleting}
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || isDeleting}
                className="px-5 py-2.5 rounded-xl bg-[#0B1528] dark:bg-blue-600 text-white font-bold text-xs shadow-md cursor-pointer hover:bg-[#111e38] transition disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Changes</span>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
