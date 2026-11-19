/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Sparkles,
  Brain,
  Send,
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
  Activity,
  ShieldCheck,
  Clock,
  Lock,
} from 'lucide-react';
import {
  Account,
  AiQuotaStatus,
  Budget,
  BudgetCategoryRecommendation,
  BudgetPlanResponse,
  DailyAiInsightsResponse,
  DeepSmartAnalysisResponse,
  Transaction,
  UserProfile,
} from '../types/finance';
import { convertCurrency, formatCurrency, getCachedRates } from '../services/currencyService';
import { CloudFirestoreService } from '../services/cloudFirestoreService';
import { StorageService } from '../services/storageService';
import { AiApiError, AiService, getBrowserTimezone } from '../services/aiService';
import { auth } from '../services/firebase';
import { DynamicIcon } from './IconAndColorPicker';

interface AiManagerScreenProps {
  profile: UserProfile;
  accounts: Account[];
  transactions: Transaction[];
  onOpenReceiptScanner?: () => void;
}

function formatResetTime(resetAt?: string, timezone?: string): string {
  if (!resetAt) return 'midnight';
  try {
    return new Date(resetAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone || getBrowserTimezone(),
    });
  } catch {
    return 'midnight';
  }
}

export const AiManagerScreen: React.FC<AiManagerScreenProps> = ({
  profile,
  accounts,
  transactions,
}) => {
  const prefCurrency = profile.preferredCurrency;
  const rates = getCachedRates().rates;
  const userTimezone = profile.timezone || getBrowserTimezone();
  const isAuthenticated = Boolean(auth.currentUser && profile.firebaseUid && profile.firebaseUid !== 'guest');

  // Active tab: AI Chat, AI SMART ANALYSIS, or Budget Planning
  const [activeTab, setActiveTab] = useState<'chat' | 'smart_analysis' | 'budget'>('chat');
  const [analysisAccountId, setAnalysisAccountId] = useState<string>('all');

  // Persistent daily AI Chat quota synced from Firestore via authenticated backend
  const [quotaStatus, setQuotaStatus] = useState<AiQuotaStatus | null>(null);
  const [quotaLoading, setQuotaLoading] = useState<boolean>(false);

  const questionsLeft = quotaStatus ? quotaStatus.questionsRemaining : 1;
  const hasReachedLimit = Boolean(quotaStatus?.dailyLimitReached || (quotaStatus && quotaStatus.questionsRemaining <= 0));

  // AI Chat state
  const [chatInput, setChatInput] = useState('');
  const [chatError, setChatError] = useState<{ message: string; quotaConsumed: boolean } | null>(null);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; text: string; timestamp?: string; modelUsed?: string }[]>([
    {
      role: 'assistant',
      text: 'Namaste! Main aapka AI Money Manager assistant hoon (100% Free Edition). Aap har roz 1 free Gemini AI financial query pooch sakte hain — aapke real Cloud Firestore accounts, kharche aur budgets ke base par.',
      timestamp: 'Today',
    },
  ]);
  const [isAnswering, setIsAnswering] = useState(false);

  // Daily AI Insights state (independent of AI Chat quota)
  const [insightsResponse, setInsightsResponse] = useState<DailyAiInsightsResponse | null>(null);
  const [insightsLoading, setInsightsLoading] = useState<boolean>(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  // Deep AI Smart Analysis state (independent of AI Chat quota)
  const [deepAnalysis, setDeepAnalysis] = useState<DeepSmartAnalysisResponse | null>(null);
  const [deepLoading, setDeepLoading] = useState<boolean>(false);
  const [deepError, setDeepError] = useState<string | null>(null);

  // Budget Planning AI state (independent of AI Chat quota, never auto-mutates)
  const [aiBudgetPlan, setAiBudgetPlan] = useState<BudgetPlanResponse | null>(null);
  const [budgetPlanLoading, setBudgetPlanLoading] = useState<boolean>(false);
  const [budgetPlanError, setBudgetPlanError] = useState<string | null>(null);
  const [appliedBudgetCategories, setAppliedBudgetCategories] = useState<Record<string, boolean>>({});

  // Local + Firestore Budgets CRUD state
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

  // Sync persistent daily quota status from backend when signed in
  const refreshQuotaStatus = useCallback(async () => {
    if (!auth.currentUser) {
      setQuotaStatus(null);
      return;
    }
    setQuotaLoading(true);
    try {
      const status = await AiService.getQuotaStatus(userTimezone);
      setQuotaStatus(status);
    } catch {
      // Preserve last known status on transient network failure
    } finally {
      setQuotaLoading(false);
    }
  }, [userTimezone]);

  useEffect(() => {
    refreshQuotaStatus();
  }, [refreshQuotaStatus, profile.firebaseUid]);

  // Sync budgets from Firestore
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

  // Local ledger metrics preview (instant render + offline fallback for KPI widgets)
  const currentMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const now = new Date();
  const currentDay = Math.max(1, now.getDate());
  const totalDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const localSmartMetrics = useMemo(() => {
    const targetAccount = accounts.find((a) => a.id === analysisAccountId);
    const accountTxs = transactions.filter((tx) => {
      if (tx.isDeleted) return false;
      if (analysisAccountId === 'all') return true;
      return tx.accountId === analysisAccountId || (tx.type === 'transfer' && tx.toAccountId === analysisAccountId);
    });
    const monthTxs = accountTxs.filter((tx) => tx.date.startsWith(currentMonth));

    let totalBal = 0;
    if (analysisAccountId === 'all') {
      totalBal = accounts
        .filter((a) => !a.archived)
        .reduce((sum, a) => sum + convertCurrency(a.balance, a.currency, prefCurrency, rates), 0);
    } else if (targetAccount) {
      totalBal = convertCurrency(targetAccount.balance, targetAccount.currency, prefCurrency, rates);
    }

    let monthIncome = 0;
    let monthExpense = 0;
    const catSpends: Record<string, number> = {};

    monthTxs.forEach((tx) => {
      const amt = convertCurrency(tx.amount, tx.currency, prefCurrency, rates);
      if (tx.type === 'income' && (analysisAccountId === 'all' || tx.accountId === analysisAccountId)) {
        monthIncome += amt;
      } else if (tx.type === 'expense' && (analysisAccountId === 'all' || tx.accountId === analysisAccountId)) {
        monthExpense += amt;
        catSpends[tx.category] = (catSpends[tx.category] || 0) + amt;
      }
    });

    const dailyBurn = monthExpense / currentDay;
    const runwayDays = dailyBurn > 0 ? Math.round(totalBal / dailyBurn) : 999;
    const discretionaryCategories = ['entertainment', 'shopping', 'dining', 'food & dining', 'leisure', 'games', 'subscriptions'];
    const discretionaryTotal = Object.entries(catSpends).reduce((sum, [cat, val]) => {
      return discretionaryCategories.some((d) => cat.toLowerCase().includes(d)) ? sum + val : sum;
    }, 0);

    const topCategory = Object.entries(catSpends).sort((a, b) => b[1] - a[1])[0] || ['None', 0];

    let healthScore = 70;
    if (monthIncome > monthExpense && monthIncome > 0) {
      healthScore += Math.round(((monthIncome - monthExpense) / monthIncome) * 25);
    } else if (monthExpense > monthIncome && monthIncome > 0) {
      healthScore -= 20;
    }
    if (runwayDays > 90) healthScore += 10;
    else if (runwayDays < 30 && dailyBurn > 0) healthScore -= 15;
    if (discretionaryTotal > monthExpense * 0.5 && monthExpense > 0) healthScore -= 10;
    healthScore = Math.max(15, Math.min(99, healthScore));

    return {
      targetAccount,
      totalBal,
      monthIncome,
      monthExpense,
      dailyBurn,
      runwayDays,
      discretionaryTotal,
      topCategory,
      healthScore,
    };
  }, [accounts, analysisAccountId, transactions, currentMonth, prefCurrency, rates, currentDay]);

  // Budget utilization calculations
  const budgetCalculations = useMemo(() => {
    return budgets.map((b) => {
      const spent = transactions
        .filter((t) => !t.isDeleted && t.type === 'expense' && t.category.toLowerCase() === b.category.toLowerCase() && t.date.startsWith(currentMonth))
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

  // Fetch Daily AI Insights + Deep Smart Analysis when viewing Smart Analysis tab
  const loadSmartAnalysisData = useCallback(
    async (forceRefreshInsights = false) => {
      if (!auth.currentUser) return;

      setInsightsLoading(true);
      setInsightsError(null);
      setDeepLoading(true);
      setDeepError(null);

      await Promise.all([
        AiService.getDailyInsights({
          accountId: analysisAccountId,
          forceRefresh: forceRefreshInsights,
          timezone: userTimezone,
        })
          .then((res) => setInsightsResponse(res))
          .catch((err) => setInsightsError(err instanceof Error ? err.message : 'Unable to load Daily AI Insights.')),
        AiService.getDeepSmartAnalysis(analysisAccountId, userTimezone)
          .then((res) => setDeepAnalysis(res))
          .catch((err) => setDeepError(err instanceof Error ? err.message : 'Unable to load Deep AI Smart Analysis.')),
      ]);

      setInsightsLoading(false);
      setDeepLoading(false);
    },
    [analysisAccountId, userTimezone]
  );

  useEffect(() => {
    if (activeTab === 'smart_analysis' && auth.currentUser) {
      loadSmartAnalysisData(false);
    }
  }, [activeTab, analysisAccountId, loadSmartAnalysisData]);

  // Ask AI Chat Query (Authenticated, Persistent 1/day Quota, Never Fake Fallback)
  const handleAskQuestion = async (queryText?: string) => {
    const text = (queryText || chatInput).trim();
    if (!text || isAnswering) return;
    setChatError(null);

    if (!auth.currentUser) {
      setChatError({
        message: 'Please sign in with Google or Email in Profile to use Gemini AI Chat with your synced Cloud Firestore ledger.',
        quotaConsumed: false,
      });
      return;
    }

    if (hasReachedLimit) {
      setChatError({
        message: `Daily free AI Chat limit reached (1 query/day). Next reset at ${formatResetTime(quotaStatus?.resetAt, quotaStatus?.timezone)}.`,
        quotaConsumed: false,
      });
      return;
    }

    const userMessage = { role: 'user' as const, text, timestamp: 'Just now' };
    setMessages((prev) => [...prev, userMessage]);
    setChatInput('');
    setIsAnswering(true);

    try {
      const response = await AiService.sendChatQuery(text, userTimezone);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: response.reply,
          timestamp: 'Just now',
          modelUsed: response.modelUsed,
        },
      ]);
      setQuotaStatus({
        isPro: response.isPro,
        questionsRemaining: response.questionsRemaining,
        questionsUsed: response.questionsUsed,
        limit: response.limit,
        date: response.date,
        timezone: response.timezone,
        resetAt: response.resetAt,
        dailyLimitReached: response.dailyLimitReached,
      });
    } catch (err: any) {
      if (err instanceof AiApiError) {
        if (err.limitReached) {
          setQuotaStatus((prev) => ({
            isPro: false,
            questionsRemaining: 0,
            questionsUsed: 1,
            limit: 1,
            date: prev?.date || new Date().toISOString().slice(0, 10),
            timezone: err.quotaStatus?.timezone || prev?.timezone || userTimezone,
            resetAt: err.quotaStatus?.resetAt || prev?.resetAt || '',
            dailyLimitReached: true,
          }));
        }
        setChatError({
          message: err.message,
          quotaConsumed: err.quotaConsumed,
        });
      } else {
        setChatError({
          message: err?.message || 'Gemini AI service is temporarily unavailable. Your daily chat query was not consumed.',
          quotaConsumed: false,
        });
      }
      // Refresh authoritative quota from Firestore after error
      refreshQuotaStatus();
    } finally {
      setIsAnswering(false);
    }
  };

  // Generate AI Budget Plan on explicit user action (never auto-mutates)
  const handleGenerateAiBudgetPlan = async () => {
    if (!auth.currentUser) {
      setBudgetPlanError('Please sign in with Google or Email to generate a personalized Gemini AI Budget Plan.');
      return;
    }
    setBudgetPlanLoading(true);
    setBudgetPlanError(null);
    try {
      const plan = await AiService.getBudgetPlan(userTimezone);
      setAiBudgetPlan(plan);
    } catch (err: any) {
      setBudgetPlanError(err?.message || 'Unable to generate AI Budget Plan.');
    } finally {
      setBudgetPlanLoading(false);
    }
  };

  // Explicitly apply a single AI-recommended category budget upon user click
  const handleApplyRecommendedBudget = async (rec: BudgetCategoryRecommendation) => {
    const uid = profile.firebaseUid || profile.id;
    const existing = budgets.find((b) => b.category.toLowerCase() === rec.category.toLowerCase());
    let updated: Budget[];
    let savedTarget: Budget;

    if (existing) {
      savedTarget = { ...existing, monthlyLimit: rec.recommendedLimit, currency: prefCurrency };
      updated = budgets.map((b) => (b.id === existing.id ? savedTarget : b));
    } else {
      savedTarget = {
        id: `bgt-${Date.now()}`,
        category: rec.category,
        monthlyLimit: rec.recommendedLimit,
        currency: prefCurrency,
        alertThreshold: 80,
      };
      updated = [...budgets, savedTarget];
    }

    setBudgets(updated);
    StorageService.saveBudgets(updated);
    setAppliedBudgetCategories((prev) => ({ ...prev, [rec.category]: true }));

    if (uid && uid !== 'guest') {
      await CloudFirestoreService.saveBudget(uid, savedTarget);
    }
  };

  // Save manual budget modal
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

  const handleDeleteBudget = async (id: string) => {
    const updated = budgets.filter((b) => b.id !== id);
    setBudgets(updated);
    StorageService.saveBudgets(updated);

    const uid = profile.firebaseUid || profile.id;
    if (uid && uid !== 'guest') {
      await CloudFirestoreService.deleteBudget(uid, id);
    }
  };

  // Display KPI values preferring server-computed deep analysis metrics when scope matches
  const kpiHealthScore =
    deepAnalysis && deepAnalysis.metrics.scopeAccountId === analysisAccountId
      ? deepAnalysis.metrics.healthScore
      : localSmartMetrics.healthScore;
  const kpiDailyBurn =
    deepAnalysis && deepAnalysis.metrics.scopeAccountId === analysisAccountId
      ? deepAnalysis.metrics.thisMonth.dailyBurnRate
      : localSmartMetrics.dailyBurn;
  const kpiRunwayDays =
    deepAnalysis && deepAnalysis.metrics.scopeAccountId === analysisAccountId
      ? deepAnalysis.metrics.thisMonth.runwayDays
      : localSmartMetrics.runwayDays;
  const kpiTopCategoryName =
    deepAnalysis && deepAnalysis.metrics.scopeAccountId === analysisAccountId
      ? deepAnalysis.metrics.topCategories[0]?.category || 'None'
      : (localSmartMetrics.topCategory[0] as string);
  const kpiTopCategoryAmount =
    deepAnalysis && deepAnalysis.metrics.scopeAccountId === analysisAccountId
      ? deepAnalysis.metrics.topCategories[0]?.amount || 0
      : (localSmartMetrics.topCategory[1] as number);

  return (
    <div className="max-w-md md:max-w-5xl mx-auto px-4 py-4 pb-28 space-y-4">
      {/* 1. Fintech AI Hero Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0B1528] via-[#122244] to-[#1E3A8A] text-white p-5 sm:p-6 shadow-xl border border-white/10 space-y-4">
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
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 uppercase tracking-wider">
                  100% Free
                </span>
              </h2>
              <p className="text-xs text-blue-100/90 font-medium mt-0.5">
                Gemini Financial Intelligence • Daily AI Insights & Budget Coach
              </p>
            </div>
          </div>

          {/* Daily AI Chat Quota Badge */}
          <div className="self-start sm:self-auto">
            {!isAuthenticated ? (
              <div className="px-3.5 py-1.5 rounded-full bg-white/15 border border-white/25 text-blue-100 font-bold text-xs flex items-center gap-1.5 backdrop-blur-md">
                <Lock className="w-3.5 h-3.5 text-amber-300" />
                <span>Sign in for Daily AI Chat</span>
              </div>
            ) : quotaLoading ? (
              <div className="px-3.5 py-1.5 rounded-full bg-white/10 border border-white/20 text-blue-100 font-bold text-xs flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Syncing AI Quota...</span>
              </div>
            ) : questionsLeft > 0 ? (
              <div className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-emerald-500/25 via-teal-500/25 to-blue-500/25 border border-emerald-400/50 text-emerald-300 font-extrabold text-xs flex items-center gap-1.5 shadow-md backdrop-blur-md">
                <Sparkles className="w-3.5 h-3.5 text-emerald-300 animate-pulse" />
                <span>Daily AI Chat: 1/1 Left Today</span>
              </div>
            ) : (
              <div className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-rose-500/25 via-orange-500/25 to-amber-500/25 border border-rose-400/40 text-rose-200 font-extrabold text-xs flex items-center gap-1.5 shadow-md backdrop-blur-md">
                <Clock className="w-3.5 h-3.5 text-rose-300" />
                <span>Daily AI Chat: 0/1 Left Today</span>
              </div>
            )}
          </div>
        </div>

        {/* Quick Insight KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 relative z-10">
          <div className="p-3.5 rounded-2xl bg-white/10 dark:bg-slate-900/40 backdrop-blur-md border border-white/15 shadow-sm">
            <div className="flex items-center justify-between text-blue-200">
              <span className="text-[10px] font-extrabold uppercase tracking-wider">Health Score</span>
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-lg font-black text-white mt-1">
              {kpiHealthScore}
              <span className="text-xs font-normal text-blue-200">/100</span>
            </div>
            <span className="text-[10px] font-bold text-emerald-300 block truncate mt-0.5">
              {kpiHealthScore >= 75 ? 'Strong Buffer' : kpiHealthScore >= 50 ? 'Moderate' : 'Attention Needed'}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/10 dark:bg-slate-900/40 backdrop-blur-md border border-white/15 shadow-sm">
            <div className="flex items-center justify-between text-rose-200">
              <span className="text-[10px] font-extrabold uppercase tracking-wider">Daily Burn</span>
              <Flame className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div className="text-lg font-black text-white mt-1 truncate">
              {formatCurrency(kpiDailyBurn, prefCurrency)}
            </div>
            <span className="text-[10px] text-blue-200 block truncate mt-0.5">Per-day spending</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/10 dark:bg-slate-900/40 backdrop-blur-md border border-white/15 shadow-sm">
            <div className="flex items-center justify-between text-indigo-200">
              <span className="text-[10px] font-extrabold uppercase tracking-wider">Runway</span>
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-300" />
            </div>
            <div className="text-lg font-black text-white mt-1">
              ~{kpiRunwayDays > 365 ? '365+' : kpiRunwayDays}d
            </div>
            <span className="text-[10px] text-blue-200 block truncate mt-0.5">At current burn</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/10 dark:bg-slate-900/40 backdrop-blur-md border border-white/15 shadow-sm">
            <div className="flex items-center justify-between text-amber-200">
              <span className="text-[10px] font-extrabold uppercase tracking-wider">Top Outflow</span>
              <PieIcon className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-sm font-black text-white mt-1 truncate">{kpiTopCategoryName}</div>
            <span className="text-[10px] text-amber-300 font-bold block truncate mt-0.5">
              {formatCurrency(kpiTopCategoryAmount, prefCurrency)}
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-black/30 backdrop-blur-md p-1 rounded-2xl flex items-center justify-between text-xs font-bold text-slate-300 border border-white/10 gap-1 relative z-10">
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`flex-1 py-2 px-3 text-center rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'chat' ? 'bg-white text-slate-900 shadow-md font-black' : 'hover:text-white hover:bg-white/5'
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

      {/* 2. TAB 1: AI CHAT (1 Free Query / Day Across Web & Android) */}
      {activeTab === 'chat' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">
          {!isAuthenticated && (
            <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 flex items-start gap-3">
              <Lock className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <h4 className="font-extrabold text-slate-900 dark:text-white">Sign In Required for Cloud Gemini AI</h4>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  Open the Profile tab and sign in with Google or Email to sync your Firestore ledger and unlock your 1 free daily Gemini AI Chat query.
                </p>
              </div>
            </div>
          )}

          {isAuthenticated && hasReachedLimit && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-orange-500/10 border border-amber-300 dark:border-amber-800/60 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                <Clock className="w-5 h-5" />
              </div>
              <div className="space-y-1 text-xs">
                <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">
                  Daily limit reached. Come back tomorrow!
                </h4>
                <p className="text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                  You have used your 1 free daily AI Chat query for today ({quotaStatus?.date}). It resets automatically at {formatResetTime(quotaStatus?.resetAt, quotaStatus?.timezone)} ({quotaStatus?.timezone || userTimezone}).
                </p>
                <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 pt-0.5">
                  AI Smart Analysis, Daily AI Insights & Budget Planning remain accessible!
                </div>
              </div>
            </div>
          )}

          {chatError && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-bold">{chatError.message}</div>
                {!chatError.quotaConsumed && !hasReachedLimit && (
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold">
                    Your daily free AI Chat query was not consumed — you can retry safely.
                  </div>
                )}
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
                  disabled={!isAuthenticated || hasReachedLimit || isAnswering}
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
                  <span className="font-bold">
                    {m.role === 'user' ? 'You' : `Gemini Financial Guide${m.modelUsed ? ` (${m.modelUsed})` : ''}`}
                  </span>
                  <span>{m.timestamp || 'Today'}</span>
                </div>
                <div className="text-xs whitespace-pre-wrap">{m.text}</div>
              </div>
            ))}
            {isAnswering && (
              <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-xs text-blue-700 dark:text-blue-300 font-medium flex items-center gap-2 animate-pulse mr-8">
                <Brain className="w-4 h-4 animate-spin" />
                <span>Analyzing your verified Cloud Firestore ledger via Gemini AI...</span>
              </div>
            )}
          </div>

          {/* Chat Input */}
          <div className="relative pt-2">
            <input
              type="text"
              disabled={!isAuthenticated || hasReachedLimit || isAnswering}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion()}
              placeholder={
                !isAuthenticated
                  ? 'Sign in via Profile to ask Gemini AI...'
                  : hasReachedLimit
                  ? 'Daily limit reached. Resets at midnight!'
                  : 'Ask about income, expenses, accounts, or savings advice...'
              }
              className="w-full pl-4 pr-12 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:text-slate-400 disabled:cursor-not-allowed shadow-inner transition"
            />
            <button
              type="button"
              disabled={!isAuthenticated || hasReachedLimit || !chatInput.trim() || isAnswering}
              onClick={() => handleAskQuestion()}
              className="absolute right-2 top-1/2 -translate-y-1/2 mt-1 w-9 h-9 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-center transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-md hover:scale-105 active:scale-95"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 3. TAB 2: AI SMART ANALYSIS & DAILY AI INSIGHTS (Independent of AI Chat Quota) */}
      {activeTab === 'smart_analysis' && (
        <div className="space-y-4">
          {/* Account Selector */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-[#0B1528] dark:text-white">
                Select Account for Deep AI Analysis
              </span>
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">
                {localSmartMetrics.targetAccount ? localSmartMetrics.targetAccount.name : 'All Accounts Combined'}
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
                <span>All Accounts</span>
              </button>

              {accounts.filter((a) => !a.archived).map((acc) => (
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

          {/* Daily AI Insights Card (Smart Firestore Cached) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-500" />
                  <span>Daily AI Insights</span>
                  {insightsResponse?.cached && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      Smart Cached
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-slate-400">
                  Grounded in your Cloud Firestore transactions (does not use your 1/day chat query)
                </p>
              </div>
              {isAuthenticated && (
                <button
                  type="button"
                  disabled={insightsLoading}
                  onClick={() => loadSmartAnalysisData(true)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${insightsLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              )}
            </div>

            {!isAuthenticated ? (
              <p className="text-xs text-slate-500">
                Sign in with Google or Email in Profile to generate Cloud Gemini Daily AI Insights from your ledger.
              </p>
            ) : insightsLoading && !insightsResponse ? (
              <div className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-2 py-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Auditing your categories and monthly cash flow...</span>
              </div>
            ) : insightsError && !insightsResponse ? (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
                {insightsError}
              </div>
            ) : insightsResponse ? (
              <>
                <p className="text-xs text-slate-700 dark:text-slate-200 font-medium leading-relaxed">
                  {insightsResponse.summary}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {insightsResponse.insights.map((item, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700 p-3.5 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-extrabold text-slate-900 dark:text-white">{item.category}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.priority === 'High'
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                              : item.priority === 'Medium'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          }`}
                        >
                          {item.priority}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono-numbers font-bold text-blue-600 dark:text-blue-400">
                        {formatCurrency(item.amountSpent, prefCurrency)}
                        {item.percentageOfExpenses != null ? ` (${item.percentageOfExpenses}% of spend)` : ''}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300">{item.reason}</p>
                      <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 pt-0.5">
                        Action: {item.recommendedAction}
                      </div>
                      {item.estimatedPotentialSavings != null && item.estimatedPotentialSavings > 0 && (
                        <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          Est. Potential Savings: {formatCurrency(item.estimatedPotentialSavings, prefCurrency)}/mo
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400">
                  Powered by {insightsResponse.modelUsed} • Updated {new Date(insightsResponse.generatedAt).toLocaleString()}
                </p>
              </>
            ) : null}
          </div>

          {/* Deep Smart Analysis Section */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-extrabold text-[#0B1528] dark:text-white flex items-center gap-2">
                <Brain className="w-4 h-4 text-indigo-500" />
                <span>Deep AI Smart Analysis</span>
              </h4>
              {deepLoading && <span className="text-[11px] text-blue-500 font-semibold">Generating Deep Report...</span>}
            </div>

            {deepError && !deepAnalysis && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
                {deepError}
              </div>
            )}

            {deepAnalysis && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 space-y-2 text-xs">
                  <div className="font-extrabold text-indigo-900 dark:text-indigo-200">Executive Summary</div>
                  <p className="text-slate-700 dark:text-slate-200 leading-relaxed">{deepAnalysis.aiAnalysis.executiveSummary}</p>
                  <p className="text-slate-600 dark:text-slate-300">{deepAnalysis.aiAnalysis.spendingTrendSummary}</p>
                </div>

                {/* Risk Explanations */}
                <div className="space-y-2">
                  <div className="text-xs font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-rose-500" />
                    <span>Risk Flags & Health Drivers</span>
                  </div>
                  {deepAnalysis.aiAnalysis.riskExplanations.length === 0 ? (
                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Optimal financial health! No unusual expense spikes or deficit flags detected.</span>
                    </div>
                  ) : (
                    deepAnalysis.aiAnalysis.riskExplanations.map((r, i) => (
                      <div
                        key={i}
                        className="p-3.5 rounded-xl bg-rose-50/60 dark:bg-rose-950/25 border border-rose-200 dark:border-rose-800 text-xs space-y-1"
                      >
                        <div className="font-extrabold text-rose-900 dark:text-rose-200">{r.title}</div>
                        <div className="text-rose-700 dark:text-rose-300">{r.explanation}</div>
                        <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Impact: {r.impact}</div>
                      </div>
                    ))
                  )}
                </div>

                {/* Saving Opportunities */}
                {deepAnalysis.aiAnalysis.savingOpportunities.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <span>AI Saving Opportunities</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {deepAnalysis.aiAnalysis.savingOpportunities.map((opp, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-extrabold text-blue-950 dark:text-blue-100">{opp.title}</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              +{formatCurrency(opp.potentialMonthlySavings, prefCurrency)}/mo
                            </span>
                          </div>
                          <p className="text-slate-700 dark:text-slate-300">{opp.action}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">Basis: {opp.basis}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommended Next Actions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  {deepAnalysis.aiAnalysis.recommendedNextActions.map((act, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-indigo-600 dark:text-indigo-400">{act.title}</span>
                        <span className="text-[10px] font-bold uppercase text-slate-400">{act.priority}</span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300">{act.detail}</p>
                      <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 pt-0.5">
                        <ArrowRight className="w-3 h-3" />
                        <span>{act.targetMetric}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. TAB 3: BUDGET PLANNING + AI BUDGET COACH */}
      {activeTab === 'budget' && (
        <div className="space-y-4">
          {/* AI Budget Coach Card (Explicit Opt-In, Never Auto-Mutates) */}
          <div className="bg-gradient-to-br from-emerald-50/80 to-blue-50/60 dark:from-emerald-950/30 dark:to-blue-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>Gemini AI Budget Planner</span>
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Analyzes real income, spending history, and current budgets. Nothing changes until you click Apply Limit.
                </p>
              </div>
              <button
                type="button"
                disabled={budgetPlanLoading}
                onClick={handleGenerateAiBudgetPlan}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50 shrink-0"
              >
                {budgetPlanLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>{budgetPlanLoading ? 'Planning...' : 'Generate AI Budget Plan'}</span>
              </button>
            </div>

            {budgetPlanError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
                {budgetPlanError}
              </div>
            )}

            {aiBudgetPlan && (
              <div className="space-y-3 pt-1">
                <div className="p-3.5 rounded-xl bg-white/90 dark:bg-slate-900/80 border border-emerald-200/80 dark:border-emerald-800/60 text-xs space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2 font-extrabold text-slate-900 dark:text-white">
                    <span>Overall Strategy</span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      Target Monthly Savings: {formatCurrency(aiBudgetPlan.plan.recommendedMonthlySavings, prefCurrency)}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{aiBudgetPlan.plan.overallStrategy}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {aiBudgetPlan.plan.categoryRecommendations.map((rec, idx) => {
                    const isApplied = Boolean(appliedBudgetCategories[rec.category]);
                    return (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-extrabold text-slate-900 dark:text-white">{rec.category}</span>
                          <span className="font-mono-numbers font-bold text-emerald-600 dark:text-emerald-400">
                            Cap: {formatCurrency(rec.recommendedLimit, prefCurrency)}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Current Spend: {formatCurrency(rec.currentMonthlySpend, prefCurrency)}
                          {rec.existingLimit != null ? ` • Existing Limit: ${formatCurrency(rec.existingLimit, prefCurrency)}` : ''}
                        </div>
                        <p className="text-slate-600 dark:text-slate-300">{rec.reasoning}</p>
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[10px] font-bold text-slate-400">
                            Est. Save: {formatCurrency(rec.suggestedMonthlySavings, prefCurrency)}/mo
                          </span>
                          <button
                            type="button"
                            onClick={() => handleApplyRecommendedBudget(rec)}
                            className={`px-3 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                              isApplied
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                          >
                            {isApplied ? 'Applied to Budgets' : 'Apply Limit'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Monthly Budget Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-[#0B1528] dark:text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-600" />
                <span>Monthly Budget Management</span>
              </h3>
              <p className="text-xs text-slate-400">
                Track real spending caps & overspending alerts for {new Date().toLocaleString('default', { month: 'long' })}
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

                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-extrabold font-mono-numbers text-slate-900 dark:text-white text-base">
                    {formatCurrency(b.spent, prefCurrency)}
                  </span>
                  <span className="text-slate-400 font-mono-numbers">
                    Limit: {formatCurrency(b.limitConverted, prefCurrency)}
                  </span>
                </div>

                <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      b.isOverbudget ? 'bg-rose-600' : b.isWarning ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, b.percent)}%` }}
                  />
                </div>

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
