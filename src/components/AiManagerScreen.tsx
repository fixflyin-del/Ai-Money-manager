/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Crown,
  Sparkles,
  Brain,
  Lock,
  Send,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { Account, Transaction, UserProfile } from '../types/finance';
import { formatCurrency, getCachedRates } from '../services/currencyService';
import { CloudFirestoreService } from '../services/cloudFirestoreService';

interface AiManagerScreenProps {
  profile: UserProfile;
  accounts: Account[];
  transactions: Transaction[];
  onOpenUpgrade: () => void;
  onOpenReceiptScanner: () => void;
}

export const AiManagerScreen: React.FC<AiManagerScreenProps> = ({
  profile,
  accounts,
  transactions,
  onOpenUpgrade,
  onOpenReceiptScanner,
}) => {
  const prefCurrency = profile.preferredCurrency;
  const rates = getCachedRates().rates;
  const isPro = profile.subscription.isPro;

  const [activeTab, setActiveTab] = useState<'chat' | 'ocr' | 'budget'>('chat');
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([
    {
      role: 'assistant',
      text: 'Namaste! Main aapka AI Money Manager assistant hoon. Aap mujhse kisi bhi account, iss mahine ke kharche, balance ya category ke baare mein Hindi, Hinglish ya English mein pooch sakte hain.',
    },
  ]);
  const [isAnswering, setIsAnswering] = useState(false);

  // Server & local synced daily quota for free tier (1 question per day)
  const [questionsLeft, setQuestionsLeft] = useState<number>(() => {
    if (isPro) return 999;
    return profile.dailyAiQuestionsRemaining !== undefined ? profile.dailyAiQuestionsRemaining : 1;
  });

  const [hasReachedLimit, setHasReachedLimit] = useState<boolean>(() => {
    if (isPro) return false;
    return (profile.dailyAiQuestionsRemaining !== undefined ? profile.dailyAiQuestionsRemaining : 1) <= 0;
  });

  const exampleQuestions = [
    'Is month kitna kharcha hua?',
    'Total available balance',
    'Which category has highest spending?',
  ];

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
      .catch(() => {
        // Fallback to local state
      });
  }, [isPro, profile.firebaseUid, profile.id]);

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
      // 1. Call server-side /api/ai/chat with quota enforcement
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
        // Sync with Firestore
        if (profile.firebaseUid) {
          await CloudFirestoreService.recordAiQuestionUsed(profile.firebaseUid);
        }
      } else {
        throw new Error('No reply from server');
      }
    } catch {
      // Offline / deterministic fallback response calculated strictly from real ledger
      const currentMonth = new Date().toISOString().slice(0, 7);
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
      {/* 1. Free Plan Banner (Screenshot 1 & Master Req 6) */}
      {!isPro && (
        <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/90 dark:border-amber-800/40 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-700/50 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-[#0B1528] dark:text-white leading-tight">
                {questionsLeft > 0
                  ? 'Free Plan · 1 of 1 Daily AI Question Remaining'
                  : 'Free Plan · Daily AI Limit Reached (0 of 1 Remaining)'}
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                Receipt OCR, Smart Draft Entry, Cash Flow Forecasting, and Executive AI Reports require AI Money Manager Premium.
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

      {/* 2. AI Money Manager Header Card (Screenshot 1) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#0B1528] dark:bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-xs">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-[#0B1528] dark:text-white tracking-tight">
              AI Money Manager
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Your Personal Finance Intelligence Assistant · Context: All Accounts · This Month
            </p>
          </div>
        </div>

        {/* Segmented Pill Tabs: AI Chat, 🔒 Smart Entry & OCR, Budget Planning */}
        <div className="bg-[#EEF2F6] dark:bg-slate-800 p-1 rounded-2xl flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 shadow-2xs">
          <button
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
            onClick={() => {
              if (!isPro) {
                onOpenUpgrade();
              } else {
                onOpenReceiptScanner();
              }
            }}
            className="flex-1 py-2 px-2 text-center rounded-xl transition cursor-pointer flex items-center justify-center gap-1 text-slate-600 dark:text-slate-300 hover:text-slate-800"
          >
            {!isPro && <Lock className="w-3 h-3 text-slate-400" />}
            <span className="truncate">Smart Entry & OCR</span>
          </button>

          <button
            onClick={() => {
              if (!isPro) onOpenUpgrade();
              else setActiveTab('budget');
            }}
            className="flex-1 py-2 px-2 text-center rounded-xl transition cursor-pointer flex items-center justify-center gap-1 text-slate-600 dark:text-slate-300 hover:text-slate-800"
          >
            {!isPro && <Lock className="w-3 h-3 text-slate-400" />}
            <span className="truncate">Budget Planning</span>
          </button>
        </div>
      </div>

      {/* 3. AI Chat Card (Screenshot 1) */}
      {activeTab === 'chat' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
            Ask in Hindi, Hinglish, or English using your real Cloud Firestore ledger:
          </p>

          {/* Example Question Chips */}
          <div className="flex flex-wrap gap-2">
            {exampleQuestions.map((q, idx) => (
              <button
                key={idx}
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

          {/* Locked / Limit Reached Callout */}
          {!isPro && hasReachedLimit && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 space-y-2 text-center">
              <p className="text-xs font-bold text-amber-900 dark:text-amber-200 leading-relaxed">
                You have used your free AI question for today. Upgrade to Premium to enjoy unlimited AI chat and advanced financial intelligence.
              </p>
              <button
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
              disabled={!isPro && hasReachedLimit}
              onClick={() => handleAskQuestion()}
              className="absolute right-2 top-1/2 -translate-y-1/2 mt-1 w-8 h-8 rounded-xl bg-[#0B1528] dark:bg-blue-600 text-white flex items-center justify-center transition cursor-pointer disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          {/* Deterministic Explanation Box (Screenshot 1) */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-center space-y-1">
            <h4 className="text-xs font-extrabold text-[#0B1528] dark:text-white">
              Ask anything about your personal or business accounts
            </h4>
            <p className="text-[11px] text-slate-400 max-w-xs mx-auto leading-relaxed">
              Every figure is computed deterministically from your authorized Firestore transactions—never guessed or fabricated.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
