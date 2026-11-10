/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Crown, Sparkles, Check, X, ShieldCheck, CheckCircle2, Lock } from 'lucide-react';
import confetti from 'canvas-confetti';
import { UserProfile } from '../types/finance';
import { processWebCheckout } from '../services/subscriptionService';
import { StorageService } from '../services/storageService';
import { IS_TEMPORARY_FREE_LAUNCH } from '../services/entitlementService';

interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onUpdateProfile: (updated: UserProfile) => void;
}

export const PremiumModal: React.FC<PremiumModalProps> = ({
  isOpen,
  onClose,
  profile,
  onUpdateProfile,
}) => {
  const [billingRegion, setBillingRegion] = useState<'IN' | 'GLOBAL'>(
    profile.subscription.billingRegion || 'IN'
  );
  const [activeTab, setActiveTab] = useState<'plans' | 'compare'>('plans');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubscribe = async (planId: 'monthly' | 'annual' | 'lifetime') => {
    if (IS_TEMPORARY_FREE_LAUNCH) {
      setStatusMsg('🎉 All Premium features are already 100% unlocked for your account during our launch celebration!');
      return;
    }

    setIsProcessing(true);
    setStatusMsg(null);

    const res = await processWebCheckout(planId, billingRegion, profile);
    setIsProcessing(false);

    if (res.success) {
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      const updated = StorageService.getUserProfile();
      onUpdateProfile(updated);
      setStatusMsg(`Success! You are now Pro subscribed via ${res.gateway}.`);
      setTimeout(() => {
        onClose();
      }, 1500);
    } else {
      setStatusMsg(res.message || 'Payment processing failed.');
    }
  };

  const freeFeatures = [
    'Basic Dashboard',
    'Account Management',
    'Income and Expense Tracking',
    'Basic Monthly Analysis',
    'Per-Account Basic Analysis',
    'Basic Category Analysis',
    'Transaction Management',
    'One AI Chat Question Per Day',
    'Basic Financial Summary',
  ];

  const premiumFeatures = [
    'All Free Features Included',
    'Unlimited AI Chat (Fair-use controls)',
    'Deep Financial Intelligence & Health Score',
    'Advanced AI Financial Insights',
    'Executive AI Financial Reports',
    'Advanced PDF & Excel Export Reports',
    'Receipt Scanner OCR with Gemini AI',
    'Smart AI Entry & Voice Parsing',
    'Advanced Budget Planner & Alerts',
    'Cashflow Forecasting & Burn Rate',
    'All 6 Interactive Analytics Charts',
    'Weekly, Yearly and Custom Date Filters',
    'Advanced Per-Account Drilldowns',
    'Category Transaction Drilldowns',
    'Advanced Financial Recommendations',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-2xs animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg p-6 shadow-2xl border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto space-y-4 text-slate-900 dark:text-white">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-700/50 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <Crown className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#0B1528] dark:text-white">AI Money Manager Premium</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Personal & Business Financial Intelligence</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Launch Celebration Banner */}
        {IS_TEMPORARY_FREE_LAUNCH && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700/60 text-emerald-900 dark:text-emerald-200 space-y-1">
            <div className="flex items-center gap-2 font-extrabold text-xs text-emerald-700 dark:text-emerald-300">
              <Sparkles className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>LAUNCH CELEBRATION — ALL FEATURES 100% UNLOCKED</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
              In celebration of Fixfly Innovations' official production launch, all 15+ Pro capabilities (6 interactive charts, unlimited AI queries, Gemini OCR scanner, and statements) are provided complimentary to every user.
            </p>
          </div>
        )}

        {/* Tab Switcher: Plans vs Comparison */}
        <div className="flex bg-[#EEF2F6] dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setActiveTab('plans')}
            className={`flex-1 py-1.5 rounded-lg transition cursor-pointer text-center ${
              activeTab === 'plans'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Subscription Plans
          </button>
          <button
            onClick={() => setActiveTab('compare')}
            className={`flex-1 py-1.5 rounded-lg transition cursor-pointer text-center ${
              activeTab === 'compare'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Free vs Premium Comparison
          </button>
        </div>

        {/* Billing Region Selector */}
        <div className="bg-slate-50 dark:bg-slate-800/60 p-1 rounded-xl flex items-center justify-between text-xs font-semibold text-slate-500 border border-slate-200/60 dark:border-slate-700/60">
          <button
            onClick={() => setBillingRegion('IN')}
            className={`flex-1 py-1.5 px-2 rounded-lg transition cursor-pointer text-center ${
              billingRegion === 'IN'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-bold shadow-xs'
                : 'hover:text-slate-800'
            }`}
          >
            🇮🇳 India (INR ₹ · PayU / UPI)
          </button>
          <button
            onClick={() => setBillingRegion('GLOBAL')}
            className={`flex-1 py-1.5 px-2 rounded-lg transition cursor-pointer text-center ${
              billingRegion === 'GLOBAL'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-bold shadow-xs'
                : 'hover:text-slate-800'
            }`}
          >
            🌐 International (USD $ · Card / Play)
          </button>
        </div>

        {statusMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-800 dark:text-emerald-300">
            {statusMsg}
          </div>
        )}

        {/* VIEW 1: PLANS */}
        {activeTab === 'plans' && (
          <div className="space-y-3">
            {/* Monthly Plan */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between hover:border-blue-400 dark:hover:border-blue-500 transition">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                  Flexible Monthly
                </span>
                <span className="text-base font-extrabold text-[#0B1528] dark:text-white">Pro Monthly</span>
                <div className="text-xs text-slate-500 dark:text-slate-400">Billed monthly · Cancel anytime</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-extrabold font-mono-numbers text-slate-900 dark:text-white">
                  {billingRegion === 'IN' ? '₹49' : '$0.99'}
                  <span className="text-xs text-slate-400 font-normal"> / mo</span>
                </div>
                {IS_TEMPORARY_FREE_LAUNCH ? (
                  <button
                    disabled
                    className="mt-1.5 py-1.5 px-3 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-xs flex items-center justify-end gap-1 cursor-default ml-auto"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Active Free</span>
                  </button>
                ) : (
                  <button
                    disabled={isProcessing}
                    onClick={() => handleSubscribe('monthly')}
                    className="mt-1.5 py-1.5 px-4 rounded-xl bg-[#0B1528] dark:bg-blue-600 text-white font-bold text-xs shadow-xs hover:bg-[#15233e] transition cursor-pointer"
                  >
                    Choose Monthly
                  </button>
                )}
              </div>
            </div>

            {/* Annual Plan (Best Value Badge) */}
            <div className="border-2 border-blue-600 dark:border-blue-500 bg-blue-50/30 dark:bg-blue-950/20 rounded-2xl p-4 flex items-center justify-between relative shadow-xs">
              <div className="absolute -top-2.5 right-4 bg-blue-600 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Most Popular · Save 60%
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400 block">
                  Full 1 Year Access
                </span>
                <span className="text-base font-extrabold text-[#0B1528] dark:text-white">Pro Annual</span>
                <div className="text-xs text-slate-500 dark:text-slate-400">Only ~₹41/month equivalent</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-extrabold font-mono-numbers text-blue-600 dark:text-blue-400">
                  {billingRegion === 'IN' ? '₹499' : '$9.99'}
                  <span className="text-xs text-slate-400 font-normal"> / yr</span>
                </div>
                {IS_TEMPORARY_FREE_LAUNCH ? (
                  <button
                    disabled
                    className="mt-1.5 py-1.5 px-3 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-xs flex items-center justify-end gap-1 cursor-default ml-auto"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Active Free</span>
                  </button>
                ) : (
                  <button
                    disabled={isProcessing}
                    onClick={() => handleSubscribe('annual')}
                    className="mt-1.5 py-1.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition cursor-pointer"
                  >
                    Choose Annual
                  </button>
                )}
              </div>
            </div>

            {/* Lifetime Plan */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between hover:border-amber-400 transition">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400 block">
                  One-Time Payment
                </span>
                <span className="text-base font-extrabold text-[#0B1528] dark:text-white">Lifetime Pro</span>
                <div className="text-xs text-slate-500 dark:text-slate-400">Never pay again · Forever updates</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-extrabold font-mono-numbers text-amber-600 dark:text-amber-400">
                  {billingRegion === 'IN' ? '₹1,450' : '$29.99'}
                </div>
                {IS_TEMPORARY_FREE_LAUNCH ? (
                  <button
                    disabled
                    className="mt-1.5 py-1.5 px-3 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-xs flex items-center justify-end gap-1 cursor-default ml-auto"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Active Free</span>
                  </button>
                ) : (
                  <button
                    disabled={isProcessing}
                    onClick={() => handleSubscribe('lifetime')}
                    className="mt-1.5 py-1.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                  >
                    Get Lifetime
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: FREE VS PREMIUM COMPARISON (Requirement 10) */}
        {activeTab === 'compare' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {/* Free Column */}
              <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2">
                <div className="border-b border-slate-200 dark:border-slate-700 pb-2">
                  <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200 block">FREE PLAN</span>
                  <span className="text-[11px] text-slate-400">Standard Access (₹0)</span>
                </div>
                <div className="space-y-1.5 text-[11px]">
                  {freeFeatures.map((f, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-slate-600 dark:text-slate-300">
                      <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Premium Column */}
              <div className="p-3.5 rounded-2xl border-2 border-blue-600 dark:border-blue-500 bg-blue-50/30 dark:bg-blue-950/20 space-y-2">
                <div className="border-b border-blue-200 dark:border-blue-800 pb-2 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-extrabold text-blue-700 dark:text-blue-300 block">PREMIUM PLAN</span>
                    <span className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold">
                      From {billingRegion === 'IN' ? '₹49/mo' : '$0.99/mo'}
                    </span>
                  </div>
                  <Crown className="w-4 h-4 text-amber-500 shrink-0" />
                </div>
                <div className="space-y-1.5 text-[11px]">
                  {premiumFeatures.map((f, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-slate-800 dark:text-slate-100 font-medium">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2 text-center">
              {IS_TEMPORARY_FREE_LAUNCH ? (
                <button
                  onClick={onClose}
                  className="py-2.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition cursor-pointer"
                >
                  Enjoy All Features Free
                </button>
              ) : (
                <button
                  onClick={() => setActiveTab('plans')}
                  className="py-2.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition cursor-pointer"
                >
                  View Plans & Upgrade Now
                </button>
              )}
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>256-bit Encrypted Checkout · PayU & Google Play Certified</span>
          </div>
        </div>
      </div>
    </div>
  );
};
