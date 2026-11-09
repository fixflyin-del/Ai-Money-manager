/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, ArrowRightLeft, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { Account, CurrencyCode, PaymentMode, SUPPORTED_CURRENCIES, Transaction, TransactionType, UserProfile } from '../types/finance';
import { CategoryItem } from '../services/storageService';
import { convertCurrency, formatCurrency, getCachedRates } from '../services/currencyService';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  accounts: Account[];
  categories: CategoryItem[];
  onAddTransaction: (tx: Omit<Transaction, 'id' | 'createdAt'>) => void;
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(formAmount);
    if (!amt || isNaN(amt) || amt <= 0) {
      alert('Please enter a valid amount.');
      return;
    }

    if (accounts.length === 0) {
      alert('Please create at least one account before recording a transaction.');
      onOpenCreateAccount();
      return;
    }

    onAddTransaction({
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
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-2xs animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base font-extrabold text-[#0B1528]">Record Entry</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Type Switcher */}
          <div className="bg-[#EEF2F6] p-1 rounded-xl flex items-center justify-between text-xs font-semibold text-slate-500">
            {(['expense', 'income', 'transfer'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setFormType(t)}
                className={`flex-1 py-1.5 px-2 text-center rounded-lg transition cursor-pointer capitalize ${
                  formType === t
                    ? t === 'income'
                      ? 'bg-emerald-500 text-white font-bold shadow-xs'
                      : t === 'transfer'
                      ? 'bg-blue-600 text-white font-bold shadow-xs'
                      : 'bg-rose-500 text-white font-bold shadow-xs'
                    : 'hover:text-slate-800'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Amount and Currency */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Amount *</label>
              <input
                type="number"
                step="any"
                required
                autoFocus
                placeholder="0.00"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-lg font-mono-numbers font-extrabold text-slate-900 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Currency</label>
              <select
                value={formCurrency}
                onChange={(e) => setFormCurrency(e.target.value as CurrencyCode)}
                className="w-full px-2 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 cursor-pointer"
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
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Description / Merchant *</label>
            <input
              type="text"
              required
              placeholder="e.g. Starbucks, Groceries, Client Salary"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Category */}
          {formType !== 'transfer' && (
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Category</label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 cursor-pointer"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name} ({c.type})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Account Selection */}
          {accounts.length === 0 ? (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-1">
              <span className="font-bold block">No accounts created yet!</span>
              <button
                type="button"
                onClick={onOpenCreateAccount}
                className="text-blue-600 font-bold underline"
              >
                + Create an account first
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {formType === 'transfer' ? 'From Account' : 'Account'}
                </label>
                <select
                  value={formAccountId}
                  onChange={(e) => setFormAccountId(e.target.value)}
                  className="w-full px-2 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 cursor-pointer"
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
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">To Account</label>
                  <select
                    value={formToAccountId}
                    onChange={(e) => setFormToAccountId(e.target.value)}
                    className="w-full px-2 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 cursor-pointer"
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
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Payment Mode</label>
                  <select
                    value={formPaymentMode}
                    onChange={(e) => setFormPaymentMode(e.target.value as PaymentMode)}
                    className="w-full px-2 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 cursor-pointer"
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
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Date</label>
            <input
              type="date"
              required
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 cursor-pointer"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[#0B1528] text-white font-bold text-xs shadow-md"
            >
              Record Entry
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
