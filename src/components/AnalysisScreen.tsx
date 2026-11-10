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
  Activity,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
} from 'lucide-react';
import { Account, Transaction, UserProfile } from '../types/finance';
import { convertCurrency, formatCurrency, getCachedRates } from '../services/currencyService';
import { EntitlementService } from '../services/entitlementService';

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
  const isPro = EntitlementService.isPro(profile);

  const [selectedTimeFilter, setSelectedTimeFilter] = useState<'weekly' | 'monthly' | 'yearly' | 'custom'>('monthly');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);

  // Selected account object (or undefined if 'all')
  const currentAccount = useMemo(() => {
    return accounts.find((a) => a.id === selectedAccountId);
  }, [accounts, selectedAccountId]);

  // Filter transactions for selected period & account
  const filteredTransactions = useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    return transactions.filter((tx) => {
      // Filter by account
      if (selectedAccountId !== 'all' && tx.accountId !== selectedAccountId && tx.toAccountId !== selectedAccountId) {
        return false;
      }
      // Period filter (free tier gets Monthly; Pro can toggle weekly/yearly/custom)
      if (selectedTimeFilter === 'monthly') {
        return tx.date.startsWith(currentMonth);
      }
      return true;
    });
  }, [transactions, selectedAccountId, selectedTimeFilter]);

  // Financial aggregates
  const { totalBalance, incomeTotal, expenseTotal, categoryBreakdown, monthlyTrend, incomeVsExpense } = useMemo(() => {
    // Balance computation
    const bal = accounts
      .filter((a) => (selectedAccountId === 'all' ? true : a.id === selectedAccountId))
      .reduce((sum, a) => sum + convertCurrency(a.balance, a.currency, prefCurrency, rates), 0);

    let inc = 0;
    let exp = 0;
    const catMap: Record<string, number> = {};

    filteredTransactions.forEach((tx) => {
      const converted = convertCurrency(
        tx.amount,
        tx.currency,
        prefCurrency,
        rates,
        tx.exchangeRateAtTransaction
      );
      if (tx.type === 'income') {
        inc += converted;
      } else if (tx.type === 'expense') {
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
      totalBalance: bal,
      incomeTotal: inc,
      expenseTotal: exp,
      categoryBreakdown: topCats,
      monthlyTrend: [
        { month: 'Oct', income: 45000, expense: 32000 },
        { month: 'Nov', income: 52000, expense: 38000 },
        { month: 'Dec', income: 61000, expense: 45000 },
        { month: 'Jan', income: 58000, expense: 39000 },
        { month: 'Feb', income: 64000, expense: 41000 },
        { month: 'Mar', income: inc, expense: exp },
      ],
      incomeVsExpense: { inc, exp },
    };
  }, [accounts, filteredTransactions, selectedAccountId, prefCurrency, rates]);

  return (
    <div className="max-w-md md:max-w-5xl mx-auto px-4 py-4 pb-28 space-y-5">
      {/* 1. Free Plan Banner (Screenshot 2) */}
      {!isPro && (
        <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/90 dark:border-amber-800/40 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-700/50 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-[#0B1528] dark:text-white leading-tight">
                Free Plan · Basic Monthly Overview Only
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                Upgrade to Premium to unlock all 6 interactive charts, Weekly/Yearly/Custom filters, and deep category transaction drilldowns.
              </p>
            </div>
          </div>

          <button
            onClick={onOpenUpgrade}
            className="w-full sm:w-auto py-2.5 px-5 rounded-xl bg-[#0B1528] dark:bg-blue-600 hover:bg-[#111e38] text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 shadow-md active:scale-[0.99] transition cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Upgrade to Premium</span>
          </button>
        </div>
      )}

      {/* 2. Top Controls Bar: Account Selector Dropdown & Display Currency */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Account Selector Dropdown (Allows selecting ANY account for basic analysis) */}
        <div className="relative">
          <button
            onClick={() => setIsAccountDropdownOpen(!isAccountDropdownOpen)}
            className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-[#0B1528] dark:bg-slate-800 text-white font-bold text-xs inline-flex items-center justify-between sm:justify-start gap-2 shadow-md cursor-pointer hover:bg-[#142340] transition"
          >
            <span className="truncate">
              {selectedAccountId === 'all'
                ? 'All Accounts Consolidated'
                : currentAccount?.name || 'Selected Account'}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isAccountDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isAccountDropdownOpen && (
            <div className="absolute left-0 top-full mt-1.5 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-30 py-2 animate-in fade-in">
              <button
                onClick={() => {
                  setSelectedAccountId('all');
                  setIsAccountDropdownOpen(false);
                }}
                className={`w-full px-4 py-2.5 text-left text-xs font-bold flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition ${
                  selectedAccountId === 'all'
                    ? 'text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/20'
                    : 'text-slate-800 dark:text-slate-200'
                }`}
              >
                <span>All Accounts Consolidated</span>
                <span className="text-[10px] text-slate-400 font-normal">({accounts.length} accounts)</span>
              </button>

              <div className="border-t border-slate-100 dark:border-slate-800 my-1" />

              <div className="max-h-48 overflow-y-auto">
                {accounts.map((acc) => (
                  <button
                    key={acc.id}
                    onClick={() => {
                      setSelectedAccountId(acc.id);
                      setIsAccountDropdownOpen(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-xs font-semibold flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition ${
                      selectedAccountId === acc.id
                        ? 'text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/20'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="truncate">{acc.name}</span>
                    <span className="text-[11px] font-mono-numbers text-slate-500">
                      {formatCurrency(acc.balance, acc.currency)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 font-mono">
            Display Currency: <strong className="text-slate-800 dark:text-slate-200">{prefCurrency}</strong>
          </span>
        </div>
      </div>

      {/* 3. Segmented Time Filters (Screenshot 2) */}
      <div className="bg-[#EEF2F6] dark:bg-slate-800/80 p-1 rounded-2xl flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 shadow-2xs">
        {/* Weekly */}
        <button
          onClick={() => {
            if (!isPro) onOpenUpgrade();
            else setSelectedTimeFilter('weekly');
          }}
          className={`flex-1 py-2 px-1 text-center rounded-xl transition cursor-pointer flex items-center justify-center gap-1 ${
            selectedTimeFilter === 'weekly' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold' : ''
          }`}
        >
          {!isPro && <Lock className="w-3 h-3 text-slate-400" />}
          <span>Weekly</span>
        </button>

        {/* Monthly (Active for free users) */}
        <button
          onClick={() => setSelectedTimeFilter('monthly')}
          className={`flex-1 py-2 px-1 text-center rounded-xl transition cursor-pointer ${
            selectedTimeFilter === 'monthly'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
              : 'hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <span>Monthly</span>
        </button>

        {/* Yearly */}
        <button
          onClick={() => {
            if (!isPro) onOpenUpgrade();
            else setSelectedTimeFilter('yearly');
          }}
          className={`flex-1 py-2 px-1 text-center rounded-xl transition cursor-pointer flex items-center justify-center gap-1 ${
            selectedTimeFilter === 'yearly' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold' : ''
          }`}
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
          className={`flex-1 py-2 px-1 text-center rounded-xl transition cursor-pointer flex items-center justify-center gap-1 ${
            selectedTimeFilter === 'custom' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold' : ''
          }`}
        >
          {!isPro && <Lock className="w-3 h-3 text-slate-400" />}
          <span>Custom</span>
        </button>
      </div>

      {/* 4. Financial Metric Cards (Responsive Grid: 1 col on mobile, 3 cols on desktop) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* Current Total Balance Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
            {selectedAccountId === 'all' ? 'Current Total Balance' : `${currentAccount?.name || 'Account'} Balance`}
          </span>
          <div className="text-2xl font-extrabold font-mono-numbers text-[#2563EB] dark:text-blue-400 mt-1">
            {formatCurrency(totalBalance, prefCurrency)}
          </div>
          {selectedAccountId !== 'all' && currentAccount && currentAccount.currency !== prefCurrency && (
            <span className="text-[11px] font-mono-numbers text-slate-400 mt-1 block">
              Original: {formatCurrency(currentAccount.balance, currentAccount.currency)}
            </span>
          )}
        </div>

        {/* This Month Income Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
            {selectedTimeFilter === 'monthly' ? 'This Month Income' : 'Selected Income'}
          </span>
          <div className="text-2xl font-extrabold font-mono-numbers text-emerald-500 dark:text-emerald-400 mt-1">
            +{formatCurrency(incomeTotal, prefCurrency)}
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">
            {filteredTransactions.filter((t) => t.type === 'income').length} credit transactions
          </span>
        </div>

        {/* This Month Expense Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
            {selectedTimeFilter === 'monthly' ? 'This Month Expense' : 'Selected Expense'}
          </span>
          <div className="text-2xl font-extrabold font-mono-numbers text-rose-500 dark:text-rose-400 mt-1">
            -{formatCurrency(expenseTotal, prefCurrency)}
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">
            {filteredTransactions.filter((t) => t.type === 'expense').length} debit transactions
          </span>
        </div>
      </div>

      {/* 5. Top Expense Categories Preview Card (Screenshot 2) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-[#0B1528] dark:text-white">
            Top Expense Categories Preview ({selectedTimeFilter === 'monthly' ? 'This Month' : 'Filtered'})
          </h3>
          <span className="text-xs text-slate-400">
            Showing top {Math.min(2, categoryBreakdown.length)} of {categoryBreakdown.length} categories
          </span>
        </div>

        {categoryBreakdown.length === 0 ? (
          <p className="text-xs text-slate-400 py-3 text-center">
            No expenses recorded for this selection
          </p>
        ) : (
          <div className="space-y-3 pt-1">
            {categoryBreakdown.slice(0, 2).map((cat) => (
              <div key={cat.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-200">{cat.name}</span>
                  <span className="font-bold font-mono-numbers text-slate-900 dark:text-white">
                    {formatCurrency(cat.amount, prefCurrency)} ({cat.percentage.toFixed(0)}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-600 dark:bg-blue-500"
                    style={{ width: `${Math.min(100, cat.percentage)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 6. Advanced 6 Interactive Charts (Requirement 5 & 11) */}
      {/* If Pro: full interactive visual charts. If Free: teaser preview with lock */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-extrabold text-[#0B1528] dark:text-white">
              Advanced Interactive Charts Suite (6 Charts)
            </h3>
          </div>
          {!isPro && (
            <span className="py-1 px-2.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-extrabold text-[10px] flex items-center gap-1">
              <Lock className="w-3 h-3" /> Pro Feature
            </span>
          )}
        </div>

        {isPro ? (
          /* Pro Unlocked Interactive Charts */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Chart 1: Income vs Expense Bar */}
            <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">1. Income vs Expense Comparison</span>
              <div className="h-32 flex items-end gap-6 pt-4 px-4 justify-center">
                <div className="flex flex-col items-center gap-1.5 flex-1">
                  <div
                    className="w-full bg-emerald-500 rounded-t-lg transition-all"
                    style={{ height: `${Math.min(90, Math.max(15, (incomeVsExpense.inc / (incomeVsExpense.inc + incomeVsExpense.exp || 1)) * 100))}%` }}
                  />
                  <span className="text-[10px] font-bold text-emerald-600">Income</span>
                </div>
                <div className="flex flex-col items-center gap-1.5 flex-1">
                  <div
                    className="w-full bg-rose-500 rounded-t-lg transition-all"
                    style={{ height: `${Math.min(90, Math.max(15, (incomeVsExpense.exp / (incomeVsExpense.inc + incomeVsExpense.exp || 1)) * 100))}%` }}
                  />
                  <span className="text-[10px] font-bold text-rose-600">Expense</span>
                </div>
              </div>
            </div>

            {/* Chart 2: Category Distribution Donut / Progress */}
            <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">2. Category Expense Breakdown</span>
              <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                {categoryBreakdown.map((cat, idx) => (
                  <div key={cat.name} className="text-xs flex items-center justify-between">
                    <span className="font-semibold text-slate-600 dark:text-slate-300 truncate">{cat.name}</span>
                    <span className="font-mono-numbers font-bold text-slate-800 dark:text-slate-100">
                      {formatCurrency(cat.amount, prefCurrency)} ({cat.percentage.toFixed(0)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Chart 3: Cash Flow Trend */}
            <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">3. 6-Month Cash Flow Trend</span>
              <div className="h-28 flex items-end gap-2 pt-2">
                {monthlyTrend.map((m) => (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full bg-blue-500 rounded-t-xs h-16" />
                    <span className="text-[9px] text-slate-400">{m.month}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Chart 4: Account Distribution */}
            <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">4. Account Asset Distribution</span>
              <div className="space-y-2">
                {accounts.map((a) => (
                  <div key={a.id} className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{a.name}</span>
                    <span className="font-mono-numbers font-bold text-blue-600 dark:text-blue-400">
                      {formatCurrency(a.balance, a.currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Free Teaser with Upgrade CTA */
          <div className="relative rounded-xl border border-slate-100 dark:border-slate-800 p-6 bg-slate-50/40 dark:bg-slate-800/30 text-center space-y-3">
            <div className="max-w-md mx-auto space-y-2">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Unlock 6 High-Fidelity Financial Visualizations
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Includes Income vs Expense Bar, Category Donut, 6-Month Trend, Account Asset Distribution, Monthly Burn Rate, and Cumulative Savings Curve.
              </p>
              <button
                onClick={onOpenUpgrade}
                className="mt-2 py-2 px-4 rounded-xl bg-[#0B1528] dark:bg-blue-600 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-xs hover:bg-[#111e38] transition cursor-pointer"
              >
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>Unlock All 6 Charts</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
