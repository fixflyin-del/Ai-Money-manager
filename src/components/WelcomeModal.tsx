/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ShieldCheck, HardDrive, X } from 'lucide-react';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectGoogle: () => void;
  onSelectLocal: () => void;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({
  isOpen,
  onClose,
  onSelectGoogle,
  onSelectLocal,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl p-6 relative border border-slate-100">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1 rounded-full transition cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Heading & Shield Icon */}
        <div className="flex items-start gap-3 mb-5 pr-6">
          <div className="w-10 h-10 rounded-xl bg-[#0B1528] flex items-center justify-center text-white shrink-0 mt-0.5">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-[#0B1528] leading-tight">
              Welcome to AI Money Manager
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Choose how you want to save your accounts & financial data
            </p>
          </div>
        </div>

        {/* Option 1: Continue with Google Signup (Dark Navy Card) */}
        <div className="space-y-3">
          <button
            onClick={onSelectGoogle}
            className="w-full text-left p-4 rounded-2xl bg-[#0B1528] hover:bg-[#111e38] text-white transition-all shadow-md active:scale-[0.99] cursor-pointer flex items-center gap-3.5"
          >
            {/* Google Logo */}
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-xs">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            </div>

            <div className="min-w-0 flex-1">
              <div className="font-bold text-xs sm:text-sm text-white leading-snug">
                Continue with Google Signup & Save Your Data
              </div>
              <div className="text-[11px] text-slate-300 mt-0.5 leading-tight">
                Direct Google account approval · Safe cloud sync & backup
              </div>
            </div>
          </button>

          {/* Option 2: Continue with Local Storage (Light Grey Card) */}
          <button
            onClick={onSelectLocal}
            className="w-full text-left p-4 rounded-2xl bg-[#F1F5F9] hover:bg-slate-200/80 text-slate-800 transition-all border border-slate-200/90 active:scale-[0.99] cursor-pointer flex items-center gap-3.5"
          >
            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center shrink-0 shadow-xs">
              <HardDrive className="w-5 h-5 text-slate-700" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="font-bold text-xs sm:text-sm text-slate-900 leading-snug">
                Continue with Local Storage
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                Start immediately without sign-in · Connect Google anytime in Profile
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
