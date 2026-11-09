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
  Wallet,
  Building2,
  CreditCard,
  Smartphone,
  Banknote,
  Receipt,
  ChevronRight,
} from 'lucide-react';
import { Account, Transaction, UserProfile } from '../types/finance';
import { convertCurrency, formatCurrency, getCachedRates } from '../services/currencyService';

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
    <div className="max-w-md mx-auto px-4 py-4 pb-28 space-y-4">
      {/* 1. Your Accounts Section Header */}
      <div className="flex items-center justify-between pt-1">
        <h2 className="text-sm font-extrabold text-[#0B1528] tracking-tight">
          Your Accounts ({accounts.length})
        </h2>
        <button
          onClick={onOpenCreateAccount}
          className="text-xs font-bold text-slate-800 hover:text-blue-600 transition cursor-pointer"
        >
          + New Account
        </button>
      </div>

      {/* 2. Accounts Card (Empty state or account list) */}
      {accounts.length === 0 ? (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 text-center shadow-xs">
          <h3 className="text-base font-extrabold text-[#0B1528]">
            No accounts created yet
          </h3>
          <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1 mb-5 leading-relaxed">
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
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            {accounts.slice(0, 4).map((acc) => {
              const convertedVal = convertCurrency(acc.balance, acc.currency, prefCurrency, rates);
              const isDifferent = acc.currency !== prefCurrency;
              return (
                <div
                  key={acc.id}
                  onClick={onNavigateManage}
                  className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:border-slate-300 transition cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      {acc.type}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 font-semibold">{acc.currency}</span>
                  </div>
                  <div className="text-xs font-bold text-slate-900 truncate">{acc.name}</div>
                  <div className="text-sm font-extrabold font-mono-numbers text-slate-900 mt-1">
                    {formatCurrency(acc.balance, acc.currency)}
                  </div>
                  {isDifferent && (
                    <div className="text-[10px] text-slate-400 font-mono-numbers truncate">
                      ≈ {formatCurrency(convertedVal, prefCurrency)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {accounts.length > 4 && (
            <button
              onClick={onNavigateManage}
              className="w-full text-center py-2 text-xs font-semibold text-blue-600 hover:underline"
            >
              View all {accounts.length} accounts →
            </button>
          )}
        </div>
      )}

      {/* 3. Income & Expense Split Cards (Screenshot 4) */}
      <div className="grid grid-cols-2 gap-3.5">
        {/* Income Card */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
          <div>
            <span className="text-xs font-bold text-emerald-600">Income</span>
            <div className="text-lg font-extrabold font-mono-numbers text-emerald-500 mt-0.5">
              +{formatCurrency(totalIncome, prefCurrency)}
            </div>
          </div>
          <div className="w-9 h-9 rounded-full bg-emerald-50 border border-emerald-100/60 flex items-center justify-center text-emerald-600 shrink-0">
            <ArrowDownLeft className="w-5 h-5 stroke-[2.5]" />
          </div>
        </div>

        {/* Expense Card */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
          <div>
            <span className="text-xs font-bold text-rose-600">Expense</span>
            <div className="text-lg font-extrabold font-mono-numbers text-rose-500 mt-0.5">
              -{formatCurrency(totalExpense, prefCurrency)}
            </div>
          </div>
          <div className="w-9 h-9 rounded-full bg-rose-50 border border-rose-100/60 flex items-center justify-center text-rose-600 shrink-0">
            <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
          </div>
        </div>
      </div>

      {/* 4. Filter Bar (Screenshot 4) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-2.5 space-y-2 shadow-2xs">
        {/* Row 1: Time Filters */}
        <div className="bg-[#EEF2F6] p-1 rounded-xl flex items-center justify-between text-xs font-semibold text-slate-500">
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
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'hover:text-slate-800'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Row 2: Transaction Type Filters */}
        <div className="bg-[#EEF2F6] p-1 rounded-xl flex items-center justify-between text-xs font-semibold text-slate-500">
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
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'hover:text-slate-800'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* 5. Statement List / Empty State (Screenshot 4) */}
      {filteredTransactions.length === 0 ? (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-8 text-center shadow-xs space-y-4">
          <p className="text-xs font-bold text-slate-800">
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
        <div className="bg-white border border-slate-200/90 rounded-2xl divide-y divide-slate-100 shadow-xs overflow-hidden">
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
              <div key={tx.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50/60 transition">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isIncome
                        ? 'bg-emerald-50 text-emerald-600'
                        : isTransfer
                        ? 'bg-blue-50 text-blue-600'
                        : 'bg-rose-50 text-rose-600'
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
                    <div className="text-xs font-bold text-slate-900 truncate">
                      {tx.description || tx.category}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                      {tx.date} • {account?.name || 'Account'} • {tx.paymentMode}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0 pl-2">
                  <div
                    className={`text-xs sm:text-sm font-extrabold font-mono-numbers ${
                      isIncome ? 'text-emerald-500' : isTransfer ? 'text-blue-600' : 'text-rose-500'
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
  );
};
