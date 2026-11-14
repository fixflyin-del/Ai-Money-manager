/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  ArrowDownRight,
  ArrowUpRight,
  ArrowRightLeft,
  Calendar,
  Tag,
  Receipt,
  Plus,
  Trash2,
  X,
  Check,
  Building,
  CreditCard,
  Wallet,
  Globe2,
} from 'lucide-react';
import {
  Account,
  CurrencyCode,
  PaymentMode,
  SUPPORTED_CURRENCIES,
  Transaction,
  TransactionType,
  UserProfile,
} from '../types/finance';
import {
  convertCurrency,
  formatCurrency,
  getCachedRates,
  getCurrencyInfo,
} from '../services/currencyService';

interface TransactionsProps {
  profile: UserProfile;
  accounts: Account[];
  transactions: Transaction[];
  onAddTransaction: (tx: Omit<Transaction, 'id' | 'createdAt'>) => void;
  onDeleteTransaction: (id: string) => void;
  initialAddModalOpen?: boolean;
}

export const Transactions: React.FC<TransactionsProps> = ({
  profile,
  accounts,
  transactions,
  onAddTransaction,
  onDeleteTransaction,
  initialAddModalOpen = false,
}) => {
  const prefCurrency = profile.preferredCurrency;
  const rates = getCachedRates().rates;

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | TransactionType>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(initialAddModalOpen);
  const [formType, setFormType] = useState<TransactionType>('expense');
  const [formAmount, setFormAmount] = useState<string>('');
  const [formCurrency, setFormCurrency] = useState<CurrencyCode>(prefCurrency);
  const [formDescription, setFormDescription] = useState<string>('');
  const [formCategory, setFormCategory] = useState<string>('Food & Dining');
  const [formAccountId, setFormAccountId] = useState<string>(accounts[0]?.id || '');
  const [formToAccountId, setFormToAccountId] = useState<string>(accounts[1]?.id || '');
  const [formPaymentMode, setFormPaymentMode] = useState<PaymentMode>('UPI');
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formNotes, setFormNotes] = useState<string>('');
  const [formTags, setFormTags] = useState<string>('');

  const categories = [
    'Food & Dining',
    'Groceries',
    'Transport',
    'Shopping',
    'Utilities',
    'Entertainment',
    'Health',
    'Travel',
    'Salary',
    'Freelance',
    'Investments',
    'General',
  ];

  const paymentModes: PaymentMode[] = [
    'UPI',
    'Credit Card',
    'Debit Card',
    'Net Banking',
    'Cash',
    'Wallet',
    'Other',
  ];

  // Filter & Sort Logic
  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((tx) => {
        if (selectedType !== 'all' && tx.type !== selectedType) return false;
        if (selectedCategory !== 'all' && tx.category !== selectedCategory) return false;
        if (selectedAccountId !== 'all' && tx.accountId !== selectedAccountId) return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchDesc = (tx.description || '').toLowerCase().includes(q);
          const matchCat = (tx.category || '').toLowerCase().includes(q);
          const matchNotes = (tx.notes || '').toLowerCase().includes(q);
          const matchTag = (tx.tags || []).some((t) => t.toLowerCase().includes(q));
          if (!matchDesc && !matchCat && !matchNotes && !matchTag) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const timeA = new Date(a.date).getTime();
        const timeB = new Date(b.date).getTime();
        return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
      });
  }, [transactions, selectedType, selectedCategory, selectedAccountId, searchQuery, sortOrder]);

  // Aggregate totals of filtered view in display currency
  const summaryTotals = useMemo(() => {
    let inc = 0;
    let exp = 0;
    filteredTransactions.forEach((tx) => {
      const converted = convertCurrency(
        tx.amount,
        tx.currency,
        prefCurrency,
        rates,
        tx.exchangeRateAtTransaction
      );
      if (tx.type === 'income') inc += converted;
      else if (tx.type === 'expense') exp += converted;
    });
    return { income: inc, expense: exp, net: inc - exp };
  }, [filteredTransactions, prefCurrency, rates]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(formAmount);
    if (!amountNum || isNaN(amountNum) || amountNum <= 0) {
      alert('Please enter a valid amount.');
      return;
    }

    const tagList = formTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const payload: Omit<Transaction, 'id' | 'createdAt'> = {
      type: formType,
      amount: amountNum,
      currency: formCurrency,
      description: formDescription.trim() || formCategory,
      category: formType === 'transfer' ? 'Transfer' : formCategory,
      accountId: formAccountId,
      paymentMode: formPaymentMode,
      date: formDate,
      notes: formNotes.trim(),
      tags: tagList,
      exchangeRateAtTransaction: rates[formCurrency] || 1,
      rateDate: formDate,
      rateSource: 'FixFly Reserve Engine',
    };
    if (formType === 'transfer' && formToAccountId) {
      payload.toAccountId = formToAccountId;
    }

    onAddTransaction(payload);

    // Reset and close
    setFormAmount('');
    setFormDescription('');
    setFormNotes('');
    setFormTags('');
    setIsAddModalOpen(false);
  };

  return (
    <div className="space-y-6 pb-24 md:pb-12 max-w-7xl mx-auto px-4 sm:px-6 pt-6">
      {/* Top Header & Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white">Financial Transactions</h1>
          <p className="text-xs text-slate-400">
            Immutable original amounts with real-time conversion into{' '}
            <span className="text-emerald-400 font-semibold">{prefCurrency}</span>
          </p>
        </div>

        <button
          onClick={() => {
            setFormCurrency(prefCurrency);
            setIsAddModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition cursor-pointer shadow-md shadow-emerald-600/30"
        >
          <Plus className="w-4 h-4" />
          <span>New Transaction</span>
        </button>
      </div>

      {/* Filtered Overview Totals */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl bg-[#1E293B] border border-slate-700/80">
          <span className="text-[11px] text-slate-400 font-medium">Filtered Income</span>
          <div className="text-base font-bold font-mono-numbers text-emerald-400">
            +{formatCurrency(summaryTotals.income, prefCurrency)}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#1E293B] border border-slate-700/80">
          <span className="text-[11px] text-slate-400 font-medium">Filtered Expenses</span>
          <div className="text-base font-bold font-mono-numbers text-rose-400">
            -{formatCurrency(summaryTotals.expense, prefCurrency)}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#1E293B] border border-slate-700/80">
          <span className="text-[11px] text-slate-400 font-medium">Net Filtered Cashflow</span>
          <div
            className={`text-base font-bold font-mono-numbers ${
              summaryTotals.net >= 0 ? 'text-indigo-400' : 'text-rose-400'
            }`}
          >
            {formatCurrency(summaryTotals.net, prefCurrency)}
          </div>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="p-4 rounded-xl bg-[#1E293B] border border-slate-700/80 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search description, tag, category, notes..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Type Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-700 shrink-0">
            {(['all', 'expense', 'income', 'transfer'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-3 py-1 rounded text-xs font-medium capitalize transition cursor-pointer ${
                  selectedType === type
                    ? 'bg-emerald-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Dropdown Filters Row */}
        <div className="flex flex-wrap gap-2.5 pt-1">
          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Account Dropdown */}
          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="all">All Accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
            ))}
          </select>

          {/* Sort Order */}
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as any)}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="desc">Newest First</option>
            <option value="asc">Oldest First</option>
          </select>

          {/* Clear Filters */}
          {(searchQuery || selectedType !== 'all' || selectedCategory !== 'all' || selectedAccountId !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedType('all');
                setSelectedCategory('all');
                setSelectedAccountId('all');
              }}
              className="px-3 py-1.5 text-xs text-rose-400 hover:text-rose-300 transition cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Transactions List Table / Cards */}
      <div className="rounded-2xl bg-[#1E293B] border border-slate-700/80 overflow-hidden shadow-xl">
        {filteredTransactions.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Receipt className="w-10 h-10 mx-auto text-slate-600 mb-3" />
            <p className="text-sm font-semibold text-slate-300">No transactions found</p>
            <p className="text-xs text-slate-500 mt-1">Try adjusting your filters or record a new entry.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {filteredTransactions.map((tx) => {
              const convertedAmount = convertCurrency(
                tx.amount,
                tx.currency,
                prefCurrency,
                rates,
                tx.exchangeRateAtTransaction
              );
              const isDifferentCurrency = tx.currency !== prefCurrency;
              const isIncome = tx.type === 'income';
              const isTransfer = tx.type === 'transfer';
              const account = accounts.find((a) => a.id === tx.accountId);
              const toAccount = tx.toAccountId ? accounts.find((a) => a.id === tx.toAccountId) : null;

              return (
                <div
                  key={tx.id}
                  className="p-4 hover:bg-slate-900/40 transition flex items-center justify-between gap-4"
                >
                  {/* Left: Type Icon & Details */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isIncome
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : isTransfer
                          ? 'bg-blue-500/15 text-blue-400'
                          : 'bg-rose-500/15 text-rose-400'
                      }`}
                    >
                      {isIncome ? (
                        <ArrowDownRight className="w-5 h-5" />
                      ) : isTransfer ? (
                        <ArrowRightLeft className="w-5 h-5" />
                      ) : (
                        <ArrowUpRight className="w-5 h-5" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-bold text-white truncate">
                          {tx.description}
                        </span>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                          {tx.category}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1 flex-wrap">
                        <span>{tx.date}</span>
                        <span>•</span>
                        <span>
                          {account?.name}
                          {toAccount ? ` ➔ ${toAccount.name}` : ''}
                        </span>
                        <span>•</span>
                        <span className="text-slate-500">{tx.paymentMode}</span>

                        {tx.tags && tx.tags.length > 0 && (
                          <div className="hidden sm:flex items-center gap-1">
                            {tx.tags.map((t) => (
                              <span key={t} className="text-[10px] text-emerald-400/90">
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {tx.notes && (
                        <div className="text-[11px] text-slate-400 italic mt-0.5 truncate max-w-md">
                          "{tx.notes}"
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Amounts & Delete */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div
                        className={`text-sm sm:text-base font-bold font-mono-numbers ${
                          isIncome
                            ? 'text-emerald-400'
                            : isTransfer
                            ? 'text-blue-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {isIncome ? '+' : isTransfer ? '' : '-'}
                        {formatCurrency(convertedAmount, prefCurrency)}
                      </div>

                      {/* Explicit Original Currency Display */}
                      {isDifferentCurrency ? (
                        <div
                          className="text-[10px] text-slate-400 font-mono-numbers"
                          title={`Original recorded value: ${tx.amount} ${tx.currency} (Converted using 1 ${tx.currency} ≈ ${(rates[prefCurrency] / rates[tx.currency]).toFixed(4)} ${prefCurrency})`}
                        >
                          Orig: {formatCurrency(tx.amount, tx.currency)}
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-500 font-mono-numbers">
                          Original Currency
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        if (confirm('Delete this transaction? Underlying account balance will be reconciled.')) {
                          onDeleteTransaction(tx.id);
                        }
                      }}
                      className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                      title="Delete transaction"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Transaction Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#1E293B] border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-white text-base">Record Financial Transaction</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Type Switcher */}
              <div className="grid grid-cols-3 gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
                {(['expense', 'income', 'transfer'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFormType(t)}
                    className={`py-2 rounded-lg text-xs font-semibold capitalize transition cursor-pointer ${
                      formType === t
                        ? t === 'income'
                          ? 'bg-emerald-600 text-white'
                          : t === 'transfer'
                          ? 'bg-blue-600 text-white'
                          : 'bg-rose-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* Amount and Original Currency Fields */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Amount *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-lg font-mono-numbers font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Currency *
                  </label>
                  <select
                    value={formCurrency}
                    onChange={(e) => setFormCurrency(e.target.value as CurrencyCode)}
                    className="w-full px-2 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} ({c.symbol})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Converted Preview Notice if currency differs */}
              {formCurrency !== prefCurrency && formAmount && !isNaN(parseFloat(formAmount)) && (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center justify-between">
                  <span>Display Equivalent:</span>
                  <span className="font-bold font-mono-numbers">
                    {formatCurrency(
                      convertCurrency(parseFloat(formAmount), formCurrency, prefCurrency, rates),
                      prefCurrency
                    )}
                  </span>
                </div>
              )}

              {/* Description / Merchant */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Description / Payee (Optional)
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="e.g. Starbucks Coffee, Blinkit, Salary (Optional)"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Category (if not transfer) */}
              {formType !== 'transfer' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Account Selection */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {formType === 'transfer' ? 'From Account' : 'Account'} *
                  </label>
                  <select
                    value={formAccountId}
                    onChange={(e) => setFormAccountId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
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
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      To Account *
                    </label>
                    <select
                      value={formToAccountId}
                      onChange={(e) => setFormToAccountId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      {accounts
                        .filter((a) => a.id !== formAccountId)
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} ({a.currency})
                          </option>
                        ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Payment Mode
                    </label>
                    <select
                      value={formPaymentMode}
                      onChange={(e) => setFormPaymentMode(e.target.value as PaymentMode)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      {paymentModes.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Date & Tags */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Tags (comma separated)
                  </label>
                  <input
                    type="text"
                    value={formTags}
                    onChange={(e) => setFormTags(e.target.value)}
                    placeholder="Work, Tax, Dinner"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Notes / Reference
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Optional details, invoice number, or memo"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition cursor-pointer shadow-md shadow-emerald-600/30"
                >
                  Save Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
