/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
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
  Zap,
  Activity,
  ShieldCheck,
  Clock,
  Wallet,
  Coins,
} from 'lucide-react';
import { Account, Budget, CurrencyCode, Transaction, UserProfile } from '../types/finance';
import { convertCurrency, formatCurrency, getCachedRates } from '../services/currencyService';
import { CloudFirestoreService } from '../services/cloudFirestoreService';
import { StorageService } from '../services/storageService';
import { DynamicIcon } from './IconAndColorPicker';

interface AiManagerScreenProps {
  profile: UserProfile;
  accounts: Account[];
  transactions: Transaction[];
  onOpenUpgrade?: () => void;
  onOpenReceiptScanner?: () => void;
}

export const AiManagerScreen: React.FC<AiManagerScreenProps> = ({
  profile,
  accounts,
  transactions,
}) => {
  const prefCurrency = profile.preferredCurrency;
  const rates = getCachedRates().rates;
  const userId = profile.firebaseUid || profile.id || 'guest_user';

  // Active view tab: AI Chat, AI SMART ANALYSIS, or Budget Planning
  const [activeTab, setActiveTab] = useState<'chat' | 'smart_analysis' | 'budget'>('chat');

  // Selected account for Smart Analysis
  const [analysisAccountId, setAnalysisAccountId] = useState<string>('all');

  // Strict 1 Daily AI Query limit tracking per user per day
  const [questionsLeft, setQuestionsLeft] = useState<number>(() => {
    const localQuota = StorageService.getDailyAiQuota(userId);
    return localQuota.remaining;
  });

  const [hasReachedLimit, setHasReachedLimit] = useState<boolean>(() => {
    const localQuota = StorageService.getDailyAiQuota(userId);
    return localQuota.remaining <= 0;
  });

  // AI Chat conversation history
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; text: string; timestamp?: string }[]>([
    {
      role: 'assistant',
      text: 'Namaste! Main aapka AI Money Manager assistant hoon. Aaj ka aapka 1 free financial query ready hai. Aap mujhse kisi bhi account, iss mahine ke kharche, balance ya savings ke baare mein Hindi, Hinglish ya English mein pooch sakte hain.',
      timestamp: 'Today',
    },
  ]);
  const [isAnswering, setIsAnswering] = useState(false);

  // Sync quota status with server and localStorage on mount
  useEffect(() => {
    const local = StorageService.getDailyAiQuota(userId);
    setQuestionsLeft(local.remaining);
    setHasReachedLimit(local.remaining <= 0);

    fetch(`/api/ai/quota-status?userId=${encodeURIComponent(userId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data.questionsRemaining === 'number') {
          const effectiveRemaining = Math.min(local.remaining, data.questionsRemaining);
          setQuestionsLeft(effectiveRemaining);
          setHasReachedLimit(effectiveRemaining <= 0);
          if (effectiveRemaining <= 0) {
            StorageService.consumeDailyAiQuota(userId);
          }
        }
      })
      .catch(() => {});
  }, [userId]);

  // Budgets state
  const [budgets, setBudgets] = useState<Budget[]>(() => {
    const local = StorageService.getBudgets();
    if (local && local.length > 0) return local;
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

  // Load budgets from Firestore if authenticated
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

  // Current Month calculations
  const currentMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const now = new Date();
  const currentDay = Math.max(1, now.getDate());
  const totalDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  // Budget calculations
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

    const dailyBurn = monthExpense / currentDay;
    const projectedMonthExpense = dailyBurn * totalDaysInMonth;
    const runwayDays = dailyBurn > 0 ? Math.round(totalBal / dailyBurn) : 999;

    const discretionaryCategories = ['entertainment', 'shopping', 'dining', 'food & dining', 'leisure', 'games', 'subscriptions'];
    let discretionaryTotal = 0;
    Object.entries(catSpends).forEach(([cat, val]) => {
      if (discretionaryCategories.some((d) => cat.toLowerCase().includes(d))) {
        discretionaryTotal += val;
      }
    });

    const topCategory = Object.entries(catSpends).sort((a, b) => b[1] - a[1])[0] || ['None', 0];

    // Compute dynamic Financial Health Score (0 to 100)
    let healthScore = 70;
    if (monthIncome > monthExpense && monthIncome > 0) {
      const savingsRate = (monthIncome - monthExpense) / monthIncome;
      healthScore += Math.round(savingsRate * 25);
    } else if (monthExpense > monthIncome && monthIncome > 0) {
      healthScore -= 20;
    }
    if (runwayDays > 90) healthScore += 10;
    else if (runwayDays < 30) healthScore -= 15;
    if (discretionaryTotal > monthExpense * 0.5 && monthExpense > 0) healthScore -= 10;
    healthScore = Math.max(15, Math.min(99, healthScore));

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
        desc: `Discretionary purchases account for ${((discretionaryTotal / monthExpense) * 100).toFixed(0)}% of total monthly outflows.`,
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
    if (totalBal > 25000 && monthIncome > monthExpense) {
      recommendations.push(
        `Healthy surplus detected: Allocate at least ${formatCurrency((monthIncome - monthExpense) * 0.4, prefCurrency)} to emergency reserve.`
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
        title: 'Surplus Automation',
        target: `Automate 15% transfer on income credit day into high-interest savings`,
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
      topCategory,
      healthScore,
      risks,
      recommendations,
      improvementPlan,
    };
  }, [accounts, analysisAccountId, transactions, currentMonth, prefCurrency, rates, currentDay, totalDaysInMonth]);

  // Handle Ask AI Question (Strictly 1 query per user per day)
  const handleAskQuestion = async (queryText?: string) => {
    const text = (queryText || chatInput).trim();
    if (!text) return;

    // Strict quota check: If already used today, block completely to protect admin AI credits
    if (questionsLeft <= 0 || hasReachedLimit) {
      setHasReachedLimit(true);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'Daily limit reached. Come back tomorrow! (Admin AI credits are protected. Your 1 free daily insight resets at midnight.)',
          timestamp: 'Just now',
        },
      ]);
      return;
    }

    const userMessage = { role: 'user' as const, text, timestamp: 'Just now' };
    setMessages((prev) => [...prev, userMessage]);
    setChatInput('');
    setIsAnswering(true);

    // Consume local quota immediately so further calls are blocked
    StorageService.consumeDailyAiQuota(userId);
    setQuestionsLeft(0);
    setHasReachedLimit(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          message: text,
          preferredCurrency: prefCurrency,
          financialContext: {
            totalBalance: formatCurrency(smartAnalysis.totalBal, prefCurrency),
            thisMonthIncome: formatCurrency(smartAnalysis.monthIncome, prefCurrency),
            thisMonthExpense: formatCurrency(smartAnalysis.monthExpense, prefCurrency),
            currency: prefCurrency,
            accounts: accounts.map((a) => ({ name: a.name, balance: a.balance, currency: a.currency })),
            topCategories: smartAnalysis.topCategory[0],
          },
        }),
      });

      const data = await res.json();

      if (res.status === 429 || data.limitReached) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: 'Daily limit reached. Come back tomorrow!',
            timestamp: 'Just now',
          },
        ]);
        return;
      }

      if (data.reply) {
        setMessages((prev) => [...prev, { role: 'assistant', text: data.reply, timestamp: 'Just now' }]);
        if (profile.firebaseUid) {
          await CloudFirestoreService.recordAiQuestionUsed(profile.firebaseUid);
        }
      } else {
        throw new Error('No reply from server');
      }
    } catch {
      // Deterministic calculation strictly from real ledger
      const qLower = text.toLowerCase();
      let answer = '';

      if (qLower.includes('kharcha') || qLower.includes('expense') || qLower.includes('spent')) {
        answer = `Iss mahine aapka total kharcha ${formatCurrency(smartAnalysis.monthExpense, prefCurrency)} hua hai. Sabse zyada kharcha ${smartAnalysis.topCategory[0]} category mein ${formatCurrency(smartAnalysis.topCategory[1] as number, prefCurrency)} hua hai.`;
      } else if (qLower.includes('balance') || qLower.includes('available')) {
        answer = `Aapke sabhi active accounts ka total consolidated balance ${formatCurrency(smartAnalysis.totalBal, prefCurrency)} hai (${accounts.length} active accounts).`;
      } else if (qLower.includes('income') || qLower.includes('salary') || qLower.includes('kamayi')) {
        answer = `Iss mahine aapki total income ${formatCurrency(smartAnalysis.monthIncome, prefCurrency)} hai.`;
      } else {
        answer = `Aapke ledger ke hisaab se: Total Balance: ${formatCurrency(smartAnalysis.totalBal, prefCurrency)}, Iss mahine ka kharcha: ${formatCurrency(smartAnalysis.monthExpense, prefCurrency)}, Income: ${formatCurrency(smartAnalysis.monthIncome, prefCurrency)}, Health Score: ${smartAnalysis.healthScore}/100.`;
      }

      setMessages((prev) => [...prev, { role: 'assistant', text: answer, timestamp: 'Just now' }]);
    } finally {
      setIsAnswering(false);
    }
  };

  return (
    <div className="max-w-md md:max-w-5xl mx-auto px-4 py-4 pb-28 space-y-4">
      {/* 1. Modern Colorful Fintech Hero Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0B1528] via-[#122244] to-[#1E3A8A] text-white p-5 sm:p-6 shadow-xl border border-white/10 space-y-4">
        {/* Ambient Glowing Background Orbs */}
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-blue-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-lg ring-2 ring-white/20">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                <span>AI Manager</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/30 border border-blue-400/40 text-blue-200 uppercase tracking-wider">
                  Fintech AI
                </span>
              </h2>
              {/* SUBTITLE CHANGED AS MANDATED */}
              <p className="text-xs text-blue-100/90 font-medium mt-0.5">
                Smart Financial Guide & Daily AI Insights
              </p>
            </div>
          </div>

          {/* TOP BADGE: Strictly showing 1/1 Left or 0/1 Left */}
          <div className="self-start sm:self-auto">
            {questionsLeft > 0 ? (
              <div className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-emerald-500/25 via-teal-500/25 to-blue-500/25 border border-emerald-400/50 text-emerald-300 font-extrabold text-xs flex items-center gap-1.5 shadow-md backdrop-blur-md">
                <Sparkles className="w-3.5 h-3.5 text-emerald-300 animate-pulse" />
                <span>Daily AI Insight: 1/1 Left Today</span>
              </div>
            ) : (
              <div className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-rose-500/25 via-orange-500/25 to-amber-500/25 border border-rose-400/40 text-rose-200 font-extrabold text-xs flex items-center gap-1.5 shadow-md backdrop-blur-md">
                <Clock className="w-3.5 h-3.5 text-rose-300" />
                <span>Daily AI Insight: 0/1 Left Today</span>
              </div>
            )}
          </div>
        </div>

        {/* 2. Quick Insight Glassmorphic Fintech Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 relative z-10">
          {/* Widget 1: Health Score */}
          <div className="p-3.5 rounded-2xl bg-white/10 dark:bg-slate-900/40 backdrop-blur-md border border-white/15 shadow-sm hover:bg-white/15 transition-all">
            <div className="flex items-center justify-between text-blue-200">
              <span className="text-[10px] font-extrabold uppercase tracking-wider">Health Score</span>
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-lg font-black text-white mt-1">
              {smartAnalysis.healthScore}
              <span className="text-xs font-normal text-blue-200">/100</span>
            </div>
            <span className="text-[10px] font-bold text-emerald-300 block truncate mt-0.5">
              {smartAnalysis.healthScore >= 75 ? 'Strong Buffer' : smartAnalysis.healthScore >= 50 ? 'Moderate' : 'Attention Needed'}
            </span>
          </div>

          {/* Widget 2: Daily Burn */}
          <div className="p-3.5 rounded-2xl bg-white/10 dark:bg-slate-900/40 backdrop-blur-md border border-white/15 shadow-sm hover:bg-white/15 transition-all">
            <div className="flex items-center justify-between text-rose-200">
              <span className="text-[10px] font-extrabold uppercase tracking-wider">Daily Burn</span>
              <Flame className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div className="text-lg font-black text-white mt-1 truncate">
              {formatCurrency(smartAnalysis.dailyBurn, prefCurrency)}
            </div>
            <span className="text-[10px] text-blue-200 block truncate mt-0.5">Per-day spending</span>
          </div>

          {/* Widget 3: Cash Runway */}
          <div className="p-3.5 rounded-2xl bg-white/10 dark:bg-slate-900/40 backdrop-blur-md border border-white/15 shadow-sm hover:bg-white/15 transition-all">
            <div className="flex items-center justify-between text-indigo-200">
              <span className="text-[10px] font-extrabold uppercase tracking-wider">Runway</span>
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-300" />
            </div>
            <div className="text-lg font-black text-white mt-1">
              ~{smartAnalysis.runwayDays > 365 ? '365+' : smartAnalysis.runwayDays}d
            </div>
            <span className="text-[10px] text-blue-200 block truncate mt-0.5">At current burn</span>
          </div>

          {/* Widget 4: Top Category Outflow */}
          <div className="p-3.5 rounded-2xl bg-white/10 dark:bg-slate-900/40 backdrop-blur-md border border-white/15 shadow-sm hover:bg-white/15 transition-all">
            <div className="flex items-center justify-between text-amber-200">
              <span className="text-[10px] font-extrabold uppercase tracking-wider">Top Outflow</span>
              <PieIcon className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-sm font-black text-white mt-1 truncate">
              {smartAnalysis.topCategory[0]}
            </div>
            <span className="text-[10px] text-amber-300 font-bold block truncate mt-0.5">
              {formatCurrency(smartAnalysis.topCategory[1] as number, prefCurrency)}
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-black/30 backdrop-blur-md p-1 rounded-2xl flex items-center justify-between text-xs font-bold text-slate-300 border border-white/10 gap-1 relative z-10">
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`flex-1 py-2 px-3 text-center rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'chat'
                ? 'bg-white text-slate-900 shadow-md font-black'
                : 'hover:text-white hover:bg-white/5'
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            <span>AI Chat</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('smart_analysis')}
            className={`flex-1 py-2 px-3 text-center rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'smart_analysis'
                ? 'bg-white text-blue-900 shadow-md font-black'
                : 'hover:text-white hover:bg-white/5'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            <span>AI SMART ANALYSIS</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('budget')}
            className={`flex-1 py-2 px-3 text-center rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'budget'
                ? 'bg-white text-emerald-900 shadow-md font-black'
                : 'hover:text-white hover:bg-white/5'
            }`}
          >
            <Target className="w-3.5 h-3.5 text-emerald-500" />
            <span>Budget Planning</span>
          </button>
        </div>
      </div>

      {/* 3. TAB 1: AI CHAT (Strictly 1 Query Per User Per Day) */}
      {activeTab === 'chat' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">
          {/* Limit Reached Warning Card */}
          {hasReachedLimit && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-orange-500/10 border border-amber-300 dark:border-amber-800/60 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                <Clock className="w-5 h-5" />
              </div>
              <div className="space-y-1 text-xs">
                <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">
                  Daily limit reached. Come back tomorrow!
                </h4>
                <p className="text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                  You have used your 1 free AI insight for today. Admin AI credits are completely protected. Your daily AI query resets tomorrow at midnight!
                </p>
                <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 pt-0.5">
                  ✓ Real-time ledger balances, charts, and deep account analysis remain 100% accessible.
                </div>
              </div>
            </div>
          )}

          {/* Suggestion Chips */}
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Recommended Financial Queries
            </span>
            <div className="flex flex-wrap gap-2">
              {[
                'Is month kitna kharcha hua?',
                'Audit my highest spending category',
                'What is my total net balance across accounts?',
                'How can I save more money this month?',
              ].map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={hasReachedLimit}
                  onClick={() => handleAskQuestion(q)}
                  className="py-1.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-400 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer text-left disabled:opacity-40 disabled:cursor-not-allowed border border-slate-200/60 dark:border-slate-700/60"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Conversation Stream */}
          <div className="space-y-3 pt-1 max-h-96 overflow-y-auto pr-1">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`p-4 rounded-2xl text-xs leading-relaxed space-y-1 shadow-2xs ${
                  m.role === 'user'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold ml-8 rounded-br-none'
                    : 'bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 font-medium mr-8 border border-slate-200/80 dark:border-slate-700 rounded-bl-none'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] opacity-75 pb-0.5">
                  <span className="font-bold">{m.role === 'user' ? 'You' : 'AI Financial Guide'}</span>
                  <span>{m.timestamp || 'Today'}</span>
                </div>
                <div className="text-xs whitespace-pre-wrap">{m.text}</div>
              </div>
            ))}
            {isAnswering && (
              <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-xs text-blue-700 dark:text-blue-300 font-medium flex items-center gap-2 animate-pulse mr-8">
                <Brain className="w-4 h-4 animate-spin" />
                <span>Analyzing your Cloud Firestore ledger records...</span>
              </div>
            )}
          </div>

          {/* Chat Input Field with Strict Daily Enforcement */}
          <div className="relative pt-2">
            <input
              type="text"
              disabled={hasReachedLimit}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion()}
              placeholder={
                hasReachedLimit
                  ? 'Daily limit reached. Come back tomorrow!'
                  : 'Ask about income, expenses, accounts, or savings advice...'
              }
              className="w-full pl-4 pr-12 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:text-slate-400 disabled:cursor-not-allowed shadow-inner transition"
            />
            <button
              type="button"
              disabled={hasReachedLimit || !chatInput.trim() || isAnswering}
              onClick={() => handleAskQuestion()}
              className="absolute right-2 top-1/2 -translate-y-1/2 mt-1 w-9 h-9 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-center transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-md hover:scale-105 active:scale-95"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 4. TAB 2: AI SMART ANALYSIS */}
      {activeTab === 'smart_analysis' && (
        <div className="space-y-4">
          {/* Account Selector for Deep Analysis */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-[#0B1528] dark:text-white">
                Select Account for Deep AI Analysis
              </span>
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">
                {smartAnalysis.targetAccount ? smartAnalysis.targetAccount.name : 'All Accounts Overview • Live Summary'}
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
                <span>All Accounts Overview • Live Summary</span>
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

          {/* Diagnostic Metrics Grid */}
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

          {/* Actionable Monthly Financial Improvement Roadmap */}
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

      {/* 5. TAB 3: BUDGET PLANNING */}
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
    </div>
  );
};
