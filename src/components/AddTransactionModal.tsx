/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { Account, CurrencyCode, PaymentMode, SUPPORTED_CURRENCIES, Transaction, TransactionType, UserProfile } from '../types/finance';
import { CategoryItem } from '../services/storageService';
import { convertCurrency, formatCurrency, getCachedRates } from '../services/currencyService';
import { DynamicIcon } from './IconAndColorPicker';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  accounts: Account[];
  categories: CategoryItem[];
  onAddTransaction: (tx: Omit<Transaction, 'id' | 'createdAt'>) => Promise<void | boolean> | void;
  onOpenCreateAccount: () => void;
}

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  isOpen,
  onClose,
  profile,
  accounts,
  categories,
  onAddTransaction,
  onOpenCreateAccount,
}) => {
  const prefCurrency = profile.preferredCurrency;
  const rates = getCachedRates().rates;

  const [formType, setFormType] = useState<TransactionType>('expense');
  const [formAmount, setFormAmount] = useState('');
  const [formCurrency, setFormCurrency] = useState<CurrencyCode>(prefCurrency);
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState(categories[0]?.name || 'Food & Dining');
  const [formAccountId, setFormAccountId] = useState(accounts[0]?.id || '');
  const [formToAccountId, setFormToAccountId] = useState(accounts[1]?.id || accounts[0]?.id || '');
  const [formPaymentMode, setFormPaymentMode] = useState<PaymentMode>('UPI');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formNotes, setFormNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

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
    (c) => formType === 'expense' ? c.type === 'expense' : c.type === 'income'
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

    if (accounts.length === 0) {
      setErrorMessage('Please create at least one account before recording a transaction.');
      onOpenCreateAccount();
      return;
    }

    setIsSaving(true);
    try {
      await onAddTransaction({
        type: formType,
        amount: amt,
        currency: formCurrency,
        description: formDescription.trim() || formCategory,
        category: formType === 'transfer' ? 'Transfer' : formCategory,
        accountId: formAccountId || accounts[0].id,
        toAccountId: formType === 'transfer' ? formToAccountId : undefined,
        paymentMode: formPaymentMode,
        date: formDate,
        notes: formNotes.trim(),
        tags: [formType, formCategory],
        exchangeRateAtTransaction: rates[formCurrency] || 1,
        rateDate: formDate,
        rateSource: 'FixFly Reserve Engine',
      });
      onClose();
    } catch (err: any) {
      console.error('Failed to save transaction:', err);
      setErrorMessage(err?.message || 'Failed to save transaction. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-2xs animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto space-y-4 text-slate-900 dark:text-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="text-base font-extrabold text-[#0B1528] dark:text-white">Record Entry</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

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

          {/* Amount and Currency */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Amount *</label>
              <input
                type="number"
                step="any"
                required
                autoFocus
                placeholder="0.00"
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
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Description / Merchant *</label>
            <input
              type="text"
              required
              placeholder="e.g. Starbucks, Groceries, Client Salary"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Category with icon & color preview */}
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
                      {c.name} {c.isDefault ? '· (Default)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Account Selection */}
          {accounts.length === 0 ? (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-300 space-y-1">
              <span className="font-bold block">No accounts created yet!</span>
              <button
                type="button"
                onClick={onOpenCreateAccount}
                className="text-blue-600 dark:text-blue-400 font-bold underline"
              >
                + Create an account first
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {formType === 'transfer' ? 'From Account' : 'Account'}
                </label>
                <select
                  value={formAccountId}
                  onChange={(e) => setFormAccountId(e.target.value)}
                  className="w-full px-2 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-white cursor-pointer"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.currency})
                    </option>
                  ))}
                </select>
              </div>

              {formType === 'transfer' ? (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">To Account</label>
                  <select
                    value={formToAccountId}
                    onChange={(e) => setFormToAccountId(e.target.value)}
                    className="w-full px-2 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-white cursor-pointer"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.currency})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Payment Mode</label>
                  <select
                    value={formPaymentMode}
                    onChange={(e) => setFormPaymentMode(e.target.value as PaymentMode)}
                    className="w-full px-2 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-white cursor-pointer"
                  >
                    {paymentModes.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Date */}
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

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Notes (Optional)</label>
            <input
              type="text"
              placeholder="Add remark or invoice number..."
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-white"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl bg-[#0B1528] dark:bg-blue-600 text-white font-bold text-xs shadow-md cursor-pointer hover:bg-[#111e38] transition disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Record Entry</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
