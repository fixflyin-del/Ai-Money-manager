/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Sparkles,
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
  Percent,
  CheckCircle2,
  Clock,
  ArrowRight,
  Flame,
  ShieldCheck,
} from 'lucide-react';
import { Account, Transaction, UserProfile } from '../types/finance';
import { convertCurrency, formatCurrency, getCachedRates } from '../services/currencyService';
import { DynamicIcon } from './IconAndColorPicker';

interface AnalysisScreenProps {
  profile: UserProfile;
  accounts: Account[];
  transactions: Transaction[];
  onOpenUpgrade?: () => void;
}

export type TimeFilterPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all';

// Pre-defined vivid fintech palette for Donut/Pie charts
const CHART_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#8B5CF6', // Purple
  '#06B6D4', // Cyan
  '#EF4444', // Red
  '#6366F1', // Indigo
  '#14B8A6', // Teal
  '#F97316', // Orange
];

export const AnalysisScreen: React.FC<AnalysisScreenProps> = ({
  profile,
  accounts,
  transactions,
}) => {
  const prefCurrency = profile.preferredCurrency;
  const rates = getCachedRates().rates;

  // Active top-level tab in Analysis: 'general' vs 'account_deep' (Account-Wise Deep Analysis)
  const [activeAnalysisTab, setActiveAnalysisTab] = useState<'general' | 'account_deep'>('account_deep');

  const [selectedTimeFilter, setSelectedTimeFilter] = useState<TimeFilterPeriod>('monthly');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

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
        if (selectedAccountId === 'all' || tx.accountId === selectedAccountId) {
          inc += converted;
        }
      } else if (tx.type === 'expense') {
        if (selectedAccountId === 'all' || tx.accountId === selectedAccountId) {
          exp += converted;
          const cat = tx.category || 'General';
          if (!catMap[cat]) catMap[cat] = { amount: 0, count: 0 };
          catMap[cat].amount += converted;
          catMap[cat].count += 1;
        }
      } else if (tx.type === 'transfer') {
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
    const expenseToIncomeRatio = inc > 0 ? Math.min(100, Math.round((exp / inc) * 100)) : exp > 0 ? 100 : 0;

    // Category breakdown sorted highest first with assigned palette colors
    const categoryBreakdown = Object.entries(catMap)
      .map(([name, data], idx) => ({
        name,
        amount: data.amount,
        count: data.count,
        percentage: exp > 0 ? (data.amount / exp) * 100 : 0,
        color: CHART_COLORS[idx % CHART_COLORS.length],
      }))
      .sort((a, b) => b.amount - a.amount);

    // Real dynamic monthly trend (last 6 months)
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
      expenseToIncomeRatio,
      categoryBreakdown,
      monthlyTrend: monthsBack,
      maxTrendVal,
    };
  }, [accounts, filteredTransactions, transactions, selectedAccountId, prefCurrency, rates]);

  // Donut Chart Math (Circumference & Segments)
  const donutMath = useMemo(() => {
    const radius = 64;
    const circumference = 2 * Math.PI * radius;
    let accumulatedPercent = 0;

    const segments = analysisData.categoryBreakdown.map((cat) => {
      const strokeDasharray = `${(cat.percentage / 100) * circumference} ${circumference}`;
      const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
      accumulatedPercent += cat.percentage;
      return {
        ...cat,
        strokeDasharray,
        strokeDashoffset,
      };
    });

    return { radius, circumference, segments };
  }, [analysisData.categoryBreakdown]);

  return (
    <div className="max-w-md md:max-w-5xl mx-auto px-4 py-4 pb-28 space-y-4">
      {/* 1. Top Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-[#0B1528] dark:text-white tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span>Financial Analysis</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
              100% Free Unlocked
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time ledger audit · {periodLabel}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
            Display Currency: <strong className="text-slate-900 dark:text-white font-mono">{prefCurrency}</strong>
          </span>
        </div>
      </div>

      {/* 2. TAB SWITCHER: General Analysis vs Account-Wise Deep Analysis */}
      <div className="bg-[#EEF2F6] dark:bg-slate-800 p-1 rounded-2xl flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 shadow-2xs gap-1">
        <button
          type="button"
          onClick={() => setActiveAnalysisTab('account_deep')}
          className={`flex-1 py-2.5 px-3 text-center rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
            activeAnalysisTab === 'account_deep'
              ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs font-black'
              : 'hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <PieIcon className="w-3.5 h-3.5 text-blue-500" />
          <span>Account-Wise Deep Analysis</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-sm bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[9px] font-extrabold uppercase">
            Charts & Rings
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveAnalysisTab('general')}
          className={`flex-1 py-2.5 px-3 text-center rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
            activeAnalysisTab === 'general'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-black'
              : 'hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>General Trends</span>
        </button>
      </div>

      {/* 3. Account Selector & Time Filters (Consistent across both views) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-4 shadow-xs space-y-3.5">
        {/* Account Selection Horizontal Cards */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Select Account for Analysis
            </label>
            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
              {selectedAccountId === 'all' ? 'All Accounts Overview • Live Summary' : `Selected: ${currentAccount?.name}`}
            </span>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {/* All Accounts Card */}
            <button
              type="button"
              onClick={() => setSelectedAccountId('all')}
              className={`flex-shrink-0 px-3.5 py-2.5 rounded-2xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-2.5 shadow-2xs ${
                selectedAccountId === 'all'
                  ? 'border-blue-500 bg-blue-50/90 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 ring-2 ring-blue-500/20'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 text-slate-700 dark:text-slate-300'
              }`}
            >
              <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center text-[10px] shadow-xs">
                <Layers className="w-3.5 h-3.5" />
              </div>
              <div className="text-left">
                <span className="block leading-tight font-extrabold">All Accounts</span>
                <span className="text-[10px] font-mono text-slate-400 font-normal">
                  {accounts.length} active
                </span>
              </div>
            </button>

            {/* Individual Accounts */}
            {accounts.map((acc) => {
              const isSelected = selectedAccountId === acc.id;
              return (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => setSelectedAccountId(acc.id)}
                  className={`flex-shrink-0 px-3.5 py-2.5 rounded-2xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-2.5 shadow-2xs ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50/90 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 ring-2 ring-blue-500/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div
                    className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[10px] shadow-xs"
                    style={{ backgroundColor: acc.color || '#3B82F6' }}
                  >
                    <DynamicIcon name={acc.icon || 'Landmark'} className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-left">
                    <span className="block leading-tight font-extrabold truncate max-w-[110px]">{acc.name}</span>
                    <span className="text-[10px] font-mono font-medium text-slate-400">
                      {formatCurrency(acc.balance, acc.currency)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Time Period Filter */}
        <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
          <div className="bg-[#EEF2F6] dark:bg-slate-800 p-1 rounded-xl flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
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
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-black shadow-xs'
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

      {/* 4. TAB 1: ACCOUNT-WISE DEEP ANALYSIS (DONUT CHARTS & CIRCULAR RINGS) */}
      {activeAnalysisTab === 'account_deep' && (
        <div className="space-y-4">
          {/* Main Round Donut Chart Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-black text-[#0B1528] dark:text-white flex items-center gap-2">
                  <PieIcon className="w-4 h-4 text-blue-600" />
                  <span>Account Spending Donut & Distribution</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Interactive breakdown of outflows for {currentAccount ? currentAccount.name : 'All Accounts'} ({periodLabel})
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold font-mono text-slate-800 dark:text-slate-200">
                  Total Spent: <strong className="text-rose-600 dark:text-rose-400">{formatCurrency(analysisData.expenseTotal, prefCurrency)}</strong>
                </span>
              </div>
            </div>

            {analysisData.categoryBreakdown.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                <PieIcon className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 stroke-[1.5]" />
                <p>No expense transactions found for this account in the selected period.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center pt-2">
                {/* SVG Round Donut Chart */}
                <div className="md:col-span-5 flex flex-col items-center justify-center relative">
                  <div className="relative w-48 h-48 sm:w-56 sm:h-56">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
                      {/* Background track circle */}
                      <circle
                        cx="80"
                        cy="80"
                        r={donutMath.radius}
                        className="stroke-slate-100 dark:stroke-slate-800 fill-none"
                        strokeWidth="20"
                      />

                      {/* Donut Segments */}
                      {donutMath.segments.map((seg) => (
                        <circle
                          key={seg.name}
                          cx="80"
                          cy="80"
                          r={donutMath.radius}
                          fill="none"
                          stroke={seg.color}
                          strokeWidth={hoveredCategory === seg.name ? '24' : '20'}
                          strokeDasharray={seg.strokeDasharray}
                          strokeDashoffset={seg.strokeDashoffset}
                          className="transition-all duration-300 cursor-pointer"
                          onMouseEnter={() => setHoveredCategory(seg.name)}
                          onMouseLeave={() => setHoveredCategory(null)}
                        />
                      ))}
                    </svg>

                    {/* Central Donut Readout */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none p-4">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                        {hoveredCategory || 'Total Outflow'}
                      </span>
                      <span className="text-base sm:text-lg font-black font-mono-numbers text-slate-900 dark:text-white mt-0.5 truncate max-w-[130px]">
                        {hoveredCategory
                          ? formatCurrency(
                              analysisData.categoryBreakdown.find((c) => c.name === hoveredCategory)?.amount || 0,
                              prefCurrency
                            )
                          : formatCurrency(analysisData.expenseTotal, prefCurrency)}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 font-mono mt-0.5">
                        {hoveredCategory
                          ? `${(analysisData.categoryBreakdown.find((c) => c.name === hoveredCategory)?.percentage || 0).toFixed(1)}% of total`
                          : `${analysisData.categoryBreakdown.length} Categories`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Slices Legend & Distribution List */}
                <div className="md:col-span-7 space-y-2.5">
                  <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">
                    Category Share Breakdown
                  </span>
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {analysisData.categoryBreakdown.map((cat) => {
                      const isHovered = hoveredCategory === cat.name;
                      return (
                        <div
                          key={cat.name}
                          onMouseEnter={() => setHoveredCategory(cat.name)}
                          onMouseLeave={() => setHoveredCategory(null)}
                          className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                            isHovered
                              ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 shadow-xs'
                              : 'border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className="w-3 h-3 rounded-full shrink-0 shadow-2xs"
                              style={{ backgroundColor: cat.color }}
                            />
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                              {cat.name}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              ({cat.count} txns)
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-right">
                            <span className="text-xs font-black font-mono-numbers text-slate-900 dark:text-white">
                              {formatCurrency(cat.amount, prefCurrency)}
                            </span>
                            <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400 min-w-[42px] text-right">
                              {cat.percentage.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 3 Circular Progress Rings: Inflow vs Outflow, Savings Retention, Discretionary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Ring 1: Inflow vs Outflow Coverage */}
            <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
              <div className="relative w-16 h-16 shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 48 48">
                  <circle cx="24" cy="24" r="18" className="stroke-slate-100 dark:stroke-slate-800 fill-none" strokeWidth="5" />
                  <circle
                    cx="24"
                    cy="24"
                    r="18"
                    fill="none"
                    stroke={analysisData.expenseToIncomeRatio > 90 ? '#EF4444' : '#10B981'}
                    strokeWidth="5"
                    strokeDasharray={`${2 * Math.PI * 18}`}
                    strokeDashoffset={`${(1 - analysisData.expenseToIncomeRatio / 100) * 2 * Math.PI * 18}`}
                    strokeLinecap="round"
                    className="transition-all duration-500"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center font-black font-mono text-xs text-slate-900 dark:text-white">
                  {analysisData.expenseToIncomeRatio}%
                </div>
              </div>

              <div className="min-w-0">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                  Outflow / Inflow
                </span>
                <h4 className="text-xs font-black text-slate-900 dark:text-white truncate mt-0.5">
                  Absorption Ratio
                </h4>
                <span className="text-[10px] text-slate-500 font-medium block truncate">
                  {analysisData.expenseToIncomeRatio <= 70 ? 'Healthy Buffer' : 'High Spending'}
                </span>
              </div>
            </div>

            {/* Ring 2: Net Savings Rate */}
            <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
              <div className="relative w-16 h-16 shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 48 48">
                  <circle cx="24" cy="24" r="18" className="stroke-slate-100 dark:stroke-slate-800 fill-none" strokeWidth="5" />
                  <circle
                    cx="24"
                    cy="24"
                    r="18"
                    fill="none"
                    stroke="#3B82F6"
                    strokeWidth="5"
                    strokeDasharray={`${2 * Math.PI * 18}`}
                    strokeDashoffset={`${(1 - Math.max(0, Math.min(100, analysisData.savingsRate)) / 100) * 2 * Math.PI * 18}`}
                    strokeLinecap="round"
                    className="transition-all duration-500"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center font-black font-mono text-xs text-blue-600 dark:text-blue-400">
                  {Math.max(0, Math.round(analysisData.savingsRate))}%
                </div>
              </div>

              <div className="min-w-0">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                  Savings Retention
                </span>
                <h4 className="text-xs font-black text-slate-900 dark:text-white truncate mt-0.5">
                  Net Savings Rate
                </h4>
                <span className="text-[10px] text-slate-500 font-medium block truncate">
                  {analysisData.netSavings >= 0 ? `+${formatCurrency(analysisData.netSavings, prefCurrency)} retained` : 'Deficit flow'}
                </span>
              </div>
            </div>

            {/* Ring 3: Top Category Concentration */}
            <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
              {(() => {
                const topCatPercent = analysisData.categoryBreakdown[0]?.percentage || 0;
                return (
                  <>
                    <div className="relative w-16 h-16 shrink-0">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 48 48">
                        <circle cx="24" cy="24" r="18" className="stroke-slate-100 dark:stroke-slate-800 fill-none" strokeWidth="5" />
                        <circle
                          cx="24"
                          cy="24"
                          r="18"
                          fill="none"
                          stroke="#EC4899"
                          strokeWidth="5"
                          strokeDasharray={`${2 * Math.PI * 18}`}
                          strokeDashoffset={`${(1 - topCatPercent / 100) * 2 * Math.PI * 18}`}
                          strokeLinecap="round"
                          className="transition-all duration-500"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center font-black font-mono text-xs text-pink-600 dark:text-pink-400">
                        {Math.round(topCatPercent)}%
                      </div>
                    </div>

                    <div className="min-w-0">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                        Concentration
                      </span>
                      <h4 className="text-xs font-black text-slate-900 dark:text-white truncate mt-0.5">
                        {analysisData.categoryBreakdown[0]?.name || 'N/A'}
                      </h4>
                      <span className="text-[10px] text-slate-500 font-medium block truncate">
                        Largest outflow driver
                      </span>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Account Inflow vs Outflow Cash Movement Card */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 shadow-2xs">
              <span className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider block">
                Total Inflow (Credits)
              </span>
              <div className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                +{formatCurrency(analysisData.incomeTotal, prefCurrency)}
              </div>
              <span className="text-[10px] text-emerald-600/80 font-medium mt-0.5 block">
                {filteredTransactions.filter((t) => t.type === 'income').length} credit transactions
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 shadow-2xs">
              <span className="text-[10px] font-extrabold text-rose-700 dark:text-rose-300 uppercase tracking-wider block">
                Total Outflow (Debits)
              </span>
              <div className="text-lg font-black font-mono text-rose-600 dark:text-rose-400 mt-1">
                -{formatCurrency(analysisData.expenseTotal, prefCurrency)}
              </div>
              <span className="text-[10px] text-rose-600/80 font-medium mt-0.5 block">
                {filteredTransactions.filter((t) => t.type === 'expense').length} debit transactions
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 shadow-2xs">
              <span className="text-[10px] font-extrabold text-blue-700 dark:text-blue-300 uppercase tracking-wider block">
                Internal Account Transfers
              </span>
              <div className="text-lg font-black font-mono text-blue-600 dark:text-blue-400 mt-1">
                {selectedAccountId === 'all'
                  ? formatCurrency(analysisData.transferInternal, prefCurrency)
                  : `+${formatCurrency(analysisData.transferIn, prefCurrency)} / -${formatCurrency(analysisData.transferOut, prefCurrency)}`}
              </div>
              <span className="text-[10px] text-blue-600/80 font-medium mt-0.5 block">
                Transfers shift funds without loss/gain
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 5. TAB 2: GENERAL TRENDS & MONTHLY BAR CHART */}
      {activeAnalysisTab === 'general' && (
        <div className="space-y-4">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  {selectedAccountId === 'all' ? 'Total Net Worth' : `${currentAccount?.name} Balance`}
                </span>
                <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
                  <Wallet className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-xl font-black font-mono-numbers text-[#0B1528] dark:text-white mt-1">
                {formatCurrency(analysisData.totalBalance, prefCurrency)}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  Total Income
                </span>
                <div className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-xl font-black font-mono-numbers text-emerald-600 dark:text-emerald-400 mt-1">
                +{formatCurrency(analysisData.incomeTotal, prefCurrency)}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  Total Expenses
                </span>
                <div className="w-6 h-6 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-xl font-black font-mono-numbers text-rose-600 dark:text-rose-400 mt-1">
                -{formatCurrency(analysisData.expenseTotal, prefCurrency)}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  Net Savings
                </span>
                <div className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center">
                  <PiggyBank className="w-3.5 h-3.5" />
                </div>
              </div>
              <div
                className={`text-xl font-black font-mono-numbers mt-1 ${
                  analysisData.netSavings >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {analysisData.netSavings >= 0 ? '+' : ''}
                {formatCurrency(analysisData.netSavings, prefCurrency)}
              </div>
            </div>
          </div>

          {/* 6-Month Cash Flow Trend Bar Chart */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-[#0B1528] dark:text-white">
                  6-Month Real Cash Flow History
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Historical monthly trend for {selectedAccountId === 'all' ? 'All Accounts' : currentAccount?.name}
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

            <div className="h-44 flex items-end gap-2 pt-4 px-2 border-b border-slate-100 dark:border-slate-800">
              {analysisData.monthlyTrend.map((m) => {
                const incHeight = Math.min(100, (m.income / analysisData.maxTrendVal) * 100);
                const expHeight = Math.min(100, (m.expense / analysisData.maxTrendVal) * 100);

                return (
                  <div key={m.key} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex items-end justify-center gap-1.5 h-32">
                      <div
                        title={`${m.label} Income: ${formatCurrency(m.income, prefCurrency)}`}
                        className="w-1/2 max-w-[20px] bg-emerald-500 hover:bg-emerald-400 rounded-t-sm transition-all"
                        style={{ height: `${Math.max(4, incHeight)}%` }}
                      />
                      <div
                        title={`${m.label} Expense: ${formatCurrency(m.expense, prefCurrency)}`}
                        className="w-1/2 max-w-[20px] bg-rose-500 hover:bg-rose-400 rounded-t-sm transition-all"
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

          {/* Category Distribution Bar List */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-extrabold text-[#0B1528] dark:text-white">
              Category Spending Distribution ({periodLabel})
            </h3>
            <div className="space-y-3">
              {analysisData.categoryBreakdown.map((cat) => (
                <div key={cat.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200">{cat.name}</span>
                    <span className="font-bold font-mono text-slate-900 dark:text-white">
                      {formatCurrency(cat.amount, prefCurrency)} ({cat.percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-600 transition-all duration-300"
                      style={{ width: `${Math.min(100, cat.percentage)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
