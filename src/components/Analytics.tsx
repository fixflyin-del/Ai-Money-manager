/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  FileText,
  FileSpreadsheet,
  PieChart as PieIcon,
  BarChart3,
  TrendingUp,
  Download,
  Calendar,
  Layers,
} from 'lucide-react';
import { Account, CurrencyCode, Transaction, UserProfile } from '../types/finance';
import {
  convertCurrency,
  formatCurrency,
  getCachedRates,
} from '../services/currencyService';
import { ExportService } from '../services/exportService';

interface AnalyticsProps {
  profile: UserProfile;
  accounts: Account[];
  transactions: Transaction[];
}

export const Analytics: React.FC<AnalyticsProps> = ({
  profile,
  accounts,
  transactions,
}) => {
  const prefCurrency = profile.preferredCurrency;
  const rates = getCachedRates().rates;
  const [timeRange, setTimeRange] = useState<'month' | 'quarter' | 'year' | 'all'>('month');

  // Category Colors
  const categoryColors: Record<string, string> = {
    'Food & Dining': '#f59e0b',
    Groceries: '#10b981',
    Transport: '#3b82f6',
    Shopping: '#ec4899',
    Utilities: '#8b5cf6',
    Entertainment: '#06b6d4',
    Health: '#ef4444',
    Travel: '#14b8a6',
    Salary: '#22c55e',
    Freelance: '#6366f1',
    Investments: '#eab308',
    General: '#64748b',
  };

  // Filter transactions by selected time range
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    return transactions.filter((tx) => {
      if (timeRange === 'all') return true;
      const txDate = new Date(tx.date);
      const diffDays = (now.getTime() - txDate.getTime()) / (1000 * 3600 * 24);
      if (timeRange === 'month') return diffDays <= 30;
      if (timeRange === 'quarter') return diffDays <= 90;
      if (timeRange === 'year') return diffDays <= 365;
      return true;
    });
  }, [transactions, timeRange]);

  // Aggregate Category Breakdown
  const { categoryBreakdown, totalExpenses, totalIncome } = useMemo(() => {
    const map: Record<string, number> = {};
    let expTotal = 0;
    let incTotal = 0;

    filteredTransactions.forEach((tx) => {
      const converted = convertCurrency(
        tx.amount,
        tx.currency,
        prefCurrency,
        rates,
        tx.exchangeRateAtTransaction
      );

      if (tx.type === 'expense') {
        expTotal += converted;
        map[tx.category] = (map[tx.category] || 0) + converted;
      } else if (tx.type === 'income') {
        incTotal += converted;
      }
    });

    const list = Object.entries(map)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: expTotal > 0 ? (amount / expTotal) * 100 : 0,
        color: categoryColors[category] || '#94a3b8',
      }))
      .sort((a, b) => b.amount - a.amount);

    return { categoryBreakdown: list, totalExpenses: expTotal, totalIncome: incTotal };
  }, [filteredTransactions, prefCurrency, rates]);

  // Monthly Cashflow data for custom SVG Bar Chart
  const monthlyCashflow = useMemo(() => {
    const monthsMap: Record<string, { income: number; expense: number }> = {};
    const months = ['2026-07', '2026-08', '2026-09', '2026-10', '2026-11'];

    months.forEach((m) => {
      monthsMap[m] = { income: 0, expense: 0 };
    });

    transactions.forEach((tx) => {
      const monthKey = tx.date.slice(0, 7);
      if (monthsMap[monthKey]) {
        const converted = convertCurrency(
          tx.amount,
          tx.currency,
          prefCurrency,
          rates,
          tx.exchangeRateAtTransaction
        );
        if (tx.type === 'income') monthsMap[monthKey].income += converted;
        else if (tx.type === 'expense') monthsMap[monthKey].expense += converted;
      }
    });

    return months.map((m) => {
      const label = new Date(`${m}-01`).toLocaleString('default', { month: 'short' });
      return {
        month: label,
        income: monthsMap[m].income,
        expense: monthsMap[m].expense,
      };
    });
  }, [transactions, prefCurrency, rates]);

  const maxCashflow = useMemo(() => {
    let max = 1;
    monthlyCashflow.forEach((d) => {
      if (d.income > max) max = d.income;
      if (d.expense > max) max = d.expense;
    });
    return max;
  }, [monthlyCashflow]);

  // Calculate SVG Pie/Donut Slices
  const donutSlices = useMemo(() => {
    let cumulativeAngle = 0;
    return categoryBreakdown.map((item) => {
      const angle = (item.percentage / 100) * 360;
      const startAngle = cumulativeAngle;
      const endAngle = cumulativeAngle + angle;
      cumulativeAngle += angle;

      // Coordinate helper
      const getCoordinates = (ang: number, radius: number) => {
        const rad = ((ang - 90) * Math.PI) / 180.0;
        return {
          x: 100 + radius * Math.cos(rad),
          y: 100 + radius * Math.sin(rad),
        };
      };

      const startOuter = getCoordinates(startAngle, 80);
      const endOuter = getCoordinates(endAngle, 80);
      const startInner = getCoordinates(endAngle, 50);
      const endInner = getCoordinates(startAngle, 50);
      const largeArcFlag = angle > 180 ? 1 : 0;

      const pathData = [
        `M ${startOuter.x} ${startOuter.y}`,
        `A 80 80 0 ${largeArcFlag} 1 ${endOuter.x} ${endOuter.y}`,
        `L ${startInner.x} ${startInner.y}`,
        `A 50 50 0 ${largeArcFlag} 0 ${endInner.x} ${endInner.y}`,
        'Z',
      ].join(' ');

      return {
        ...item,
        pathData,
      };
    });
  }, [categoryBreakdown]);

  return (
    <div className="space-y-6 pb-24 md:pb-12 max-w-7xl mx-auto px-4 sm:px-6 pt-6">
      {/* Top Header & Export Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white">Financial Analytics & Reports</h1>
          <p className="text-xs text-slate-400">
            Insights rendered in your preferred currency:{' '}
            <span className="text-emerald-400 font-semibold">{prefCurrency}</span>
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => ExportService.generatePdfStatement(transactions, accounts, profile)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition cursor-pointer"
          >
            <FileText className="w-4 h-4 text-rose-400" />
            <span>PDF Statement</span>
          </button>

          <button
            onClick={() => ExportService.exportExcelSheet(transactions, accounts, profile)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Time Range Filter Bar */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-[#1E293B] border border-slate-700/80">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Calendar className="w-4 h-4 text-emerald-400" />
          <span>Report Horizon:</span>
        </div>

        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
          {(['month', 'quarter', 'year', 'all'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={`px-3 py-1 rounded text-xs font-medium uppercase transition cursor-pointer ${
                timeRange === r
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {r === 'month' ? '30 Days' : r === 'quarter' ? '90 Days' : r === 'year' ? '1 Year' : 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-[#1E293B] border border-slate-700/80">
          <span className="text-xs text-slate-400 font-medium">Total Income</span>
          <div className="text-xl font-extrabold font-mono-numbers text-emerald-400 mt-1">
            +{formatCurrency(totalIncome, prefCurrency)}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#1E293B] border border-slate-700/80">
          <span className="text-xs text-slate-400 font-medium">Total Expenses</span>
          <div className="text-xl font-extrabold font-mono-numbers text-rose-400 mt-1">
            -{formatCurrency(totalExpenses, prefCurrency)}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#1E293B] border border-slate-700/80">
          <span className="text-xs text-slate-400 font-medium">Net Savings</span>
          <div
            className={`text-xl font-extrabold font-mono-numbers mt-1 ${
              totalIncome - totalExpenses >= 0 ? 'text-indigo-400' : 'text-rose-400'
            }`}
          >
            {formatCurrency(totalIncome - totalExpenses, prefCurrency)}
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expense Breakdown Donut Chart */}
        <div className="rounded-2xl bg-[#1E293B] border border-slate-700/80 p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-white text-base">Expense Breakdown</h3>
              </div>
              <span className="text-xs text-slate-400">{filteredTransactions.length} transactions</span>
            </div>

            {categoryBreakdown.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">No expense records in this range.</div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-6 my-2">
                {/* SVG Donut */}
                <div className="relative w-48 h-48 shrink-0">
                  <svg viewBox="0 0 200 200" className="w-full h-full transform -rotate-90">
                    {donutSlices.map((slice, idx) => (
                      <path
                        key={idx}
                        d={slice.pathData}
                        fill={slice.color}
                        className="hover:opacity-85 transition-opacity"
                      />
                    ))}
                  </svg>
                  {/* Center Text */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Total</span>
                    <span className="text-xs font-bold font-mono-numbers text-white px-2 truncate max-w-[110px]">
                      {formatCurrency(totalExpenses, prefCurrency, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>

                {/* Category Legends */}
                <div className="flex-1 space-y-2 w-full">
                  {categoryBreakdown.slice(0, 5).map((cat) => (
                    <div key={cat.category} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                        <span className="text-slate-300 font-medium truncate max-w-[120px]">{cat.category}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono-numbers font-bold text-white">
                          {formatCurrency(cat.amount, prefCurrency)}
                        </span>
                        <span className="text-[10px] text-slate-400 ml-1.5 font-mono">
                          ({cat.percentage.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Monthly Cashflow Bar Chart */}
        <div className="rounded-2xl bg-[#1E293B] border border-slate-700/80 p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-400" />
                <h3 className="font-bold text-white text-base">Monthly Cashflow Trend</h3>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Income
                </span>
                <span className="flex items-center gap-1.5 text-rose-400">
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" /> Expenses
                </span>
              </div>
            </div>

            {/* Custom SVG/CSS Bar Chart */}
            <div className="h-48 flex items-end justify-between gap-4 pt-6 pb-2 px-2 border-b border-slate-800">
              {monthlyCashflow.map((m) => {
                const incHeight = maxCashflow > 0 ? (m.income / maxCashflow) * 100 : 0;
                const expHeight = maxCashflow > 0 ? (m.expense / maxCashflow) * 100 : 0;

                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center h-full justify-end group">
                    <div className="w-full flex items-end justify-center gap-1 h-36">
                      {/* Income Bar */}
                      <div
                        className="w-1/2 max-w-[18px] bg-emerald-500/90 rounded-t group-hover:bg-emerald-400 transition-all relative"
                        style={{ height: `${Math.max(4, incHeight)}%` }}
                        title={`Income: ${formatCurrency(m.income, prefCurrency)}`}
                      />
                      {/* Expense Bar */}
                      <div
                        className="w-1/2 max-w-[18px] bg-rose-500/90 rounded-t group-hover:bg-rose-400 transition-all relative"
                        style={{ height: `${Math.max(4, expHeight)}%` }}
                        title={`Expenses: ${formatCurrency(m.expense, prefCurrency)}`}
                      />
                    </div>
                    <span className="text-[11px] font-medium text-slate-400 mt-2">{m.month}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="text-[11px] text-slate-400 text-center mt-3">
            Values unified in {prefCurrency} based on live reserve rates.
          </div>
        </div>
      </div>
    </div>
  );
};
