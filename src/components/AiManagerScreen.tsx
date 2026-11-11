/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Crown,
  Sparkles,
  Brain,
  Lock,
  Send,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  PieChart as PieIcon,
  Plus,
  Trash2,
  Edit2,
  ShieldAlert,
  Target,
  ArrowRight,
  Layers,
  Flame,
  Check,
  X,
  RefreshCw,
} from 'lucide-react';
import { Account, Budget, CurrencyCode, Transaction, UserProfile } from '../types/finance';
import { convertCurrency, formatCurrency, getCachedRates } from '../services/currencyService';
import { CloudFirestoreService } from '../services/cloudFirestoreService';
import { StorageService } from '../services/storageService';
import { EntitlementService } from '../services/entitlementService';
import { DynamicIcon } from './IconAndColorPicker';

interface AiManagerScreenProps {
  profile: UserProfile;
  accounts: Account[];
  transactions: Transaction[];
  onOpenUpgrade: () => void;
  onOpenReceiptScanner?: () => void;
}

export const AiManagerScreen: React.FC<AiManagerScreenProps> = ({
  profile,
  accounts,
  transactions,
  onOpenUpgrade,
}) => {
  const prefCurrency = profile.preferredCurrency;
  const rates = getCachedRates().rates;
  const isPro = EntitlementService.isPro(profile);

  // Active view tab: AI Chat, AI SMART ANALYSIS, or Budget Planning
  const [activeTab, setActiveTab] = useState<'chat' | 'smart_analysis' | 'budget'>('chat');
  
  // Selected account for Smart Analysis
  const [analysisAccountId, setAnalysisAccountId] = useState<string>('all');

  // AI Chat state
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([
    {
      role: 'assistant',
      text: 'Namaste! Main aapka AI Money Manager assistant hoon. Aap mujhse kisi bhi account, iss mahine ke kharche, balance ya category ke baare mein Hindi, Hinglish ya English mein pooch sakte hain.',
    },
  ]);
  const [isAnswering, setIsAnswering] = useState(false);

  // Server & local synced daily quota for free tier
  const [questionsLeft, setQuestionsLeft] = useState<number>(() => {
    if (isPro) return 999;
    return profile.dailyAiQuestionsRemaining !== undefined ? profile.dailyAiQuestionsRemaining : 1;
  });

  const [hasReachedLimit, setHasReachedLimit] = useState<boolean>(() => {
    if (isPro) return false;
    return (profile.dailyAiQuestionsRemaining !== undefined ? profile.dailyAiQuestionsRemaining : 1) <= 0;
  });

  // Budgets state
  const [budgets, setBudgets] = useState<Budget[]>(() => {
    const local = StorageService.getBudgets();
    if (local && local.length > 0) return local;
    // Default initial sensible budgets
    return [
      { id: 'bgt-1', category: 'Food & Dining', monthlyLimit: 8000, currency: prefCurrency, alertThreshold: 80 },
      { id: 'bgt-2', category: 'Shopping', monthlyLimit: 5000, currency: prefCurrency, alertThreshold: 80 },
      { id: 'bgt-3', category: 'Utilities', monthlyLimit: 4000, currency: prefCurrency, alertThreshold: 80 },
    ];
  });

  const [isAddBudgetOpen, setIsAddBudgetOpen] = useState(false);
  const [newBgtCategory, setNewBgtCategory] = useState('Groceries');
  const [newBgtLimit, setNewBgtLimit] = useState('');
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);

  // Load budgets from Firestore if user is authenticated
  useEffect(() => {
    const uid = profile.firebaseUid || profile.id;
    if (!uid || uid === 'guest') return;

    CloudFirestoreService.getBudgets(uid).then((cloudBudgets) => {
      if (cloudBudgets && cloudBudgets.length > 0) {
        setBudgets(cloudBudgets);
        StorageService.saveBudgets(cloudBudgets);
      }
    });

    const unsub = CloudFirestoreService.subscribeToBudgets(uid, (cloudBudgets) => {
      if (cloudBudgets && cloudBudgets.length > 0) {
        setBudgets(cloudBudgets);
        StorageService.saveBudgets(cloudBudgets);
      }
    });

    return () => unsub();
  }, [profile.firebaseUid, profile.id]);

  // Fetch live quota status from server
  useEffect(() => {
    if (isPro) {
      setQuestionsLeft(999);
      setHasReachedLimit(false);
      return;
    }

    const userId = profile.firebaseUid || profile.id || 'guest_user';
    fetch(`/api/ai/quota-status?userId=${encodeURIComponent(userId)}&isPro=false`)
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data.questionsRemaining === 'number') {
          setQuestionsLeft(data.questionsRemaining);
          setHasReachedLimit(data.questionsRemaining <= 0);
        }
      })
      .catch(() => {});
  }, [isPro, profile.firebaseUid, profile.id]);

  // Handle Budget Save
  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    const limit = parseFloat(newBgtLimit);
    if (!limit || limit <= 0) return;

    const uid = profile.firebaseUid || profile.id;
    let updated: Budget[];

    if (editingBudgetId) {
      updated = budgets.map((b) =>
        b.id === editingBudgetId ? { ...b, category: newBgtCategory.trim(), monthlyLimit: limit } : b
      );
    } else {
      const newBudget: Budget = {
        id: `bgt-${Date.now()}`,
        category: newBgtCategory.trim(),
        monthlyLimit: limit,
        currency: prefCurrency,
        alertThreshold: 80,
      };
      updated = [...budgets, newBudget];
    }

    setBudgets(updated);
    StorageService.saveBudgets(updated);

    if (uid && uid !== 'guest') {
      const target = updated.find((b) => (editingBudgetId ? b.id === editingBudgetId : b.category === newBgtCategory.trim()));
      if (target) {
        await CloudFirestoreService.saveBudget(uid, target);
      }
    }

    setIsAddBudgetOpen(false);
    setEditingBudgetId(null);
    setNewBgtLimit('');
  };

  // Handle Budget Delete
  const handleDeleteBudget = async (id: string) => {
    const updated = budgets.filter((b) => b.id !== id);
    setBudgets(updated);
    StorageService.saveBudgets(updated);

    const uid = profile.firebaseUid || profile.id;
    if (uid && uid !== 'guest') {
      await CloudFirestoreService.deleteBudget(uid, id);
    }
  };

  // Budget Spending Calculations (Current Month)
  const currentMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const now = new Date();
  const currentDay = Math.max(1, now.getDate());
  const totalDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const budgetCalculations = useMemo(() => {
    return budgets.map((b) => {
      const spent = transactions
        .filter((t) => t.type === 'expense' && t.category.toLowerCase() === b.category.toLowerCase() && t.date.startsWith(currentMonth))
        .reduce((sum, t) => sum + convertCurrency(t.amount, t.currency, prefCurrency, rates), 0);

      const limitConverted = convertCurrency(b.monthlyLimit, b.currency, prefCurrency, rates);
      const remaining = Math.max(0, limitConverted - spent);
      const percent = limitConverted > 0 ? (spent / limitConverted) * 100 : 0;
      const projectedSpend = (spent / currentDay) * totalDaysInMonth;
      const projectedPercent = limitConverted > 0 ? (projectedSpend / limitConverted) * 100 : 0;

      return {
        ...b,
        spent,
        limitConverted,
        remaining,
        percent: Math.round(percent),
        projectedSpend,
        projectedPercent: Math.round(projectedPercent),
        isOverbudget: spent > limitConverted,
        isWarning: percent >= b.alertThreshold && spent <= limitConverted,
      };
    });
  }, [budgets, transactions, currentMonth, prefCurrency, rates, currentDay, totalDaysInMonth]);

  // Deep AI Smart Analysis Metrics for Selected Account
  const smartAnalysis = useMemo(() => {
    const targetAccount = accounts.find((a) => a.id === analysisAccountId);
    
    // Filter transactions for chosen account
    const accountTxs = transactions.filter((tx) => {
      if (analysisAccountId === 'all') return true;
      return tx.accountId === analysisAccountId || (tx.type === 'transfer' && tx.toAccountId === analysisAccountId);
    });

    const monthTxs = accountTxs.filter((tx) => tx.date.startsWith(currentMonth));

    let totalBal = 0;
    if (analysisAccountId === 'all') {
      totalBal = accounts.reduce((sum, a) => sum + convertCurrency(a.balance, a.currency, prefCurrency, rates), 0);
    } else if (targetAccount) {
      totalBal = convertCurrency(targetAccount.balance, targetAccount.currency, prefCurrency, rates);
    }

    let monthIncome = 0;
    let monthExpense = 0;
    let monthTransferIn = 0;
    let monthTransferOut = 0;
    const catSpends: Record<string, number> = {};
    const merchantSpends: Record<string, { count: number; total: number }> = {};

    monthTxs.forEach((tx) => {
      const amt = convertCurrency(tx.amount, tx.currency, prefCurrency, rates);
      if (tx.type === 'income') {
        if (analysisAccountId === 'all' || tx.accountId === analysisAccountId) {
          monthIncome += amt;
        }
      } else if (tx.type === 'expense') {
        if (analysisAccountId === 'all' || tx.accountId === analysisAccountId) {
          monthExpense += amt;
          catSpends[tx.category] = (catSpends[tx.category] || 0) + amt;

          const desc = tx.description ? tx.description.toLowerCase().trim() : tx.category.toLowerCase();
          if (!merchantSpends[desc]) merchantSpends[desc] = { count: 0, total: 0 };
          merchantSpends[desc].count += 1;
          merchantSpends[desc].total += amt;
        }
      } else if (tx.type === 'transfer') {
        if (tx.toAccountId === analysisAccountId) monthTransferIn += amt;
        if (tx.accountId === analysisAccountId) monthTransferOut += amt;
      }
    });

    // Daily average burn
    const dailyBurn = monthExpense / currentDay;
    const projectedMonthExpense = dailyBurn * totalDaysInMonth;

    // Runway (days balance will last at current daily burn)
    const runwayDays = dailyBurn > 0 ? Math.round(totalBal / dailyBurn) : 999;

    // Discretionary / Potentially Unnecessary Spends
    const discretionaryCategories = ['entertainment', 'shopping', 'dining', 'food & dining', 'leisure', 'games', 'subscriptions'];
    let discretionaryTotal = 0;
    Object.entries(catSpends).forEach(([cat, val]) => {
      if (discretionaryCategories.some((d) => cat.toLowerCase().includes(d))) {
        discretionaryTotal += val;
      }
    });

    // Frequent small repetitive expenses
    const recurringMicroSpends = Object.entries(merchantSpends)
      .filter(([_, data]) => data.count >= 2 && data.total < 3000)
      .map(([name, data]) => ({ name, ...data }));

    // Financial Risks
    const risks: { title: string; desc: string; severity: 'high' | 'medium' | 'low' }[] = [];
    if (monthExpense > monthIncome && monthIncome > 0) {
      risks.push({
        title: 'Deficit Cash Flow Warning',
        desc: `Expenses (${formatCurrency(monthExpense, prefCurrency)}) exceed Income (${formatCurrency(monthIncome, prefCurrency)}) by ${formatCurrency(monthExpense - monthIncome, prefCurrency)}.`,
        severity: 'high',
      });
    }
    if (runwayDays < 30 && dailyBurn > 0) {
      risks.push({
        title: 'Low Liquidity Runway',
        desc: `At current burn of ${formatCurrency(dailyBurn, prefCurrency)}/day, this account balance has only ~${runwayDays} days of buffer.`,
        severity: 'high',
      });
    }
    if (discretionaryTotal > monthExpense * 0.4 && monthExpense > 0) {
      risks.push({
        title: 'High Discretionary Spending',
        desc: `Discretionary purchases account for ${( (discretionaryTotal / monthExpense) * 100 ).toFixed(0)}% of total monthly outflows.`,
        severity: 'medium',
      });
    }

    // Savings Recommendations
    const recommendations: string[] = [];
    if (discretionaryTotal > 0) {
      recommendations.push(
        `Cap discretionary spending (Dining & Shopping) to save up to ${formatCurrency(discretionaryTotal * 0.25, prefCurrency)} this month.`
      );
    }
    if (recurringMicroSpends.length > 0) {
      recommendations.push(
        `Identified ${recurringMicroSpends.length} frequent micro-transactions. Consolidating small daily spends could save ~${formatCurrency(1500, prefCurrency)}/month.`
      );
    }
    if (totalBal > 25000 && monthIncome > monthExpense) {
      recommendations.push(
        `Healthy surplus detected: Allocate at least ${formatCurrency((monthIncome - monthExpense) * 0.4, prefCurrency)} to an emergency fund or liquid investment goal.`
      );
    } else {
      recommendations.push(
        `Target building a minimum 3-month emergency safety net of ${formatCurrency(monthExpense * 3 || 15000, prefCurrency)}.`
      );
    }

    // Monthly Improvement Plan
    const improvementPlan = [
      {
        step: 1,
        title: 'Expense Ceiling',
        target: `Limit daily average burn to ${formatCurrency(dailyBurn > 0 ? dailyBurn * 0.85 : 500, prefCurrency)}/day`,
      },
      {
        step: 2,
        title: 'Buffer Target',
        target: `Retain a minimum balance threshold of ${formatCurrency(totalBal * 0.5 || 5000, prefCurrency)}`,
      },
      {
        step: 3,
        title: 'Surplus Reinvestment',
        target: `Automate 15% transfer on salary/income credit day into high-interest savings`,
      },
    ];

    return {
      targetAccount,
      totalBal,
      monthIncome,
      monthExpense,
      monthTransferIn,
      monthTransferOut,
      dailyBurn,
      projectedMonthExpense,
      runwayDays,
      discretionaryTotal,
      recurringMicroSpends,
      risks,
      recommendations,
      improvementPlan,
    };
  }, [accounts, analysisAccountId, transactions, currentMonth, prefCurrency, rates, currentDay, totalDaysInMonth]);

  // Handle Ask AI Question
  const handleAskQuestion = async (queryText?: string) => {
    const text = queryText || chatInput;
    if (!text.trim()) return;

    if (!isPro && questionsLeft <= 0) {
      setHasReachedLimit(true);
      return;
    }

    const userMessage = { role: 'user' as const, text };
    setMessages((prev) => [...prev, userMessage]);
    setChatInput('');
    setIsAnswering(true);

    const userId = profile.firebaseUid || profile.id || 'guest_user';

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          message: text,
          isPro,
          preferredCurrency: prefCurrency,
          accountsSummary: accounts.map((a) => ({ name: a.name, balance: a.balance, currency: a.currency })),
          transactionsSummary: transactions.slice(0, 50).map((t) => ({
            desc: t.description,
            amount: t.amount,
            type: t.type,
            cat: t.category,
            date: t.date,
            currency: t.currency,
          })),
        }),
      });

      const data = await res.json();

      if (res.status === 429 || data.limitReached) {
        setQuestionsLeft(0);
        setHasReachedLimit(true);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: 'You have used your free AI question for today. Upgrade to Premium to enjoy unlimited AI chat and advanced financial intelligence.',
          },
        ]);
        return;
      }

      if (data.reply) {
        setMessages((prev) => [...prev, { role: 'assistant', text: data.reply }]);
        if (!isPro && typeof data.questionsRemaining === 'number') {
          setQuestionsLeft(data.questionsRemaining);
          if (data.questionsRemaining <= 0) setHasReachedLimit(true);
        }
        if (profile.firebaseUid) {
          await CloudFirestoreService.recordAiQuestionUsed(profile.firebaseUid);
        }
      } else {
        throw new Error('No reply from server');
      }
    } catch {
      // Deterministic calculation strictly from real ledger
      let totalBal = accounts.reduce((sum, a) => sum + a.balance, 0);
      let monthExpense = 0;
      let monthIncome = 0;
      const catMap: Record<string, number> = {};

      transactions.forEach((tx) => {
        if (tx.date.startsWith(currentMonth)) {
          if (tx.type === 'expense') {
            monthExpense += tx.amount;
            catMap[tx.category] = (catMap[tx.category] || 0) + tx.amount;
          } else if (tx.type === 'income') {
            monthIncome += tx.amount;
          }
        }
      });

      const highestCat = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0];
      const qLower = text.toLowerCase();
      let answer = '';

      if (qLower.includes('kharcha') || qLower.includes('expense') || qLower.includes('spent')) {
        answer = `Iss mahine aapka total kharcha ${formatCurrency(monthExpense, prefCurrency)} hua hai.`;
        if (highestCat) {
          answer += ` Sabse zyada kharcha ${highestCat[0]} category mein ${formatCurrency(highestCat[1], prefCurrency)} hua hai.`;
        }
      } else if (qLower.includes('balance') || qLower.includes('available')) {
        answer = `Aapke sabhi active accounts ka total consolidated balance ${formatCurrency(totalBal, prefCurrency)} hai (${accounts.length} active accounts).`;
      } else if (qLower.includes('income') || qLower.includes('salary') || qLower.includes('kamayi')) {
        answer = `Iss mahine aapki total income ${formatCurrency(monthIncome, prefCurrency)} hai.`;
      } else {
        answer = `Aapke ledger ke hisaab se: Total Balance: ${formatCurrency(totalBal, prefCurrency)}, Iss mahine ka kharcha: ${formatCurrency(monthExpense, prefCurrency)}, Income: ${formatCurrency(monthIncome, prefCurrency)}.`;
      }

      setMessages((prev) => [...prev, { role: 'assistant', text: answer }]);
      if (!isPro) {
        setQuestionsLeft(0);
        setHasReachedLimit(true);
      }
    } finally {
      setIsAnswering(false);
    }
  };

  return (
    <div className="max-w-md md:max-w-5xl mx-auto px-4 py-4 pb-28 space-y-4">
      {/* 1. Header Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#0B1528] dark:bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-xs">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-[#0B1528] dark:text-white tracking-tight">
              AI Money Manager Intelligence
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Personalized Financial Intelligence Assistant · Real Ledger Synced
            </p>
          </div>
        </div>

        {/* 2. Navigation Tabs: AI Chat, AI SMART ANALYSIS, Budget Planning */}
        <div className="bg-[#EEF2F6] dark:bg-slate-800 p-1 rounded-2xl flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 shadow-2xs gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`flex-1 py-2 px-2 text-center rounded-xl transition cursor-pointer ${
              activeTab === 'chat'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                : 'hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            AI Chat
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('smart_analysis')}
            className={`flex-1 py-2 px-2 text-center rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'smart_analysis'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs font-bold'
                : 'hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            <span className="truncate">AI SMART ANALYSIS</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('budget')}
            className={`flex-1 py-2 px-2 text-center rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'budget'
                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs font-bold'
                : 'hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Target className="w-3.5 h-3.5 text-emerald-500" />
            <span className="truncate">Budget Planning</span>
          </button>
        </div>
      </div>

      {/* 3. TAB 1: AI SMART ANALYSIS (Replaced Smart Entry & OCR) */}
      {activeTab === 'smart_analysis' && (
        <div className="space-y-4">
          {/* Account Selector for Deep Analysis */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-[#0B1528] dark:text-white">
                Select Account for Deep AI Analysis
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {smartAnalysis.targetAccount ? smartAnalysis.targetAccount.name : 'Consolidated Portfolio'}
              </span>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              <button
                type="button"
                onClick={() => setAnalysisAccountId('all')}
                className={`flex-shrink-0 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  analysisAccountId === 'all'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 ring-2 ring-blue-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span>All Accounts Combined</span>
              </button>

              {accounts.map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => setAnalysisAccountId(acc.id)}
                  className={`flex-shrink-0 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                    analysisAccountId === acc.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 ring-2 ring-blue-500/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div
                    className="w-4 h-4 rounded-md flex items-center justify-center text-white text-[9px]"
                    style={{ backgroundColor: acc.color || '#3B82F6' }}
                  >
                    <DynamicIcon name={acc.icon || 'Landmark'} className="w-2.5 h-2.5" />
                  </div>
                  <span>{acc.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Core Diagnostic Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Liquid Balance</span>
              <span className="text-lg font-extrabold font-mono-numbers text-blue-600 dark:text-blue-400 mt-0.5 block">
                {formatCurrency(smartAnalysis.totalBal, prefCurrency)}
              </span>
              <span className="text-[10px] text-slate-400 mt-1 block">Live Firestore Balance</span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Daily Burn Velocity</span>
              <span className="text-lg font-extrabold font-mono-numbers text-rose-600 dark:text-rose-400 mt-0.5 block">
                {formatCurrency(smartAnalysis.dailyBurn, prefCurrency)}
              </span>
              <span className="text-[10px] text-slate-400 mt-1 block">Per day outflow</span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Cash Flow Runway</span>
              <span className="text-lg font-extrabold font-mono-numbers text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                ~{smartAnalysis.runwayDays > 365 ? '365+' : smartAnalysis.runwayDays} Days
              </span>
              <span className="text-[10px] text-slate-400 mt-1 block">At current burn rate</span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Discretionary Spend</span>
              <span className="text-lg font-extrabold font-mono-numbers text-amber-600 dark:text-amber-400 mt-0.5 block">
                {formatCurrency(smartAnalysis.discretionaryTotal, prefCurrency)}
              </span>
              <span className="text-[10px] text-slate-400 mt-1 block">Dining, Shopping, Leisure</span>
            </div>
          </div>

          {/* Financial Risk Assessment Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-500" />
              <h4 className="text-sm font-extrabold text-[#0B1528] dark:text-white">
                Account Financial Risk & Health Flags
              </h4>
            </div>

            {smartAnalysis.risks.length === 0 ? (
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Optimal financial health! No unusual expense spikes or runway deficits detected.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {smartAnalysis.risks.map((risk, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 flex items-start gap-2.5"
                  >
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <div className="font-extrabold text-rose-900 dark:text-rose-200">{risk.title}</div>
                      <div className="text-rose-700 dark:text-rose-300 mt-0.5">{risk.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI Personalized Savings Recommendations */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h4 className="text-sm font-extrabold text-[#0B1528] dark:text-white">
                AI Deep Savings Intelligence
              </h4>
            </div>

            <div className="space-y-2">
              {smartAnalysis.recommendations.map((rec, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 text-xs text-blue-950 dark:text-blue-200 flex items-start gap-2"
                >
                  <ArrowRight className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Actionable Monthly Financial Improvement Plan */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-indigo-500" />
              <h4 className="text-sm font-extrabold text-[#0B1528] dark:text-white">
                Actionable Monthly Financial Improvement Roadmap
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {smartAnalysis.improvementPlan.map((step) => (
                <div
                  key={step.step}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-1"
                >
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                    <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">
                      {step.step}
                    </span>
                    <span>{step.title}</span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                    {step.target}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. TAB 2: BUDGET PLANNING (Completely Functional CRUD, Alerts & Tracking) */}
      {activeTab === 'budget' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-[#0B1528] dark:text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-600" />
                <span>Monthly Budget Management</span>
              </h3>
              <p className="text-xs text-slate-400">
                Track real spending caps & get overspending alerts for {new Date().toLocaleString('default', { month: 'long' })}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setEditingBudgetId(null);
                setNewBgtCategory('Food & Dining');
                setNewBgtLimit('10000');
                setIsAddBudgetOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Budget</span>
            </button>
          </div>

          {/* Budget Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {budgetCalculations.map((b) => (
              <div
                key={b.id}
                className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3.5"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-extrabold text-[#0B1528] dark:text-white">{b.category}</h4>
                    <span className="text-[10px] text-slate-400">Monthly Spending Cap</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingBudgetId(b.id);
                        setNewBgtCategory(b.category);
                        setNewBgtLimit(String(b.monthlyLimit));
                        setIsAddBudgetOpen(true);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteBudget(b.id)}
                      className="p-1.5 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Amounts & Status */}
                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-extrabold font-mono-numbers text-slate-900 dark:text-white text-base">
                    {formatCurrency(b.spent, prefCurrency)}
                  </span>
                  <span className="text-slate-400 font-mono-numbers">
                    Limit: {formatCurrency(b.limitConverted, prefCurrency)}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      b.isOverbudget
                        ? 'bg-rose-600'
                        : b.isWarning
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, b.percent)}%` }}
                  />
                </div>

                {/* Status Callout & Velocity */}
                <div className="flex items-center justify-between text-[11px]">
                  <span
                    className={`font-bold flex items-center gap-1 ${
                      b.isOverbudget
                        ? 'text-rose-600 dark:text-rose-400'
                        : b.isWarning
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {b.isOverbudget ? (
                      <>
                        <AlertTriangle className="w-3 h-3" /> Over budget by {formatCurrency(b.spent - b.limitConverted, prefCurrency)}
                      </>
                    ) : (
                      <>
                        <Check className="w-3 h-3" /> {formatCurrency(b.remaining, prefCurrency)} remaining ({b.percent}% spent)
                      </>
                    )}
                  </span>

                  <span className="text-[10px] text-slate-400 font-mono">
                    Projected: ~{b.projectedPercent}% of cap
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Add / Edit Budget Modal */}
          {isAddBudgetOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-2xs animate-in fade-in">
              <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h4 className="text-sm font-extrabold text-[#0B1528] dark:text-white">
                    {editingBudgetId ? 'Edit Category Budget' : 'Create Monthly Budget'}
                  </h4>
                  <button
                    type="button"
                    onClick={() => setIsAddBudgetOpen(false)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveBudget} className="space-y-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Category Name
                    </label>
                    <input
                      type="text"
                      required
                      value={newBgtCategory}
                      onChange={(e) => setNewBgtCategory(e.target.value)}
                      placeholder="e.g. Food & Dining, Travel, Shopping"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Monthly Spending Limit ({prefCurrency})
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={newBgtLimit}
                      onChange={(e) => setNewBgtLimit(e.target.value)}
                      placeholder="5000"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-base font-extrabold font-mono text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setIsAddBudgetOpen(false)}
                      className="px-4 py-2 text-xs font-bold text-slate-500"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl bg-[#0B1528] dark:bg-blue-600 text-white font-bold text-xs shadow-md"
                    >
                      Save Budget
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. TAB 3: AI CHAT (Direct Assistant) */}
      {activeTab === 'chat' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
            Ask in Hindi, Hinglish, or English using your real Cloud Firestore ledger:
          </p>

          {/* Example Question Chips */}
          <div className="flex flex-wrap gap-2">
            {[
              'Is month kitna kharcha hua?',
              'Total available balance',
              'Which category has highest spending?',
              'YJTR account status',
            ].map((q, idx) => (
              <button
                key={idx}
                type="button"
                disabled={!isPro && questionsLeft <= 0}
                onClick={() => handleAskQuestion(q)}
                className="py-1.5 px-3 rounded-xl bg-[#EEF2F6] dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer shadow-2xs text-left disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Conversation Stream */}
          <div className="space-y-3 pt-2 max-h-80 overflow-y-auto">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 font-bold ml-6 border border-blue-100 dark:border-blue-900/50'
                    : 'bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 font-medium mr-6 border border-slate-200/80 dark:border-slate-700'
                }`}
              >
                {m.text}
              </div>
            ))}
            {isAnswering && (
              <div className="p-3 text-xs text-slate-400 italic">
                Computing deterministic response from ledger...
              </div>
            )}
          </div>

          {/* Quota limit callout */}
          {!isPro && hasReachedLimit && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 space-y-2 text-center">
              <p className="text-xs font-bold text-amber-900 dark:text-amber-200 leading-relaxed">
                You have used your free AI question for today. Upgrade to Premium for unlimited queries.
              </p>
              <button
                type="button"
                onClick={onOpenUpgrade}
                className="py-2 px-4 rounded-xl bg-[#0B1528] dark:bg-blue-600 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-xs hover:bg-[#111e38] transition cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Upgrade to Premium</span>
              </button>
            </div>
          )}

          {/* Chat Input Field */}
          <div className="relative pt-2">
            <input
              type="text"
              disabled={!isPro && hasReachedLimit}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion()}
              placeholder={
                !isPro && hasReachedLimit
                  ? 'Daily free question used. Upgrade to Pro for unlimited.'
                  : 'Ask anything about your income, expenses, accounts...'
              }
              className="w-full pl-4 pr-12 py-3 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-2xs disabled:bg-slate-100 dark:disabled:bg-slate-800"
            />
            <button
              type="button"
              disabled={!isPro && hasReachedLimit}
              onClick={() => handleAskQuestion()}
              className="absolute right-2 top-1/2 -translate-y-1/2 mt-1 w-8 h-8 rounded-xl bg-[#0B1528] dark:bg-blue-600 text-white flex items-center justify-center transition cursor-pointer disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
