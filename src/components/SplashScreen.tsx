/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Brain, Sparkles, ShieldCheck } from 'lucide-react';

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const [stage, setStage] = useState<'icon' | 'reveal' | 'ready'>('icon');

  useEffect(() => {
    const t1 = setTimeout(() => setStage('reveal'), 400);
    const t2 = setTimeout(() => setStage('ready'), 900);
    const t3 = setTimeout(() => onFinish(), 1350);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onFinish]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between py-12 px-6 bg-white animate-in fade-in duration-300">
      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-5">
        {/* Dark Navy Brand Icon with Brain Visual */}
        <div
          className={`w-20 h-20 rounded-2xl bg-[#0B1528] flex items-center justify-center text-white shadow-xl shadow-slate-900/10 transition-all duration-700 ${
            stage === 'icon' ? 'scale-90 opacity-80' : 'scale-100 opacity-100'
          }`}
        >
          <div className="relative">
            <Brain className="w-10 h-10 text-white" />
            <Sparkles className="w-4 h-4 text-emerald-400 absolute -top-1 -right-1 animate-pulse" />
          </div>
        </div>

        {/* Title & Tagline */}
        <div className={`transition-all duration-500 ${stage === 'icon' ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`}>
          <h1 className="text-2xl font-extrabold text-[#0B1528] tracking-tight">
            AI Money Manager
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Personal Finance Intelligence Assistant
          </p>
        </div>

        {/* Loading Indicator */}
        <div className="pt-4 flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
          <div className="w-2 h-2 rounded-full bg-blue-600" />
          <div className="w-2 h-2 rounded-full bg-blue-600" />
        </div>
      </div>

      {/* Footer Branding */}
      <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
        <span>FixFly Financial Technologies</span>
      </div>
    </div>
  );
};
