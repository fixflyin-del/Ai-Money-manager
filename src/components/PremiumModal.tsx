/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Crown, Sparkles, Check, X, ShieldCheck } from 'lucide-react';
import confetti from 'canvas-confetti';
import { UserProfile } from '../types/finance';
import { processWebCheckout } from '../services/subscriptionService';
import { StorageService } from '../services/storageService';

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
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubscribe = async (planId: 'monthly' | 'annual' | 'lifetime') => {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-2xs animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#0B1528]">Upgrade to Premium</h3>
              <p className="text-xs text-slate-500">Unlock all charts, OCR & AI Intelligence</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Billing Region Selector */}
        <div className="bg-[#EEF2F6] p-1 rounded-xl flex items-center justify-between text-xs font-semibold text-slate-500">
          <button
            onClick={() => setBillingRegion('IN')}
            className={`flex-1 py-1.5 px-2 rounded-lg transition cursor-pointer text-center ${
              billingRegion === 'IN' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'hover:text-slate-800'
            }`}
          >
            🇮🇳 India (INR ₹)
          </button>
          <button
            onClick={() => setBillingRegion('GLOBAL')}
            className={`flex-1 py-1.5 px-2 rounded-lg transition cursor-pointer text-center ${
              billingRegion === 'GLOBAL' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'hover:text-slate-800'
            }`}
          >
            🌐 Global (USD $)
          </button>
        </div>

        {statusMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800">
            {statusMsg}
          </div>
        )}

        {/* Plans */}
        <div className="space-y-3">
          {/* Annual Plan (Best Value) */}
          <div className="p-4 rounded-2xl bg-amber-50/60 border-2 border-amber-400/90 relative space-y-2">
            <span className="absolute -top-2.5 right-4 px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#0B1528] text-white">
              SAVE 20%
            </span>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-[#0B1528]">Pro Annual</div>
                <div className="text-[11px] text-slate-500">1 Year unlimited access</div>
              </div>
              <div className="text-lg font-extrabold font-mono-numbers text-[#0B1528]">
                {billingRegion === 'IN' ? '₹499 / yr' : '$9.99 / yr'}
              </div>
            </div>

            <button
              disabled={isProcessing}
              onClick={() => handleSubscribe('annual')}
              className="w-full py-2.5 rounded-xl bg-[#0B1528] hover:bg-[#111e38] text-white font-bold text-xs shadow-md transition cursor-pointer"
            >
              {isProcessing ? 'Verifying...' : `Subscribe Annual (${billingRegion === 'IN' ? 'PayU' : 'Card'})`}
            </button>
          </div>

          {/* Monthly Plan */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-[#0B1528]">Pro Monthly</div>
              <div className="text-[11px] text-slate-500">Billed monthly</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-extrabold font-mono-numbers text-[#0B1528] mb-1">
                {billingRegion === 'IN' ? '₹49 / mo' : '$0.99 / mo'}
              </div>
              <button
                disabled={isProcessing}
                onClick={() => handleSubscribe('monthly')}
                className="py-1 px-3 rounded-lg bg-white border border-slate-300 text-slate-800 font-bold text-xs hover:bg-slate-100 shadow-2xs"
              >
                Select
              </button>
            </div>
          </div>

          {/* Lifetime Access */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-[#0B1528]">Pro Lifetime</div>
              <div className="text-[11px] text-slate-500">Pay once, own forever</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-extrabold font-mono-numbers text-[#0B1528] mb-1">
                {billingRegion === 'IN' ? '₹1,450' : '$29.99'}
              </div>
              <button
                disabled={isProcessing}
                onClick={() => handleSubscribe('lifetime')}
                className="py-1 px-3 rounded-lg bg-white border border-slate-300 text-slate-800 font-bold text-xs hover:bg-slate-100 shadow-2xs"
              >
                Select
              </button>
            </div>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="pt-2 border-t border-slate-100 text-xs space-y-1.5 text-slate-600">
          <div className="flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            <span>All 6 interactive analytics charts & custom filters</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            <span>Unlimited Gemini AI Receipt OCR & Smart Draft</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            <span>Shared entitlement across Web and Android APK</span>
          </div>
        </div>
      </div>
    </div>
  );
};
