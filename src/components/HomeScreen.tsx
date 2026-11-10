/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRightLeft,
  ChevronRight,
  Filter,
  RotateCcw,
  Pencil,
  Trash2,
  CheckCircle2,
  Calendar,
  Layers,
} from 'lucide-react';
import { Account, Transaction, UserProfile, TransactionType } from '../types/finance';
import { convertCurrency, formatCurrency, getCachedRates } from '../services/currencyService';
import { CalculationService, DateFilterOptions } from '../services/calculationService';
import { DynamicIcon } from './IconAndColorPicker';
import { CategoryItem } from '../services/storageService';
import { EditTransactionModal } from './EditTransactionModal';

interface HomeScreenProps {
  profile: UserProfile;
  accounts: Account[];
  transactions: Transaction[];
  categories: CategoryItem[];
  onOpenAddModal: () => void;
  onOpenCreateAccount: () => void;
  onNavigateManage: () => void;
  onUpdateTransaction: (tx: Transaction) => Promise<boolean | void> | void;
  onDeleteTransaction: (id: string) => Promise<boolean | void> | void;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const HomeScreen: React.FC<HomeScreenProps> = ({
  profile,
  accounts,
  transactions,
  categories,
  onOpenAddModal,
  onOpenCreateAccount,
  onNavigateManage,
  onUpdateTransaction,
  onDeleteTransaction,
}) => {
  const prefCurrency = profile.preferredCurrency;
  const rates = getCachedRates().rates;

  // Requirement 7: By default, select the first active account. If none, 'all'
  const [selectedAccountId, setSelectedAccountId] = useState<string | 'all'>(() => {
    return accounts.length > 0 ? accounts[0].id : 'all';
  });

  // Ensure selectedAccountId stays valid when accounts change
  useEffect(() => {
    if (selectedAccountId !== 'all') {
      const exists = accounts.some((a) => a.id === selectedAccountId);
      if (!exists && accounts.length > 0) {
        setSelectedAccountId(accounts[0].id);
      } else if (accounts.length === 0) {
        setSelectedAccountId('all');
      }
    } else if (accounts.length > 0 && selectedAccountId === 'all') {
      // Keep 'all' if user explicitly picked 'all'
    }
  }, [accounts, selectedAccountId]);

  // Requirement 5: Month and Year selection
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>('all');
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'all'>('all');

  // Modal State for Editing / Deleting a specific transaction
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Available Years extracted from stored transactions + current year
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    yearsSet.add(new Date().getFullYear());
    yearsSet.add(2026);
    transactions.forEach((tx) => {
      const y = parseInt(tx.date.slice(0, 4), 10);
      if (!isNaN(y)) yearsSet.add(y);
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [transactions]);

  // Date filter criteria
  const dateFilter: DateFilterOptions = useMemo(() => {
    return {
      month: selectedMonth !== 'all' ? selectedMonth : undefined,
      year: selectedYear !== 'all' ? selectedYear : undefined,
    };
  }, [selectedMonth, selectedYear]);

  // Requirement 4: Filter and sort transactions strictly newest first
  const filteredTransactions = useMemo(() => {
    const list = CalculationService.filterTransactions(transactions, {
      accountId: selectedAccountId,
      dateFilter,
      typeFilter,
    });
    return CalculationService.sortTransactionsNewestFirst(list);
  }, [transactions, selectedAccountId, dateFilter, typeFilter]);

  // Requirement 3 & 7: Account-Specific and Filter-Specific Income and Expense Calculations
  const totalIncome = useMemo(() => {
    return CalculationService.calculateIncome(transactions, {
      accountId: selectedAccountId,
      dateFilter,
      displayCurrency: prefCurrency,
      ratesRecord: rates,
    });
  }, [transactions, selectedAccountId, dateFilter, prefCurrency, rates]);

  const totalExpense = useMemo(() => {
    return CalculationService.calculateExpense(transactions, {
      accountId: selectedAccountId,
      dateFilter,
      displayCurrency: prefCurrency,
      ratesRecord: rates,
    });
  }, [transactions, selectedAccountId, dateFilter, prefCurrency, rates]);

  // Current balance of selected account or consolidated net balance
  const activeAccountObj = useMemo(() => {
    if (selectedAccountId === 'all') return null;
    return accounts.find((a) => a.id === selectedAccountId) || null;
  }, [accounts, selectedAccountId]);

  const displayedBalance = useMemo(() => {
    if (selectedAccountId === 'all') {
      return CalculationService.calculateConsolidatedBalance(accounts, transactions, prefCurrency, rates);
    }
    if (activeAccountObj) {
      return CalculationService.calculateAccountBalance(activeAccountObj, transactions, rates);
    }
    return 0;
  }, [selectedAccountId, activeAccountObj, accounts, transactions, prefCurrency, rates]);

  const clearFilters = () => {
    setSelectedMonth('all');
    setSelectedYear('all');
    setTypeFilter('all');
  };

  const hasActiveDateFilters = selectedMonth !== 'all' || selectedYear !== 'all' || typeFilter !== 'all';

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-4 pb-28 md:pb-12 space-y-5">
      {/* 1. Accounts Section Header & All Accounts Toggle */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-extrabold text-[#0B1528] dark:text-white tracking-tight">
            Your Accounts ({accounts.length})
          </h2>
          {accounts.length > 0 && (
            <button
              onClick={() => setSelectedAccountId(selectedAccountId === 'all' ? accounts[0]?.id || 'all' : 'all')}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                selectedAccountId === 'all'
                  ? 'bg-[#0B1528] text-white border-[#0B1528] dark:bg-blue-600 dark:border-blue-500'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
              }`}
            >
              {selectedAccountId === 'all' ? '✓ All Accounts (Consolidated)' : 'View All Accounts'}
            </button>
          )}
        </div>
        <button
          onClick={onOpenCreateAccount}
          className="text-xs font-bold text-slate-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition cursor-pointer"
        >
          + New Account
        </button>
      </div>

      {/* 2. Horizontally Scrollable Account Carousel (Requirement 6: Click to filter!) */}
      {accounts.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 text-center shadow-xs">
          <h3 className="text-base font-extrabold text-[#0B1528] dark:text-white">
            No accounts created yet
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto mt-1 mb-5 leading-relaxed">
            Create your own Bank, Cash, Personal, or Business accounts. Only accounts you create appear here.
          </p>
          <button
            onClick={onOpenCreateAccount}
            className="w-full sm:w-auto py-2.5 px-6 rounded-xl bg-[#0B1528] hover:bg-[#111e38] text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 shadow-md active:scale-[0.99] transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create First Account</span>
          </button>
        </div>
      ) : (
        <div className="relative">
          <div className="flex items-stretch gap-3 overflow-x-auto pb-3 pt-1 scrollbar-none snap-x -mx-4 px-4 sm:mx-0 sm:px-0">
            {/* "All Accounts" Card option in carousel */}
            <div
              onClick={() => setSelectedAccountId('all')}
              className={`shrink-0 w-60 sm:w-64 snap-start p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden select-none ${
                selectedAccountId === 'all'
                  ? 'ring-3 ring-blue-500 shadow-lg scale-[1.01]'
                  : 'opacity-85 hover:opacity-100 hover:shadow-sm'
              }`}
              style={{
                backgroundColor: '#0B1528',
                borderColor: selectedAccountId === 'all' ? '#3B82F6' : 'rgba(255, 255, 255, 0.15)',
                color: '#FFFFFF',
              }}
            >
              <div className="flex items-center justify-between mb-3 relative z-10">
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20 text-white backdrop-blur-xs">
                  Consolidated
                </span>
                <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white">
                  <Layers className="w-4 h-4 text-white" />
                </div>
              </div>

              <div className="text-xs sm:text-sm font-extrabold text-white tracking-wide uppercase truncate relative z-10">
                All Accounts
              </div>

              <div className="text-lg sm:text-xl font-extrabold font-mono-numbers text-white mt-1 relative z-10">
                {formatCurrency(
                  CalculationService.calculateConsolidatedBalance(accounts, transactions, prefCurrency, rates),
                  prefCurrency
                )}
              </div>

              <div className="flex items-center justify-between text-[10px] text-white/70 pt-3 mt-2 border-t border-white/15 relative z-10 font-medium">
                <span>{accounts.length} Accounts Active</span>
                <span className="font-bold text-amber-300">
                  {selectedAccountId === 'all' ? '● Active View' : 'Select'}
                </span>
              </div>
            </div>

            {/* Individual Account Cards */}
            {accounts.map((acc) => {
              const isSelected = selectedAccountId === acc.id;
              const currentAccBalance = CalculationService.calculateAccountBalance(acc, transactions, rates);
              const convertedVal = convertCurrency(currentAccBalance, acc.currency, prefCurrency, rates);
              const isDifferent = acc.currency !== prefCurrency;
              const cardColor = acc.color || '#2563EB';

              return (
                <div
                  key={acc.id}
                  onClick={() => setSelectedAccountId(acc.id)}
                  className={`shrink-0 w-64 sm:w-72 snap-start p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden select-none ${
                    isSelected
                      ? 'ring-3 ring-white dark:ring-blue-400 shadow-xl scale-[1.01]'
                      : 'opacity-85 hover:opacity-100 hover:shadow-sm'
                  }`}
                  style={{
                    backgroundColor: cardColor,
                    borderColor: isSelected ? '#FFFFFF' : 'rgba(255, 255, 255, 0.2)',
                    color: '#FFFFFF',
                  }}
                >
                  {/* Active Selection Badge */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 z-20 bg-white text-slate-900 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full shadow-xs flex items-center gap-0.5">
                      <CheckCircle2 className="w-2.5 h-2.5 text-blue-600" /> Active
                    </div>
                  )}

                  {/* Top Row: Type and Icon */}
                  <div className="flex items-center justify-between mb-3 relative z-10">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20 text-white backdrop-blur-xs">
                      {acc.type}
                    </span>

                    <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white">
                      <DynamicIcon name={acc.icon || 'Landmark'} className="w-4 h-4 text-white" />
                    </div>
                  </div>

                  {/* Account Name */}
                  <div className="text-xs sm:text-sm font-extrabold text-white tracking-wide uppercase truncate relative z-10 pr-12">
                    {acc.name}
                  </div>

                  {/* Balance Display */}
                  <div className="text-lg sm:text-xl font-extrabold font-mono-numbers text-white mt-1 relative z-10">
                    {formatCurrency(currentAccBalance, acc.currency)}
                  </div>

                  {/* Converted Balance if different currency */}
                  {isDifferent && (
                    <div className="text-[11px] text-white/80 font-mono-numbers mt-0.5 truncate relative z-10">
                      ≈ {formatCurrency(convertedVal, prefCurrency)}
                    </div>
                  )}

                  {/* Bottom details */}
                  <div className="flex items-center justify-between text-[10px] text-white/70 pt-3 mt-2 border-t border-white/15 relative z-10 font-medium">
                    <span>{acc.currency} Account</span>
                    <span className="font-bold underline">
                      {isSelected ? 'Filtering Transactions' : 'Click to Filter'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Account-Specific Active Filter Banner & Income / Expense Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 px-1">
          <span>
            {selectedAccountId === 'all' ? (
              'Showing: Consolidated All Accounts'
            ) : (
              <span>
                Showing Account: <strong className="text-blue-600 dark:text-blue-400">{activeAccountObj?.name}</strong>{' '}
                ({formatCurrency(displayedBalance, activeAccountObj?.currency || prefCurrency)})
              </span>
            )}
          </span>
          <span className="text-[11px] text-slate-400 font-mono">{filteredTransactions.length} entries</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Income Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Income</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <ArrowDownLeft className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold font-mono-numbers text-emerald-500 dark:text-emerald-400">
              +{formatCurrency(totalIncome, prefCurrency)}
            </div>
            <span className="text-[10px] text-slate-400 block mt-1">
              {filteredTransactions.filter((t) => t.type === 'income').length} credit transactions
            </span>
          </div>

          {/* Expense Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-rose-600 dark:text-rose-400">Expense</span>
              <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold font-mono-numbers text-rose-500 dark:text-rose-400">
              -{formatCurrency(totalExpense, prefCurrency)}
            </div>
            <span className="text-[10px] text-slate-400 block mt-1">
              {filteredTransactions.filter((t) => t.type === 'expense').length} debit transactions
            </span>
          </div>
        </div>
      </div>

      {/* 4. Filter Toolbar: Month, Year, Type Filter, & Clear Action (Requirement 5) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-xs font-extrabold text-[#0B1528] dark:text-white uppercase tracking-wider">
              Filter Statements
            </h3>
          </div>

          {hasActiveDateFilters && (
            <button
              onClick={clearFilters}
              className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear Filters</span>
            </button>
          )}
        </div>

        {/* Month & Year Selectors */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {/* Month Selector */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Month</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10))}
              className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white cursor-pointer"
            >
              <option value="all">All Months</option>
              {MONTH_NAMES.map((name, idx) => (
                <option key={name} value={idx + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* Year Selector */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10))}
              className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white cursor-pointer"
            >
              <option value="all">All Years</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>

          {/* Type Selector */}
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white cursor-pointer"
            >
              <option value="all">All Types</option>
              <option value="income">Income Only</option>
              <option value="expense">Expense Only</option>
              <option value="transfer">Transfers Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* 5. Statement List / Empty State with Edit & Delete Options (Requirement 4 & 8) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-extrabold text-[#0B1528] dark:text-white uppercase tracking-wider">
            Transaction History ({filteredTransactions.length})
          </h3>
          <span className="text-[11px] text-slate-400">Sorted Newest First</span>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-8 text-center shadow-xs space-y-4">
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
              No statements found for this filter
            </p>
            <button
              onClick={onOpenAddModal}
              className="w-full sm:w-auto py-2.5 px-6 rounded-xl bg-[#0B1528] hover:bg-[#111e38] text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 shadow-md active:scale-[0.99] transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Entry</span>
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800 shadow-xs overflow-hidden">
            {filteredTransactions.map((tx) => {
              const converted = convertCurrency(
                tx.amount,
                tx.currency,
                prefCurrency,
                rates,
                tx.exchangeRateAtTransaction
              );
              const isDifferent = tx.currency !== prefCurrency;
              const isIncome = tx.type === 'income';
              const isTransfer = tx.type === 'transfer';
              const sourceAccount = accounts.find((a) => a.id === tx.accountId);
              const destAccount = tx.toAccountId ? accounts.find((a) => a.id === tx.toAccountId) : null;

              return (
                <div
                  key={tx.id}
                  className="p-3.5 flex items-center justify-between hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition group"
                >
                  {/* Left Side: Icon & Details */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isIncome
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600'
                          : isTransfer
                          ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600'
                          : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600'
                      }`}
                    >
                      {isIncome ? (
                        <ArrowDownLeft className="w-4 h-4" />
                      ) : isTransfer ? (
                        <ArrowRightLeft className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                        <span className="truncate">{tx.description || tx.category}</span>
                        {isTransfer && destAccount && (
                          <span className="text-[10px] text-blue-600 dark:text-blue-400 font-normal">
                            → {destAccount.name}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate flex items-center gap-1.5">
                        <span className="font-medium">{tx.date}</span>
                        {tx.time && <span>• {tx.time}</span>}
                        <span>• {sourceAccount?.name || 'Account'}</span>
                        <span>• {tx.paymentMode}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Amount & Action Buttons (Requirement 8) */}
                  <div className="flex items-center gap-2 shrink-0 pl-3">
                    <div className="text-right">
                      <div
                        className={`text-xs sm:text-sm font-extrabold font-mono-numbers ${
                          isIncome
                            ? 'text-emerald-500'
                            : isTransfer
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-rose-500'
                        }`}
                      >
                        {isIncome ? '+' : isTransfer ? '' : '-'}
                        {formatCurrency(converted, prefCurrency)}
                      </div>
                      {isDifferent && (
                        <div className="text-[10px] text-slate-400 font-mono-numbers">
                          Orig: {formatCurrency(tx.amount, tx.currency)}
                        </div>
                      )}
                    </div>

                    {/* Edit & Delete Action Buttons */}
                    <div className="flex items-center gap-1 ml-1 opacity-90 group-hover:opacity-100">
                      <button
                        onClick={() => setEditingTransaction(tx)}
                        className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 flex items-center justify-center transition cursor-pointer"
                        title="Edit Transaction"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingTransaction(tx);
                        }}
                        className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-rose-600 hover:border-rose-300 flex items-center justify-center transition cursor-pointer"
                        title="Delete Transaction"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Transaction Modal */}
      <EditTransactionModal
        isOpen={Boolean(editingTransaction)}
        onClose={() => setEditingTransaction(null)}
        transaction={editingTransaction}
        profile={profile}
        accounts={accounts}
        categories={categories}
        onSaveTransaction={onUpdateTransaction}
        onDeleteTransaction={onDeleteTransaction}
      />
    </div>
  );
};
