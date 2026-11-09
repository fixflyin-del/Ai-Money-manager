/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  X,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { FinancialHealthInsight, UserProfile } from '../types/finance';
import { AiService } from '../services/aiService';

interface AiAdvisorModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpense: number;
  topCategories: { category: string; amount: number }[];
}

export const AiAdvisorModal: React.FC<AiAdvisorModalProps> = ({
  isOpen,
  onClose,
  profile,
  totalBalance,
  monthlyIncome,
  monthlyExpense,
  topCategories,
}) => {
  const [insight, setInsight] = useState<FinancialHealthInsight | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadAdvice = async () => {
    setIsLoading(true);
    try {
      const data = await AiService.getFinancialAdvice({
        totalBalance,
        monthlyIncome,
        monthlyExpense,
        currency: profile.preferredCurrency,
        topCategories,
      });
      setInsight(data);
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAdvice();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#1E293B] border border-slate-700 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Gemini AI Financial Advisor</h3>
              <p className="text-[11px] text-slate-400">Intelligent spending audits, anomalies & savings velocity</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadAdvice}
              disabled={isLoading}
              title="Refresh Audit"
              className="text-slate-400 hover:text-emerald-400 p-1 rounded-lg transition"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {isLoading || !insight ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <Sparkles className="w-8 h-8 text-emerald-400 animate-spin" />
              <div className="text-xs font-semibold text-slate-300">
                Gemini 2.5 Flash auditing cashflow & budget anomalies...
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Score Header Card */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-[#1E293B] border border-emerald-500/30 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Financial Health Score
                  </span>
                  <div className="text-3xl font-extrabold font-mono-numbers text-white mt-1">
                    {insight.score} <span className="text-xs font-sans text-slate-400 font-normal">/ 100</span>
                  </div>
                  <div className="text-xs font-bold text-emerald-400 mt-0.5">{insight.rating}</div>
                </div>

                <div className="text-right">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Monthly Savings Rate
                  </span>
                  <div className="text-2xl font-extrabold font-mono-numbers text-indigo-400 mt-1">
                    {insight.monthlySavingsRate}%
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                {insight.summary}
              </div>

              {/* Anomalies Detected */}
              {insight.anomalies && insight.anomalies.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Spending Anomalies & Spikes</span>
                  </div>
                  <div className="space-y-1.5">
                    {insight.anomalies.map((anom, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200"
                      >
                        {anom}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actionable Tips */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                  <Lightbulb className="w-4 h-4" />
                  <span>Actionable Wealth Recommendations</span>
                </div>

                <div className="space-y-2">
                  {insight.tips.map((tip, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-white">{tip.title}</span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded uppercase ${
                            tip.impact === 'high'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-indigo-500/20 text-indigo-400'
                          }`}
                        >
                          {tip.impact} impact
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">{tip.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
