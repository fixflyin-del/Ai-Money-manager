/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const [revealed, setRevealed] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const tReveal = setTimeout(() => setRevealed(true), 100);
    const tExit = setTimeout(() => setExiting(true), 1350);
    const tDone = setTimeout(() => onFinish(), 1650);

    return () => {
      clearTimeout(tReveal);
      clearTimeout(tExit);
      clearTimeout(tDone);
    };
  }, [onFinish]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-between px-6 pt-[calc(2.5rem+env(safe-area-inset-top,0px))] pb-[calc(2.5rem+env(safe-area-inset-bottom,0px))] bg-[#070D19] text-white transition-opacity duration-300 ${
        exiting ? 'opacity-0' : 'opacity-100'
      }`}
      role="status"
      aria-label="Loading AI Money Manager"
    >
      <div className="h-6" aria-hidden="true" />

      {/* Center Minimalist Brand Lockup */}
      <div className="flex flex-col items-center text-center max-w-xs w-full">
        <div
          className={`w-20 h-20 rounded-[24px] bg-gradient-to-br from-slate-800/90 to-slate-950 border border-white/15 shadow-2xl shadow-emerald-950/40 flex items-center justify-center transition-all duration-500 ease-out ${
            revealed ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
          }`}
        >
          <svg
            viewBox="0 0 40 40"
            className="w-10 h-10"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <rect x="6" y="22" width="6" height="12" rx="2" fill="#34D399" fillOpacity="0.45" />
            <rect x="17" y="15" width="6" height="19" rx="2" fill="#34D399" fillOpacity="0.75" />
            <rect x="28" y="8" width="6" height="26" rx="2" fill="#34D399" />
            <path
              d="M9 17L19.5 9.5L31 6"
              stroke="#FFFFFF"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div
          className={`mt-7 space-y-1.5 transition-all duration-500 delay-75 ease-out ${
            revealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2.5'
          }`}
        >
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-white [text-wrap:balance]">
            AI Money Manager
          </h1>
          <p className="text-sm font-medium text-slate-400">
            Personal Finance Intelligence
          </p>
        </div>

        {/* Hairline Compositor-Only Progress Track */}
        <div className="mt-9 w-36 h-[3px] rounded-full bg-white/10 overflow-hidden">
          <div className="h-full w-full rounded-full bg-emerald-400 animate-splash-progress" />
        </div>
      </div>

      {/* Quiet Brand Attribution */}
      <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span>FixFly Innovations</span>
      </div>
    </div>
  );
};
