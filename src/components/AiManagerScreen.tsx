/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Crown,
  Sparkles,
  Brain,
  Lock,
  Send,
  Camera,
  Target,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { Account, Transaction, UserProfile } from '../types/finance';
import { formatCurrency, getCachedRates } from '../services/currencyService';

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
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const [isAnswering, setIsAnswering] = useState(false);
  const [questionsLeft, setQuestionsLeft] = useState(profile.dailyAiQuestionsRemaining ?? 2);

  const exampleQuestions = [
    'Is month kitna kharcha hua?',
    'Total available balance',
    'Which category has highest spending?',
  ];

  // Deterministic financial calculation based on real ledger
  const handleAskQuestion = async (queryText?: string) => {
    const text = queryText || chatInput;
    if (!text.trim()) return;

    if (!isPro && questionsLeft <= 0) {
      alert('You have reached the daily free limit of 2 questions. Please upgrade to Pro for unlimited AI financial intelligence.');
      onOpenUpgrade();
      return;
    }

    const newMsgs = [...messages, { role: 'user' as const, text }];
    setMessages(newMsgs);
    setChatInput('');
    setIsAnswering(true);

    if (!isPro) {
      setQuestionsLeft((prev) => Math.max(0, prev - 1));
    }

    // Ledger calculation
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

    try {
      // Call server proxy or deterministic calculation
      const res = await fetch('/api/ai/voice-expense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          preferredCurrency: prefCurrency,
        }),
      }).catch(() => null);

      let answer = '';
      const qLower = text.toLowerCase();

      if (qLower.includes('kharcha') || qLower.includes('expense') || qLower.includes('spent')) {
        answer = `Iss mahine (This Month) aapka total kharcha ${formatCurrency(monthExpense, prefCurrency)} hua hai.`;
        if (highestCat) {
          answer += ` Sabse zyada kharcha ${highestCat[0]} category mein ${formatCurrency(highestCat[1], prefCurrency)} hua hai.`;
        }
      } else if (qLower.includes('balance') || qLower.includes('available')) {
        answer = `Aapke sabhi active accounts ka consolidated available balance ${formatCurrency(totalBal, prefCurrency)} hai (${accounts.length} active accounts).`;
      } else if (qLower.includes('income') || qLower.includes('salary') || qLower.includes('kamayi')) {
        answer = `Iss mahine aapki recorded income ${formatCurrency(monthIncome, prefCurrency)} hai.`;
      } else {
        answer = `Aapka current financial summary: Total Balance: ${formatCurrency(totalBal, prefCurrency)}, Iss mahine ka kharcha: ${formatCurrency(monthExpense, prefCurrency)}, Income: ${formatCurrency(monthIncome, prefCurrency)}.`;
      }

      setMessages((prev) => [...prev, { role: 'assistant', text: answer }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `Total Balance: ${formatCurrency(totalBal, prefCurrency)}. This Month Expense: ${formatCurrency(monthExpense, prefCurrency)}. Computed strictly from your ledger.`,
        },
      ]);
    } finally {
      setIsAnswering(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-4 pb-28 space-y-4">
      {/* 1. Free Plan Banner (Screenshot 1) */}
      {!isPro && (
        <div className="bg-amber-50/50 border border-amber-200/90 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-[#0B1528] leading-tight">
                Free Plan · {questionsLeft} of 2 Daily AI Questions Remaining
              </h2>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Receipt OCR, Smart Draft Entry, Cash Flow Forecasting, and Executive AI Reports require AI Money Manager Premium.
              </p>
            </div>
          </div>

          <button
            onClick={onOpenUpgrade}
            className="w-full sm:w-auto py-2.5 px-5 rounded-xl bg-[#0B1528] hover:bg-[#111e38] text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 shadow-md active:scale-[0.99] transition cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Upgrade to Premium</span>
          </button>
        </div>
      )}

      {/* 2. AI Money Manager Card with Pill Tabs (Screenshot 1) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#0B1528] flex items-center justify-center text-white shrink-0 shadow-xs">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-[#0B1528] tracking-tight">
              AI Money Manager
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Your Personal Finance Intelligence Assistant · Context: All Accounts · This Month
            </p>
          </div>
        </div>

        {/* Segmented Pill Tabs: AI Chat, 🔒 Smart Entry & OCR, Budget Planning */}
        <div className="bg-[#EEF2F6] p-1 rounded-2xl flex items-center justify-between text-xs font-semibold text-slate-500 shadow-2xs">
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex-1 py-2 px-2 text-center rounded-xl transition cursor-pointer ${
              activeTab === 'chat'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'hover:text-slate-800'
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
            className="flex-1 py-2 px-2 text-center rounded-xl transition cursor-pointer flex items-center justify-center gap-1 text-slate-600 hover:text-slate-800"
          >
            {!isPro && <Lock className="w-3 h-3 text-slate-400" />}
            <span className="truncate">Smart Entry & OCR</span>
          </button>

          <button
            onClick={() => {
              if (!isPro) onOpenUpgrade();
              else setActiveTab('budget');
            }}
            className="flex-1 py-2 px-2 text-center rounded-xl transition cursor-pointer flex items-center justify-center gap-1 text-slate-600 hover:text-slate-800"
          >
            {!isPro && <Lock className="w-3 h-3 text-slate-400" />}
            <span className="truncate">Budget Planning</span>
          </button>
        </div>
      </div>

      {/* 3. AI Chat Card (Screenshot 1) */}
      {activeTab === 'chat' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
          <p className="text-xs text-slate-600 font-medium">
            Ask in Hindi, Hinglish, or English using your real Cloud Firestore ledger:
          </p>

          {/* Question Chips */}
          <div className="flex flex-wrap gap-2">
            {exampleQuestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleAskQuestion(q)}
                className="py-1.5 px-3 rounded-xl bg-[#EEF2F6] hover:bg-slate-200 text-xs font-semibold text-slate-700 transition cursor-pointer shadow-2xs text-left"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Conversation Stream */}
          {messages.length > 0 && (
            <div className="space-y-3 pt-2 max-h-64 overflow-y-auto">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-blue-50 text-blue-900 font-bold ml-6 border border-blue-100'
                      : 'bg-slate-50 text-slate-800 font-medium mr-6 border border-slate-200/80'
                  }`}
                >
                  {m.text}
                </div>
              ))}
              {isAnswering && (
                <div className="p-3 text-xs text-slate-400 italic">
                  Computing from ledger...
                </div>
              )}
            </div>
          )}

          {/* Chat Input Field */}
          <div className="relative pt-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion()}
              placeholder="Ask anything about your income, expenses, accounts..."
              className="w-full pl-4 pr-12 py-3 rounded-2xl border border-slate-200/90 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-2xs"
            />
            <button
              onClick={() => handleAskQuestion()}
              className="absolute right-2 top-1/2 -translate-y-1/2 mt-1 w-8 h-8 rounded-xl bg-[#0B1528] text-white flex items-center justify-center transition cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          {/* Deterministic Explanation Box */}
          <div className="pt-4 border-t border-slate-100 text-center space-y-1">
            <h4 className="text-xs font-extrabold text-[#0B1528]">
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
