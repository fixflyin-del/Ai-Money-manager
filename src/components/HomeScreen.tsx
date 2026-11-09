/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRightLeft,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { Account, Transaction, UserProfile } from '../types/finance';
import { convertCurrency, formatCurrency, getCachedRates } from '../services/currencyService';
import { DynamicIcon } from './IconAndColorPicker';

interface HomeScreenProps {
  profile: UserProfile;
  accounts: Account[];
  transactions: Transaction[];
  onOpenAddModal: () => void;
  onOpenCreateAccount: () => void;
  onNavigateManage: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  profile,
  accounts,
  transactions,
  onOpenAddModal,
  onOpenCreateAccount,
  onNavigateManage,
}) => {
  const prefCurrency = profile.preferredCurrency;
  const rates = getCachedRates().rates;

  // Filters from Screenshot 4
  const [timeFilter, setTimeFilter] = useState<'week' | 'month' | 'year' | 'all'>('month');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense' | 'transfer'>('all');

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    return transactions.filter((tx) => {
      // Type filter
      if (typeFilter !== 'all' && tx.type !== typeFilter) return false;

      // Time filter
      const txDate = new Date(tx.date);
      const diffDays = (now.getTime() - txDate.getTime()) / (1000 * 3600 * 24);
      if (timeFilter === 'week') return diffDays <= 7;
      if (timeFilter === 'month') return diffDays <= 30;
      if (timeFilter === 'year') return diffDays <= 365;
      return true;
    });
  }, [transactions, timeFilter, typeFilter]);

  // Income and Expense totals for the selected period in preferred display currency
  const { totalIncome, totalExpense } = useMemo(() => {
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
    return { totalIncome: inc, totalExpense: exp };
  }, [filteredTransactions, prefCurrency, rates]);

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-4 pb-28 md:pb-12 space-y-5">
      {/* 1. Your Accounts Section Header */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-extrabold text-[#0B1528] dark:text-white tracking-tight">
            Your Accounts ({accounts.length})
          </h2>
          {accounts.length > 0 && (
            <button
              onClick={onNavigateManage}
              className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5"
            >
              <span>Manage</span>
              <ChevronRight className="w-3 h-3" />
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

      {/* 2. Horizontally Scrollable Account Carousel (Requirement 8) */}
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
          {/* Horizontal Scrollable Carousel Container */}
          <div className="flex items-stretch gap-3 overflow-x-auto pb-3 pt-1 scrollbar-none snap-x -mx-4 px-4 sm:mx-0 sm:px-0">
            {accounts.map((acc) => {
              const convertedVal = convertCurrency(acc.balance, acc.currency, prefCurrency, rates);
              const isDifferent = acc.currency !== prefCurrency;
              const cardColor = acc.color || '#2563EB';

              return (
                <div
                  key={acc.id}
                  onClick={onNavigateManage}
                  className="shrink-0 w-64 sm:w-72 snap-start p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group hover:shadow-md"
                  style={{
                    backgroundColor: cardColor,
                    borderColor: 'rgba(255, 255, 255, 0.15)',
                    color: '#FFFFFF',
                  }}
                >
                  {/* Subtle decorative glow */}
                  <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full bg-white/10 blur-xl pointer-events-none" />

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
                  <div className="text-xs sm:text-sm font-extrabold text-white tracking-wide uppercase truncate relative z-10">
                    {acc.name}
                  </div>

                  {/* Balance Display */}
                  <div className="text-lg sm:text-xl font-extrabold font-mono-numbers text-white mt-1 relative z-10">
                    {formatCurrency(acc.balance, acc.currency)}
                  </div>

                  {/* Converted Balance if different */}
                  {isDifferent && (
                    <div className="text-[11px] text-white/80 font-mono-numbers mt-0.5 truncate relative z-10">
                      ≈ {formatCurrency(convertedVal, prefCurrency)}
                    </div>
                  )}

                  {/* Bottom details */}
                  <div className="flex items-center justify-between text-[10px] text-white/70 pt-3 mt-2 border-t border-white/15 relative z-10 font-medium">
                    <span>{acc.currency} Account</span>
                    <span>Manage →</span>
                  </div>
                </div>
              );
            })}

            {/* + Add New Account Quick Tile */}
            <button
              onClick={onOpenCreateAccount}
              className="shrink-0 w-36 sm:w-44 snap-start p-4 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-800 flex flex-col items-center justify-center gap-2 text-slate-600 dark:text-slate-400 transition cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 shadow-2xs">
                <Plus className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-center">New Account</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. Responsive Multi-Column Section on Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column: Metrics and Summaries (Span 1 on desktop) */}
        <div className="space-y-4 lg:col-span-1">
          {/* Income & Expense Split Cards (Screenshot 4) */}
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-3.5">
            {/* Income Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
              <div>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  Income
                </span>
                <div className="text-lg sm:text-xl font-extrabold font-mono-numbers text-emerald-500 mt-0.5">
                  +{formatCurrency(totalIncome, prefCurrency)}
                </div>
              </div>
              <div className="w-9 h-9 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100/60 dark:border-emerald-800 flex items-center justify-center text-emerald-600 shrink-0">
                <ArrowDownLeft className="w-5 h-5 stroke-[2.5]" />
              </div>
            </div>

            {/* Expense Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
              <div>
                <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                  Expense
                </span>
                <div className="text-lg sm:text-xl font-extrabold font-mono-numbers text-rose-500 mt-0.5">
                  -{formatCurrency(totalExpense, prefCurrency)}
                </div>
              </div>
              <div className="w-9 h-9 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-100/60 dark:border-rose-800 flex items-center justify-center text-rose-600 shrink-0">
                <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
              </div>
            </div>
          </div>

          {/* Quick Balance Summary for Desktop */}
          <div className="hidden lg:block bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 space-y-2 shadow-2xs">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Active Display Currency
            </span>
            <div className="text-sm font-extrabold font-mono text-blue-600 dark:text-blue-400">
              {prefCurrency} · Live Rates Active
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Original amounts are preserved immutably. Change display currency anytime in Profile.
            </p>
          </div>
        </div>

        {/* Right Column: Filters and Statements Ledger (Span 2 on desktop) */}
        <div className="space-y-4 lg:col-span-2">
          {/* 4. Filter Bar (Screenshot 4) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-2.5 space-y-2 shadow-2xs">
            {/* Row 1: Time Filters */}
            <div className="bg-[#EEF2F6] dark:bg-slate-800 p-1 rounded-xl flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
              {[
                { id: 'week', label: 'This Week' },
                { id: 'month', label: 'This Month' },
                { id: 'year', label: 'This Year' },
                { id: 'all', label: 'All Time' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setTimeFilter(item.id as any)}
                  className={`flex-1 py-1.5 px-2 text-center rounded-lg transition cursor-pointer text-xs ${
                    timeFilter === item.id
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
                      : 'hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Row 2: Transaction Type Filters */}
            <div className="bg-[#EEF2F6] dark:bg-slate-800 p-1 rounded-xl flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
              {[
                { id: 'all', label: 'All' },
                { id: 'income', label: 'Income' },
                { id: 'expense', label: 'Expense' },
                { id: 'transfer', label: 'Transfer' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setTypeFilter(item.id as any)}
                  className={`flex-1 py-1.5 px-2 text-center rounded-lg transition cursor-pointer text-xs ${
                    typeFilter === item.id
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
                      : 'hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* 5. Statement List / Empty State (Screenshot 4) */}
          {filteredTransactions.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-8 text-center shadow-xs space-y-4">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                No statements for this filter
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
                const account = accounts.find((a) => a.id === tx.accountId);

                return (
                  <div
                    key={tx.id}
                    className="p-3.5 flex items-center justify-between hover:bg-slate-50/60 dark:hover:bg-slate-800/60 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
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
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {tx.description || tx.category}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                          {tx.date} • {account?.name || 'Account'} • {tx.paymentMode}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0 pl-2">
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
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
