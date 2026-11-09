/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Target,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  PiggyBank,
  Clock,
  Sparkles,
  TrendingUp,
  X,
  CreditCard,
  Building,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  Account,
  Budget,
  CurrencyCode,
  RecurringBill,
  SavingsGoal,
  Transaction,
  UserProfile,
} from '../types/finance';
import {
  convertCurrency,
  formatCurrency,
  getCachedRates,
} from '../services/currencyService';

interface BudgetsGoalsProps {
  profile: UserProfile;
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: SavingsGoal[];
  recurring: RecurringBill[];
  onAddBudget: (b: Omit<Budget, 'id'>) => void;
  onAddGoal: (g: Omit<SavingsGoal, 'id'>) => void;
  onDepositGoal: (goalId: string, amount: number, accountId?: string) => void;
}

export const BudgetsGoals: React.FC<BudgetsGoalsProps> = ({
  profile,
  accounts,
  transactions,
  budgets,
  goals,
  recurring,
  onAddBudget,
  onAddGoal,
  onDepositGoal,
}) => {
  const prefCurrency = profile.preferredCurrency;
  const rates = getCachedRates().rates;
  const [activeTab, setActiveTab] = useState<'budgets' | 'goals' | 'recurring'>('budgets');

  // Budget Modal
  const [isAddBudgetOpen, setIsAddBudgetOpen] = useState(false);
  const [newBgtCategory, setNewBgtCategory] = useState('Entertainment');
  const [newBgtLimit, setNewBgtLimit] = useState('');
  const [newBgtCurrency, setNewBgtCurrency] = useState<CurrencyCode>(prefCurrency);

  // Goal Modal
  const [isAddGoalOpen, setIsAddGoalOpen] = useState(false);
  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [newGoalDate, setNewGoalDate] = useState('2027-06-30');
  const [newGoalCurrency, setNewGoalCurrency] = useState<CurrencyCode>(prefCurrency);

  // Deposit Modal
  const [depositGoalId, setDepositGoalId] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositAccountId, setDepositAccountId] = useState(accounts[0]?.id || '');

  // Calculate days in month and current day for velocity projection
  const { currentDay, totalDaysInMonth } = useMemo(() => {
    const now = new Date();
    const day = now.getDate();
    const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return { currentDay: Math.max(1, day), totalDaysInMonth: totalDays };
  }, []);

  // Budget calculations with velocity projection
  const budgetCalculations = useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);

    return budgets.map((b) => {
      const spent = transactions
        .filter((t) => t.type === 'expense' && t.category === b.category && t.date.startsWith(currentMonth))
        .reduce((sum, t) => sum + convertCurrency(t.amount, t.currency, prefCurrency, rates), 0);

      const limitConverted = convertCurrency(b.monthlyLimit, b.currency, prefCurrency, rates);
      const percent = limitConverted > 0 ? (spent / limitConverted) * 100 : 0;

      // Velocity projection: (spent / currentDay) * totalDaysInMonth
      const projectedSpend = (spent / currentDay) * totalDaysInMonth;
      const projectedPercent = limitConverted > 0 ? Math.round((projectedSpend / limitConverted) * 100) : 0;

      return {
        ...b,
        spentConverted: spent,
        limitConverted,
        percent: Math.round(percent),
        projectedSpend,
        projectedPercent,
      };
    });
  }, [budgets, transactions, prefCurrency, rates, currentDay, totalDaysInMonth]);

  const handleCreateBudget = (e: React.FormEvent) => {
    e.preventDefault();
    const limit = parseFloat(newBgtLimit);
    if (!limit || limit <= 0) return;

    onAddBudget({
      category: newBgtCategory,
      monthlyLimit: limit,
      currency: newBgtCurrency,
      alertThreshold: 80,
    });
    setNewBgtLimit('');
    setIsAddBudgetOpen(false);
  };

  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseFloat(newGoalTarget);
    if (!target || target <= 0 || !newGoalName.trim()) return;

    onAddGoal({
      name: newGoalName.trim(),
      targetAmount: target,
      currentAmount: 0,
      currency: newGoalCurrency,
      targetDate: newGoalDate,
      color: '#10b981',
    });
    setNewGoalName('');
    setNewGoalTarget('');
    setIsAddGoalOpen(false);
  };

  const handleExecuteDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!depositGoalId) return;
    const amt = parseFloat(depositAmount);
    if (!amt || amt <= 0) return;

    onDepositGoal(depositGoalId, amt, depositAccountId);
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
    setDepositGoalId(null);
    setDepositAmount('');
  };

  return (
    <div className="space-y-6 pb-24 md:pb-12 max-w-7xl mx-auto px-4 sm:px-6 pt-6">
      {/* Top Header & Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white">Smart Budgets & Wealth Goals</h1>
          <p className="text-xs text-slate-400">
            Automated spending velocity projections & savings tracker in{' '}
            <span className="text-emerald-400 font-semibold">{prefCurrency}</span>
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1 bg-[#1E293B] p-1 rounded-xl border border-slate-700/80">
          <button
            onClick={() => setActiveTab('budgets')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'budgets' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Category Budgets
          </button>
          <button
            onClick={() => setActiveTab('goals')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'goals' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Savings Goals
          </button>
          <button
            onClick={() => setActiveTab('recurring')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'recurring' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Recurring Bills
          </button>
        </div>
      </div>

      {/* 1. Category Budgets Tab */}
      {activeTab === 'budgets' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Day {currentDay} of {totalDaysInMonth} in current billing cycle
            </span>
            <button
              onClick={() => {
                setNewBgtCurrency(prefCurrency);
                setIsAddBudgetOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition cursor-pointer shadow-md shadow-emerald-600/30"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Set Budget</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {budgetCalculations.map((bgt) => {
              let barColor = 'bg-emerald-500';
              let badgeColor = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';

              if (bgt.percent >= 100) {
                barColor = 'bg-rose-500';
                badgeColor = 'bg-rose-500/15 text-rose-400 border-rose-500/30';
              } else if (bgt.percent >= 80) {
                barColor = 'bg-amber-500';
                badgeColor = 'bg-amber-500/15 text-amber-400 border-amber-500/30';
              }

              return (
                <div
                  key={bgt.id}
                  className="p-5 rounded-2xl bg-[#1E293B] border border-slate-700/80 shadow-lg space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-white">{bgt.category}</h3>
                      <span className="text-[11px] text-slate-400">Monthly Spending Limit</span>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeColor}`}>
                      {bgt.percent}% Spent
                    </span>
                  </div>

                  {/* Amounts */}
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-bold font-mono-numbers text-white text-base">
                      {formatCurrency(bgt.spentConverted, prefCurrency)}
                    </span>
                    <span className="text-slate-400 font-mono-numbers">
                      of {formatCurrency(bgt.limitConverted, prefCurrency)}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2.5 rounded-full bg-slate-900 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                      style={{ width: `${Math.min(100, bgt.percent)}%` }}
                    />
                  </div>

                  {/* Velocity Projection Box */}
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-indigo-400" />
                      <div>
                        <div className="text-slate-300 font-medium">Spending Velocity</div>
                        <div className="text-[10px] text-slate-400">
                          Projected month-end:{' '}
                          <span className="font-bold font-mono-numbers text-slate-200">
                            {formatCurrency(bgt.projectedSpend, prefCurrency, { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <span
                      className={`text-[11px] font-bold font-mono-numbers ${
                        bgt.projectedPercent > 100 ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      ~{bgt.projectedPercent}% of cap
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Savings Goals Tab */}
      {activeTab === 'goals' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Track target deadlines and log one-tap deposits</span>
            <button
              onClick={() => {
                setNewGoalCurrency(prefCurrency);
                setIsAddGoalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition cursor-pointer shadow-md shadow-emerald-600/30"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Goal</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {goals.map((g) => {
              const currentConverted = convertCurrency(g.currentAmount, g.currency, prefCurrency, rates);
              const targetConverted = convertCurrency(g.targetAmount, g.currency, prefCurrency, rates);
              const progress = targetConverted > 0 ? Math.min(100, Math.round((currentConverted / targetConverted) * 100)) : 0;
              const isCompleted = progress >= 100;

              return (
                <div
                  key={g.id}
                  className="p-5 rounded-2xl bg-[#1E293B] border border-slate-700/80 shadow-lg flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-400">
                        <PiggyBank className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-semibold text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                        Target: {g.targetDate}
                      </span>
                    </div>

                    <h3 className="font-bold text-sm text-white truncate">{g.name}</h3>

                    <div className="mt-3 flex items-baseline justify-between text-xs">
                      <span className="text-lg font-extrabold font-mono-numbers text-emerald-400">
                        {formatCurrency(currentConverted, prefCurrency)}
                      </span>
                      <span className="text-slate-400 font-mono-numbers">
                        / {formatCurrency(targetConverted, prefCurrency)}
                      </span>
                    </div>

                    <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden mt-2">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="text-right text-[10px] text-slate-400 mt-1">{progress}% Saved</div>
                  </div>

                  <div className="pt-3 border-t border-slate-800">
                    <button
                      onClick={() => {
                        setDepositGoalId(g.id);
                        setDepositAmount('');
                      }}
                      className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 font-semibold text-xs transition cursor-pointer border border-slate-700 flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Deposit Funds</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Recurring Bills Tab */}
      {activeTab === 'recurring' && (
        <div className="rounded-2xl bg-[#1E293B] border border-slate-700/80 p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white text-base">Recurring Subscriptions & Fixed Bills</h3>
            <span className="text-xs text-slate-400">{recurring.length} automated subscriptions</span>
          </div>

          <div className="divide-y divide-slate-800">
            {recurring.map((bill) => {
              const converted = convertCurrency(bill.amount, bill.currency, prefCurrency, rates);
              const isDifferent = bill.currency !== prefCurrency;
              const account = accounts.find((a) => a.id === bill.accountId);

              return (
                <div key={bill.id} className="py-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/15 flex items-center justify-center text-indigo-400">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm font-bold text-white">{bill.title}</div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <span className="capitalize">{bill.frequency}</span>
                        <span>•</span>
                        <span>Due: {bill.nextDueDate}</span>
                        <span>•</span>
                        <span>{account?.name || 'Account'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-bold font-mono-numbers text-white">
                      {formatCurrency(converted, prefCurrency)}
                    </div>
                    {isDifferent && (
                      <div className="text-[10px] text-slate-400 font-mono-numbers">
                        Orig: {formatCurrency(bill.amount, bill.currency)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Budget Modal */}
      {isAddBudgetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#1E293B] border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white text-base">Set Monthly Category Budget</h3>
              <button onClick={() => setIsAddBudgetOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBudget} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Category</label>
                <input
                  type="text"
                  required
                  value={newBgtCategory}
                  onChange={(e) => setNewBgtCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Monthly Limit ({newBgtCurrency})</label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="5000"
                  value={newBgtLimit}
                  onChange={(e) => setNewBgtLimit(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-lg font-mono-numbers font-bold text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddBudgetOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs"
                >
                  Save Budget
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Goal Modal */}
      {isAddGoalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#1E293B] border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white text-base">Create New Savings Target</h3>
              <button onClick={() => setIsAddGoalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGoal} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Goal Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. New Electric Car, Bali Vacation"
                  value={newGoalName}
                  onChange={(e) => setNewGoalName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Target Amount ({newGoalCurrency})</label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="100000"
                  value={newGoalTarget}
                  onChange={(e) => setNewGoalTarget(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-lg font-mono-numbers font-bold text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Target Date</label>
                <input
                  type="date"
                  required
                  value={newGoalDate}
                  onChange={(e) => setNewGoalDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddGoalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs"
                >
                  Create Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deposit to Goal Modal */}
      {depositGoalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#1E293B] border border-slate-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white text-base">Deposit to Savings Goal</h3>
              <button onClick={() => setDepositGoalId(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteDeposit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Deposit Amount ({prefCurrency})</label>
                <input
                  type="number"
                  step="any"
                  required
                  autoFocus
                  placeholder="5000"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xl font-mono-numbers font-bold text-emerald-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Fund From Account</label>
                <select
                  value={depositAccountId}
                  onChange={(e) => setDepositAccountId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.currency})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDepositGoalId(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs"
                >
                  Confirm Deposit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
