/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Crown,
  Sparkles,
  ChevronDown,
  PieChart as PieIcon,
  BarChart3,
  TrendingUp,
  Activity,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRightLeft,
  Calendar,
  PiggyBank,
  Wallet,
  Check,
} from 'lucide-react';
import { Account, Transaction, UserProfile } from '../types/finance';
import { convertCurrency, formatCurrency, getCachedRates } from '../services/currencyService';
import { EntitlementService } from '../services/entitlementService';
import { DynamicIcon } from './IconAndColorPicker';

interface AnalysisScreenProps {
  profile: UserProfile;
  accounts: Account[];
  transactions: Transaction[];
  onOpenUpgrade: () => void;
}

export type TimeFilterPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all';

export const AnalysisScreen: React.FC<AnalysisScreenProps> = ({
  profile,
  accounts,
  transactions,
  onOpenUpgrade,
}) => {
  const prefCurrency = profile.preferredCurrency;
  const rates = getCachedRates().rates;
  const isPro = EntitlementService.isPro(profile);

  const [selectedTimeFilter, setSelectedTimeFilter] = useState<TimeFilterPeriod>('monthly');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);

  // Selected account object (or undefined if 'all')
  const currentAccount = useMemo(() => {
    return accounts.find((a) => a.id === selectedAccountId);
  }, [accounts, selectedAccountId]);

  // Filter transactions strictly based on selected account and period
  const { filteredTransactions, periodLabel } = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const monthStr = now.toISOString().slice(0, 7);
    const yearStr = now.toISOString().slice(0, 4);

    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

    let pLabel = 'This Month';
    if (selectedTimeFilter === 'daily') pLabel = `Today (${todayStr})`;
    else if (selectedTimeFilter === 'weekly') pLabel = 'Last 7 Days';
    else if (selectedTimeFilter === 'monthly') pLabel = `This Month (${now.toLocaleString('default', { month: 'short' })} ${yearStr})`;
    else if (selectedTimeFilter === 'yearly') pLabel = `This Year (${yearStr})`;
    else if (selectedTimeFilter === 'all') pLabel = 'All Time';

    const list = transactions.filter((tx) => {
      // 1. Account Filter
      if (selectedAccountId !== 'all') {
        const matchesSource = tx.accountId === selectedAccountId;
        const matchesDest = tx.type === 'transfer' && tx.toAccountId === selectedAccountId;
        if (!matchesSource && !matchesDest) return false;
      }

      // 2. Time Filter
      if (selectedTimeFilter === 'daily') {
        return tx.date === todayStr;
      }
      if (selectedTimeFilter === 'weekly') {
        return tx.date >= sevenDaysAgo && tx.date <= todayStr;
      }
      if (selectedTimeFilter === 'monthly') {
        return tx.date.startsWith(monthStr);
      }
      if (selectedTimeFilter === 'yearly') {
        return tx.date.startsWith(yearStr);
      }
      return true; // 'all'
    });

    return { filteredTransactions: list, periodLabel: pLabel };
  }, [transactions, selectedAccountId, selectedTimeFilter]);

  // Financial aggregates — Strictly calculated from real Firestore transactions
  // TRANSFERS ARE NEVER COUNTED AS INCOME OR EXPENSES
  const analysisData = useMemo(() => {
    // 1. Current Account or Total Balance
    const bal = accounts
      .filter((a) => (selectedAccountId === 'all' ? true : a.id === selectedAccountId))
      .reduce((sum, a) => sum + convertCurrency(a.balance, a.currency, prefCurrency, rates), 0);

    let inc = 0;
    let exp = 0;
    let transferIn = 0;
    let transferOut = 0;
    let transferInternal = 0;
    const catMap: Record<string, { amount: number; count: number }> = {};

    filteredTransactions.forEach((tx) => {
      const converted = convertCurrency(
        tx.amount,
        tx.currency,
        prefCurrency,
        rates,
        tx.exchangeRateAtTransaction
      );

      if (tx.type === 'income') {
        // Income is only counted for destination/target account
        if (selectedAccountId === 'all' || tx.accountId === selectedAccountId) {
          inc += converted;
        }
      } else if (tx.type === 'expense') {
        // Expense is only counted for source account
        if (selectedAccountId === 'all' || tx.accountId === selectedAccountId) {
          exp += converted;
          const cat = tx.category || 'General';
          if (!catMap[cat]) catMap[cat] = { amount: 0, count: 0 };
          catMap[cat].amount += converted;
          catMap[cat].count += 1;
        }
      } else if (tx.type === 'transfer') {
        // Transfers are NEVER income or expense!
        if (selectedAccountId === 'all') {
          transferInternal += converted;
        } else {
          if (tx.accountId === selectedAccountId) {
            transferOut += converted;
          }
          if (tx.toAccountId === selectedAccountId) {
            transferIn += converted;
          }
        }
      }
    });

    // Net savings
    const netSavings = inc - exp;
    const savingsRate = inc > 0 ? (netSavings / inc) * 100 : 0;

    // Category breakdown sorted highest first
    const categoryBreakdown = Object.entries(catMap)
      .map(([name, data]) => ({
        name,
        amount: data.amount,
        count: data.count,
        percentage: exp > 0 ? (data.amount / exp) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    // Real dynamic monthly trend (last 6 months) calculated strictly from real data
    const monthsBack: { label: string; key: string; income: number; expense: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7);
      const label = d.toLocaleString('default', { month: 'short' });
      monthsBack.push({ label, key, income: 0, expense: 0 });
    }

    transactions.forEach((tx) => {
      if (selectedAccountId !== 'all' && tx.accountId !== selectedAccountId && tx.toAccountId !== selectedAccountId) {
        return;
      }
      const txMonth = tx.date.slice(0, 7);
      const bucket = monthsBack.find((m) => m.key === txMonth);
      if (bucket) {
        const converted = convertCurrency(
          tx.amount,
          tx.currency,
          prefCurrency,
          rates,
          tx.exchangeRateAtTransaction
        );
        if (tx.type === 'income') {
          if (selectedAccountId === 'all' || tx.accountId === selectedAccountId) {
            bucket.income += converted;
          }
        } else if (tx.type === 'expense') {
          if (selectedAccountId === 'all' || tx.accountId === selectedAccountId) {
            bucket.expense += converted;
          }
        }
      }
    });

    const maxTrendVal = Math.max(
      1,
      ...monthsBack.map((m) => Math.max(m.income, m.expense))
    );

    return {
      totalBalance: bal,
      incomeTotal: inc,
      expenseTotal: exp,
      transferIn,
      transferOut,
      transferInternal,
      netSavings,
      savingsRate,
      categoryBreakdown,
      monthlyTrend: monthsBack,
      maxTrendVal,
    };
  }, [accounts, filteredTransactions, transactions, selectedAccountId, prefCurrency, rates]);

  return (
    <div className="max-w-md md:max-w-5xl mx-auto px-4 py-4 pb-28 space-y-5">
      {/* 1. Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-[#0B1528] dark:text-white tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span>Account Financial Analysis</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Strict real-time ledger verification · {periodLabel}
          </p>
        </div>

        {/* Display Currency Indicator */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
            Ledger Currency: <strong className="text-slate-900 dark:text-white font-mono">{prefCurrency}</strong>
          </span>
        </div>
      </div>

      {/* 2. Account Selector & Time Filters */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-4">
        {/* Account Selection Row */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Filter by Account
            </label>
            <span className="text-[10px] text-slate-400">
              {selectedAccountId === 'all' ? 'Consolidated ledger' : `Isolated: ${currentAccount?.name}`}
            </span>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {/* All Accounts Pill */}
            <button
              type="button"
              onClick={() => setSelectedAccountId('all')}
              className={`flex-shrink-0 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                selectedAccountId === 'all'
                  ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 shadow-xs ring-2 ring-blue-500/20'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 text-slate-700 dark:text-slate-300'
              }`}
            >
              <div className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center text-[10px]">
                <Layers className="w-3 h-3" />
              </div>
              <span>All Accounts</span>
            </button>

            {/* Individual Accounts */}
            {accounts.map((acc) => {
              const isSelected = selectedAccountId === acc.id;
              return (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => setSelectedAccountId(acc.id)}
                  className={`flex-shrink-0 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 shadow-xs ring-2 ring-blue-500/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div
                    className="w-5 h-5 rounded-md flex items-center justify-center text-white text-[10px]"
                    style={{ backgroundColor: acc.color || '#3B82F6' }}
                  >
                    <DynamicIcon name={acc.icon || 'Landmark'} className="w-3 h-3" />
                  </div>
                  <span className="truncate max-w-[100px]">{acc.name}</span>
                  <span className="text-[10px] font-mono font-medium text-slate-400">
                    {formatCurrency(acc.balance, acc.currency)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Period Switcher (Daily, Weekly, Monthly, Yearly, All) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Time Period
            </label>
            <span className="text-[10px] text-slate-400">{filteredTransactions.length} records analyzed</span>
          </div>

          <div className="bg-[#EEF2F6] dark:bg-slate-800 p-1 rounded-xl flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            {(
              [
                { id: 'daily', label: 'Daily' },
                { id: 'weekly', label: 'Weekly' },
                { id: 'monthly', label: 'Monthly' },
                { id: 'yearly', label: 'Yearly' },
                { id: 'all', label: 'All Time' },
              ] as const
            ).map((p) => {
              const active = selectedTimeFilter === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedTimeFilter(p.id)}
                  className={`flex-1 py-1.5 px-1.5 text-center rounded-lg transition cursor-pointer text-xs ${
                    active
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-extrabold shadow-xs'
                      : 'hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Core Financial Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Balance Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              {selectedAccountId === 'all' ? 'Total Net Worth' : `${currentAccount?.name} Balance`}
            </span>
            <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
              <Wallet className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-extrabold font-mono-numbers text-[#0B1528] dark:text-white mt-1">
            {formatCurrency(analysisData.totalBalance, prefCurrency)}
          </div>
          {selectedAccountId !== 'all' && currentAccount && currentAccount.currency !== prefCurrency && (
            <span className="text-[10px] font-mono font-medium text-slate-400 mt-0.5 block">
              In Account: {formatCurrency(currentAccount.balance, currentAccount.currency)}
            </span>
          )}
        </div>

        {/* Income Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              Total Income
            </span>
            <div className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
              <ArrowDownLeft className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-extrabold font-mono-numbers text-emerald-600 dark:text-emerald-400 mt-1">
            +{formatCurrency(analysisData.incomeTotal, prefCurrency)}
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            {filteredTransactions.filter((t) => t.type === 'income').length} credit transactions
          </span>
        </div>

        {/* Expense Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              Total Expenses
            </span>
            <div className="w-6 h-6 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-extrabold font-mono-numbers text-rose-600 dark:text-rose-400 mt-1">
            -{formatCurrency(analysisData.expenseTotal, prefCurrency)}
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            {filteredTransactions.filter((t) => t.type === 'expense').length} debit transactions
          </span>
        </div>

        {/* Net Savings Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              Net Savings / Flow
            </span>
            <div className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center">
              <PiggyBank className="w-3.5 h-3.5" />
            </div>
          </div>
          <div
            className={`text-xl font-extrabold font-mono-numbers mt-1 ${
              analysisData.netSavings >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {analysisData.netSavings >= 0 ? '+' : ''}
            {formatCurrency(analysisData.netSavings, prefCurrency)}
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block font-mono">
            Savings Rate: {analysisData.savingsRate.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* 4. Transfer Movement Card (Transfers never affect income/expense) */}
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <ArrowRightLeft className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-extrabold text-slate-900 dark:text-white">
              Internal Transfers & Capital Movement
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Verified strictly: Transfers shift liquidity without altering profit, income, or loss.
            </p>
          </div>
        </div>

        {selectedAccountId === 'all' ? (
          <div className="text-right sm:text-right font-mono font-bold text-slate-800 dark:text-slate-200">
            {formatCurrency(analysisData.transferInternal, prefCurrency)} moved internally
          </div>
        ) : (
          <div className="flex items-center gap-4 text-xs font-mono">
            <div>
              <span className="text-slate-400 text-[10px] block">Transferred In</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                +{formatCurrency(analysisData.transferIn, prefCurrency)}
              </span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block">Transferred Out</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">
                -{formatCurrency(analysisData.transferOut, prefCurrency)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 5. Real 6-Month Cash Flow Trend Bar Chart */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-[#0B1528] dark:text-white">
              6-Month Real Cash Flow History
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Aggregated from verified transactions in {prefCurrency}
            </p>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-bold">
            <span className="flex items-center gap-1.5 text-emerald-600">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Income
            </span>
            <span className="flex items-center gap-1.5 text-rose-600">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Expense
            </span>
          </div>
        </div>

        <div className="h-40 flex items-end gap-2 pt-4 px-2 border-b border-slate-100 dark:border-slate-800">
          {analysisData.monthlyTrend.map((m) => {
            const incHeight = Math.min(100, (m.income / analysisData.maxTrendVal) * 100);
            const expHeight = Math.min(100, (m.expense / analysisData.maxTrendVal) * 100);

            return (
              <div key={m.key} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end justify-center gap-1 h-28">
                  {/* Income Bar */}
                  <div
                    title={`${m.label} Income: ${formatCurrency(m.income, prefCurrency)}`}
                    className="w-1/2 max-w-[18px] bg-emerald-500 hover:bg-emerald-400 rounded-t-sm transition-all"
                    style={{ height: `${Math.max(4, incHeight)}%` }}
                  />
                  {/* Expense Bar */}
                  <div
                    title={`${m.label} Expense: ${formatCurrency(m.expense, prefCurrency)}`}
                    className="w-1/2 max-w-[18px] bg-rose-500 hover:bg-rose-400 rounded-t-sm transition-all"
                    style={{ height: `${Math.max(4, expHeight)}%` }}
                  />
                </div>
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-1">
                  {m.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. Spending by Category Breakdown */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-[#0B1528] dark:text-white">
            Category Spending Distribution ({periodLabel})
          </h3>
          <span className="text-xs text-slate-400">
            {analysisData.categoryBreakdown.length} active spending categories
          </span>
        </div>

        {analysisData.categoryBreakdown.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No expenses recorded for this account in the selected time range.
          </div>
        ) : (
          <div className="space-y-3.5">
            {analysisData.categoryBreakdown.map((cat) => (
              <div key={cat.name} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 dark:text-slate-200">{cat.name}</span>
                    <span className="text-[10px] text-slate-400">({cat.count} txns)</span>
                  </div>
                  <span className="font-bold font-mono-numbers text-slate-900 dark:text-white">
                    {formatCurrency(cat.amount, prefCurrency)} ({cat.percentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${Math.min(100, cat.percentage)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
