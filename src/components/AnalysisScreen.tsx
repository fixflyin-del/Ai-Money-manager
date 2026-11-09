/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Crown,
  Sparkles,
  Lock,
  ChevronDown,
  PieChart as PieIcon,
  BarChart3,
  TrendingUp,
} from 'lucide-react';
import { Account, Transaction, UserProfile } from '../types/finance';
import { convertCurrency, formatCurrency, getCachedRates } from '../services/currencyService';

interface AnalysisScreenProps {
  profile: UserProfile;
  accounts: Account[];
  transactions: Transaction[];
  onOpenUpgrade: () => void;
}

export const AnalysisScreen: React.FC<AnalysisScreenProps> = ({
  profile,
  accounts,
  transactions,
  onOpenUpgrade,
}) => {
  const prefCurrency = profile.preferredCurrency;
  const rates = getCachedRates().rates;
  const isPro = profile.subscription.isPro;

  const [selectedTimeFilter, setSelectedTimeFilter] = useState<'weekly' | 'monthly' | 'yearly' | 'custom'>('monthly');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');

  // Filter transactions for This Month
  const currentMonthTransactions = useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    return transactions.filter((tx) => {
      if (selectedAccountId !== 'all' && tx.accountId !== selectedAccountId) return false;
      return tx.date.startsWith(currentMonth);
    });
  }, [transactions, selectedAccountId]);

  // Totals
  const { totalBalance, thisMonthIncome, thisMonthExpense, categoryBreakdown } = useMemo(() => {
    // Consolidated Balance
    const totBal = accounts
      .filter((a) => (selectedAccountId === 'all' ? true : a.id === selectedAccountId))
      .reduce((sum, a) => sum + convertCurrency(a.balance, a.currency, prefCurrency, rates), 0);

    let inc = 0;
    let exp = 0;
    const catMap: Record<string, number> = {};

    currentMonthTransactions.forEach((tx) => {
      const converted = convertCurrency(
        tx.amount,
        tx.currency,
        prefCurrency,
        rates,
        tx.exchangeRateAtTransaction
      );
      if (tx.type === 'income') inc += converted;
      else if (tx.type === 'expense') {
        exp += converted;
        catMap[tx.category] = (catMap[tx.category] || 0) + converted;
      }
    });

    const topCats = Object.entries(catMap)
      .map(([name, amount]) => ({
        name,
        amount,
        percentage: exp > 0 ? (amount / exp) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      totalBalance: totBal,
      thisMonthIncome: inc,
      thisMonthExpense: exp,
      categoryBreakdown: topCats,
    };
  }, [accounts, currentMonthTransactions, selectedAccountId, prefCurrency, rates]);

  return (
    <div className="max-w-md mx-auto px-4 py-4 pb-28 space-y-4">
      {/* 1. Premium Access Banner (Screenshot 2) */}
      {!isPro && (
        <div className="bg-amber-50/50 border border-amber-200/90 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-[#0B1528] leading-tight">
                Free Plan · Basic Monthly Overview Only
              </h2>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Upgrade to Premium to unlock all 6 interactive charts, per-account analytics, Weekly/Yearly/Custom filters, and category transaction drilldowns.
              </p>
            </div>
          </div>

          <button
            onClick={onOpenUpgrade}
            className="w-full sm:w-auto py-2.5 px-5 rounded-xl bg-[#0B1528] hover:bg-[#111e38] text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 shadow-md active:scale-[0.99] transition cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Upgrade to Premium</span>
          </button>
        </div>
      )}

      {/* 2. Account Selector Button (Screenshot 2) */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => {
            if (accounts.length > 0) {
              const nextId = selectedAccountId === 'all' ? accounts[0].id : 'all';
              setSelectedAccountId(nextId);
            }
          }}
          className="py-2.5 px-4 rounded-xl bg-[#0B1528] text-white font-bold text-xs inline-flex items-center gap-2 shadow-md cursor-pointer"
        >
          <span>
            {selectedAccountId === 'all'
              ? 'All Accounts Consolidated'
              : accounts.find((a) => a.id === selectedAccountId)?.name || 'Account'}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </button>

        <span className="text-[11px] font-bold text-slate-400 font-mono">
          {prefCurrency}
        </span>
      </div>

      {/* 3. Segmented Filters: Weekly (Lock), Monthly, Yearly (Lock), Custom (Lock) (Screenshot 2) */}
      <div className="bg-[#EEF2F6] p-1 rounded-2xl flex items-center justify-between text-xs font-semibold text-slate-500 shadow-2xs">
        {/* Weekly */}
        <button
          onClick={() => {
            if (!isPro) onOpenUpgrade();
            else setSelectedTimeFilter('weekly');
          }}
          className="flex-1 py-2 px-1 text-center rounded-xl transition cursor-pointer flex items-center justify-center gap-1"
        >
          {!isPro && <Lock className="w-3 h-3 text-slate-400" />}
          <span>Weekly</span>
        </button>

        {/* Monthly (Active) */}
        <button
          onClick={() => setSelectedTimeFilter('monthly')}
          className="flex-1 py-2 px-1 text-center rounded-xl bg-white text-slate-900 shadow-xs font-bold transition cursor-pointer"
        >
          <span>Monthly</span>
        </button>

        {/* Yearly */}
        <button
          onClick={() => {
            if (!isPro) onOpenUpgrade();
            else setSelectedTimeFilter('yearly');
          }}
          className="flex-1 py-2 px-1 text-center rounded-xl transition cursor-pointer flex items-center justify-center gap-1"
        >
          {!isPro && <Lock className="w-3 h-3 text-slate-400" />}
          <span>Yearly</span>
        </button>

        {/* Custom */}
        <button
          onClick={() => {
            if (!isPro) onOpenUpgrade();
            else setSelectedTimeFilter('custom');
          }}
          className="flex-1 py-2 px-1 text-center rounded-xl transition cursor-pointer flex items-center justify-center gap-1"
        >
          {!isPro && <Lock className="w-3 h-3 text-slate-400" />}
          <span>Custom</span>
        </button>
      </div>

      {/* 4. Financial Metric Cards (Screenshot 2) */}
      <div className="space-y-3.5">
        {/* Current Total Balance Card */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block">Current Total Balance</span>
          <div className="text-2xl font-extrabold font-mono-numbers text-[#2563EB] mt-1">
            {formatCurrency(totalBalance, prefCurrency)}
          </div>
        </div>

        {/* This Month Income Card */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block">This Month Income</span>
          <div className="text-2xl font-extrabold font-mono-numbers text-emerald-500 mt-1">
            +{formatCurrency(thisMonthIncome, prefCurrency)}
          </div>
        </div>

        {/* This Month Expense Card */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block">This Month Expense</span>
          <div className="text-2xl font-extrabold font-mono-numbers text-rose-500 mt-1">
            -{formatCurrency(thisMonthExpense, prefCurrency)}
          </div>
        </div>

        {/* Top Expense Categories Preview Card */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-[#0B1528]">
              Top Expense Categories Preview (This Month)
            </h3>
            <span className="text-xs text-slate-400">
              Showing top 2 of {categoryBreakdown.length} categories
            </span>
          </div>

          {categoryBreakdown.length === 0 ? (
            <p className="text-xs text-slate-400 py-3 text-center">
              No expenses recorded this month
            </p>
          ) : (
            <div className="space-y-3 pt-1">
              {categoryBreakdown.slice(0, 2).map((cat) => (
                <div key={cat.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">{cat.name}</span>
                    <span className="font-bold font-mono-numbers text-slate-900">
                      {formatCurrency(cat.amount, prefCurrency)} ({cat.percentage.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-600"
                      style={{ width: `${Math.min(100, cat.percentage)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
