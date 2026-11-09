/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Building2,
  CreditCard,
  Smartphone,
  Banknote,
  ArrowRight,
  Camera,
  Mic,
  Plus,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { Account, Budget, CurrencyCode, Transaction, UserProfile } from '../types/finance';
import { convertCurrency, formatCurrency, getCachedRates, getCurrencyInfo } from '../services/currencyService';

interface DashboardProps {
  profile: UserProfile;
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  onQuickAdd: () => void;
  onOpenReceiptScanner: () => void;
  onOpenVoiceLogger: () => void;
  onOpenAiAdvisor: () => void;
  onNavigateTab: (tab: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  profile,
  accounts,
  transactions,
  budgets,
  onQuickAdd,
  onOpenReceiptScanner,
  onOpenVoiceLogger,
  onOpenAiAdvisor,
  onNavigateTab,
}) => {
  const prefCurrency = profile.preferredCurrency;
  const rates = getCachedRates().rates;

  // 1. Calculate Net Worth in Preferred Display Currency
  const totalNetWorth = useMemo(() => {
    return accounts.reduce((acc, account) => {
      const converted = convertCurrency(account.balance, account.currency, prefCurrency, rates);
      return acc + converted;
    }, 0);
  }, [accounts, prefCurrency, rates]);

  // 2. Current Month Cashflow in Preferred Display Currency
  const { monthlyIncome, monthlyExpense, netSavings, savingsRate } = useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7); // '2026-11'
    let inc = 0;
    let exp = 0;

    transactions.forEach((tx) => {
      if (tx.date.startsWith(currentMonth)) {
        const converted = convertCurrency(
          tx.amount,
          tx.currency,
          prefCurrency,
          rates,
          tx.exchangeRateAtTransaction
        );
        if (tx.type === 'income') inc += converted;
        else if (tx.type === 'expense') exp += converted;
      }
    });

    const net = inc - exp;
    const rate = inc > 0 ? Math.max(0, Math.round((net / inc) * 100)) : 0;
    return { monthlyIncome: inc, monthlyExpense: exp, netSavings: net, savingsRate: rate };
  }, [transactions, prefCurrency, rates]);

  // 3. Category icon helper
  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'bank': return Building2;
      case 'credit': return CreditCard;
      case 'upi': return Smartphone;
      case 'wallet': return Wallet;
      default: return Banknote;
    }
  };

  // Recent 5 transactions
  const recentTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [transactions]);

  // Budgets alert status
  const budgetAlerts = useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    return budgets.map((bgt) => {
      const spent = transactions
        .filter((t) => t.type === 'expense' && t.category === bgt.category && t.date.startsWith(currentMonth))
        .reduce((sum, t) => sum + convertCurrency(t.amount, t.currency, prefCurrency, rates), 0);

      const limitConverted = convertCurrency(bgt.monthlyLimit, bgt.currency, prefCurrency, rates);
      const percent = limitConverted > 0 ? Math.round((spent / limitConverted) * 100) : 0;
      return {
        ...bgt,
        spentConverted: spent,
        limitConverted,
        percent,
      };
    });
  }, [budgets, transactions, prefCurrency, rates]);

  return (
    <div className="space-y-6 pb-24 md:pb-12 max-w-7xl mx-auto px-4 sm:px-6 pt-6">
      {/* Hero Section: Net Worth + AI Action Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Net Worth Card */}
        <div className="lg:col-span-2 relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1E293B] via-[#0F172A] to-[#1E293B] border border-slate-700/80 p-6 sm:p-8 shadow-xl">
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col justify-between h-full space-y-6">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                    Total Estimated Net Worth
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Live Rates
                  </span>
                </div>
                <button
                  onClick={() => onNavigateTab('settings')}
                  className="text-xs text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition cursor-pointer"
                >
                  <span>Currency: {prefCurrency}</span>
                </button>
              </div>

              <div className="mt-3 flex items-baseline gap-3 flex-wrap">
                <span className="text-3xl sm:text-5xl font-extrabold font-mono-numbers text-white tracking-tight">
                  {formatCurrency(totalNetWorth, prefCurrency)}
                </span>
                <span className="text-xs text-slate-400">
                  Across {accounts.length} linked accounts
                </span>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4 pt-4 border-t border-slate-800">
              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                  <ArrowDownRight className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Income</span>
                </div>
                <div className="text-sm sm:text-base font-bold font-mono-numbers text-emerald-400 truncate">
                  +{formatCurrency(monthlyIncome, prefCurrency)}
                </div>
              </div>

              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                  <ArrowUpRight className="w-3.5 h-3.5 text-rose-400" />
                  <span>Expenses</span>
                </div>
                <div className="text-sm sm:text-base font-bold font-mono-numbers text-rose-400 truncate">
                  -{formatCurrency(monthlyExpense, prefCurrency)}
                </div>
              </div>

              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                  <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Savings</span>
                </div>
                <div className="text-sm sm:text-base font-bold font-mono-numbers text-indigo-300 truncate">
                  {savingsRate}%
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* AI Quick Actions Card */}
        <div className="rounded-2xl bg-[#1E293B] border border-slate-700/80 p-6 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-white text-sm">Smart AI Logging</h3>
              </div>
              <span className="text-[10px] uppercase font-semibold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                Gemini 2.5
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Instantly scan physical receipts or speak your expenses in plain natural English or Hindi.
            </p>
          </div>

          <div className="space-y-2.5">
            {/* Camera / Receipt Scanner Button */}
            <button
              onClick={onOpenReceiptScanner}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 hover:border-emerald-500/50 text-slate-200 transition cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                  <Camera className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-semibold text-white">Scan Receipt Photo</div>
                  <div className="text-[11px] text-slate-400">Auto-extract items & amount</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
            </button>

            {/* Voice Logger Button */}
            <button
              onClick={onOpenVoiceLogger}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 hover:border-indigo-500/50 text-slate-200 transition cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-500/15 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform">
                  <Mic className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-semibold text-white">Voice Expense Logger</div>
                  <div className="text-[11px] text-slate-400">Speak & log in 2 seconds</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
            </button>

            {/* Standard Add Button */}
            <button
              onClick={onQuickAdd}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition cursor-pointer shadow-md shadow-emerald-600/30"
            >
              <Plus className="w-4 h-4" />
              <span>Record Transaction</span>
            </button>
          </div>
        </div>
      </div>

      {/* Multi-Account Carousel / Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-emerald-400" />
            <h2 className="text-base font-bold text-white">Accounts & Wallets</h2>
          </div>
          <span className="text-xs text-slate-400">
            Native Balances Preserved
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {accounts.map((acc) => {
            const Icon = getAccountIcon(acc.type);
            const isDifferentCurrency = acc.currency !== prefCurrency;
            const convertedVal = convertCurrency(acc.balance, acc.currency, prefCurrency, rates);

            return (
              <div
                key={acc.id}
                className="p-4 rounded-xl bg-[#1E293B] border border-slate-700/80 hover:border-slate-600 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
                      style={{ backgroundColor: `${acc.color}25`, color: acc.color }}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded uppercase font-mono tracking-wider bg-slate-800 text-slate-300">
                      {acc.currency}
                    </span>
                  </div>

                  <h3 className="font-semibold text-xs text-white truncate" title={acc.name}>
                    {acc.name}
                  </h3>
                  <div className="text-[11px] text-slate-400 truncate">
                    {acc.accountNumber || acc.type.toUpperCase()}
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-800">
                  <div className="text-sm font-bold font-mono-numbers text-white">
                    {formatCurrency(acc.balance, acc.currency)}
                  </div>

                  {isDifferentCurrency && (
                    <div className="text-[10px] text-slate-400 font-mono-numbers truncate">
                      ≈ {formatCurrency(convertedVal, prefCurrency)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Two Column Section: Recent Transactions & Budget Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions List (2 Cols) */}
        <div className="lg:col-span-2 rounded-2xl bg-[#1E293B] border border-slate-700/80 p-6 shadow-xl">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-bold text-white">Recent Transactions</h2>
              <p className="text-xs text-slate-400">
                Converted to <span className="text-emerald-400 font-semibold">{prefCurrency}</span> for unified viewing
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('transactions')}
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition cursor-pointer"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {recentTransactions.map((tx) => {
              const convertedAmount = convertCurrency(
                tx.amount,
                tx.currency,
                prefCurrency,
                rates,
                tx.exchangeRateAtTransaction
              );
              const isDifferentCurrency = tx.currency !== prefCurrency;
              const isIncome = tx.type === 'income';
              const account = accounts.find((a) => a.id === tx.accountId);

              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isIncome ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                      }`}
                    >
                      {isIncome ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-semibold text-white truncate">
                        {tx.description || tx.category}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                        <span>{tx.date}</span>
                        <span>•</span>
                        <span className="truncate">{account?.name || 'Account'}</span>
                        <span>•</span>
                        <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px]">
                          {tx.paymentMode}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0 pl-3">
                    <div
                      className={`text-sm sm:text-base font-bold font-mono-numbers ${
                        isIncome ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {isIncome ? '+' : '-'}
                      {formatCurrency(convertedAmount, prefCurrency)}
                    </div>

                    {isDifferentCurrency && (
                      <div className="text-[10px] text-slate-400 font-mono-numbers">
                        Orig: {formatCurrency(tx.amount, tx.currency)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Smart Budgets Quick Progress */}
        <div className="rounded-2xl bg-[#1E293B] border border-slate-700/80 p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-white">Active Budgets</h2>
              <button
                onClick={() => onNavigateTab('budgets')}
                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition cursor-pointer"
              >
                Manage
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Real-time category limits with automated velocity alerts.
            </p>

            <div className="space-y-4">
              {budgetAlerts.slice(0, 4).map((b) => {
                let barColor = 'bg-emerald-500';
                if (b.percent >= 100) barColor = 'bg-rose-500';
                else if (b.percent >= 80) barColor = 'bg-amber-500';

                return (
                  <div key={b.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200">{b.category}</span>
                      <span className="font-mono-numbers text-slate-400">
                        {formatCurrency(b.spentConverted, prefCurrency)} / {formatCurrency(b.limitConverted, prefCurrency)}
                      </span>
                    </div>

                    {/* Progress Track */}
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                        style={{ width: `${Math.min(100, b.percent)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px]">
                      <span
                        className={
                          b.percent >= 100
                            ? 'text-rose-400 font-semibold flex items-center gap-1'
                            : b.percent >= 80
                            ? 'text-amber-400 font-semibold flex items-center gap-1'
                            : 'text-slate-400'
                        }
                      >
                        {b.percent >= 80 && <AlertTriangle className="w-3 h-3" />}
                        {b.percent}% Spent
                      </span>
                      <span className="text-slate-400">
                        {b.percent >= 100 ? 'Over Limit!' : `${100 - b.percent}% Remaining`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800">
            <button
              onClick={onOpenAiAdvisor}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 hover:from-emerald-500/20 hover:to-teal-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Get AI Spending Audit</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
