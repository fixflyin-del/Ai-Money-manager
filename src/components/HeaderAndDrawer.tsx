/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Menu,
  User,
  X,
  Home,
  Layers,
  BarChart3,
  Brain,
  Mail,
  CloudDownload,
  Crown,
  ChevronRight,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { CurrencyCode, UserProfile } from '../types/finance';
import { formatCurrency } from '../services/currencyService';

export type NavTab = 'home' | 'manage' | 'add' | 'analysis' | 'ai_manager' | 'profile' | 'backup' | 'admin';

interface HeaderAndDrawerProps {
  profile: UserProfile;
  totalBalance: number;
  accountCount: number;
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  isDrawerOpen: boolean;
  setIsDrawerOpen: (open: boolean) => void;
  onOpenUpgrade: () => void;
}

export const HeaderAndDrawer: React.FC<HeaderAndDrawerProps> = ({
  profile,
  totalBalance,
  accountCount,
  onTabChange,
  isDrawerOpen,
  setIsDrawerOpen,
  onOpenUpgrade,
}) => {
  const prefCurrency = profile.preferredCurrency;
  const displayName = profile.name.trim() || 'Al Money Manager';

  return (
    <>
      {/* Top Global Header (Screenshots 1, 2, 4, 5, 7, 8) */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-2.5 flex items-center justify-between shadow-2xs">
        {/* Left: Hamburger & User Display Name */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={() => setIsDrawerOpen(true)}
            aria-label="Open menu"
            className="w-10 h-10 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-700 transition cursor-pointer shrink-0 shadow-2xs"
          >
            <Menu className="w-5 h-5" />
          </button>

          <span
            className="text-sm sm:text-base font-extrabold text-[#0B1528] tracking-tight truncate max-w-[130px] sm:max-w-xs"
            title={displayName}
          >
            {displayName}
          </span>
        </div>

        {/* Right: Consolidated Total Balance Card & Profile Button */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="bg-white border border-slate-200/90 rounded-xl px-3 py-1 text-right flex flex-col justify-center shadow-2xs">
            <span className="text-[9px] font-bold tracking-wider text-slate-400 uppercase font-mono">
              TOTAL BALANCE
            </span>
            <span className="text-xs sm:text-sm font-extrabold font-mono-numbers text-emerald-500">
              {formatCurrency(totalBalance, prefCurrency)}
            </span>
          </div>

          <button
            onClick={() => onTabChange('profile')}
            aria-label="Open profile"
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200/80 border border-slate-200 flex items-center justify-center text-slate-700 transition cursor-pointer shrink-0"
          >
            <User className="w-4 h-4 text-slate-600" />
          </button>
        </div>
      </header>

      {/* Side Drawer (Screenshot 6) */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex animate-in fade-in duration-200">
          {/* Backdrop */}
          <div
            onClick={() => setIsDrawerOpen(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-2xs"
          />

          {/* Drawer Panel */}
          <div className="relative w-4/5 max-w-sm bg-white h-full shadow-2xl flex flex-col justify-between p-5 overflow-y-auto z-10 animate-in slide-in-from-left duration-200">
            {/* Top Header Section */}
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-[#0B1528] flex items-center justify-center text-white shrink-0">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-[#0B1528] leading-tight truncate max-w-[180px]">
                      {displayName}
                    </h3>
                    <span className="text-xs text-slate-500 font-medium">
                      {profile.subscription.isPro ? 'Pro Member · Lifetime' : 'Free Plan · Standard'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Total Balance Card with Home Shortcut */}
              <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-slate-200/80 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-500 font-medium block">
                    Total Balance ({accountCount} accounts)
                  </span>
                  <span className="text-lg font-extrabold font-mono-numbers text-[#0B1528] mt-0.5 block">
                    {formatCurrency(totalBalance, prefCurrency)}
                  </span>
                </div>

                <button
                  onClick={() => {
                    onTabChange('home');
                    setIsDrawerOpen(false);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                >
                  <Home className="w-3.5 h-3.5 text-slate-500" />
                  <span>Home</span>
                </button>
              </div>

              {/* Navigation Menu List */}
              <div className="divide-y divide-slate-100 pt-1">
                {/* Manage */}
                <button
                  onClick={() => {
                    onTabChange('manage');
                    setIsDrawerOpen(false);
                  }}
                  className="w-full py-3.5 flex items-center justify-between text-left hover:bg-slate-50 px-2 rounded-xl transition cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">Manage</div>
                      <div className="text-[11px] text-slate-500">Accounts, categories, statements & ...</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                {/* Analysis */}
                <button
                  onClick={() => {
                    onTabChange('analysis');
                    setIsDrawerOpen(false);
                  }}
                  className="w-full py-3.5 flex items-center justify-between text-left hover:bg-slate-50 px-2 rounded-xl transition cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                      <BarChart3 className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <span>Analysis</span>
                        <Lock className="w-3 h-3 text-amber-500" />
                      </div>
                      <div className="text-[11px] text-slate-500">Limited free preview · Full access in ...</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                {/* AI Manager */}
                <button
                  onClick={() => {
                    onTabChange('ai_manager');
                    setIsDrawerOpen(false);
                  }}
                  className="w-full py-3.5 flex items-center justify-between text-left hover:bg-slate-50 px-2 rounded-xl transition cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                      <Brain className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <span>AI Manager</span>
                        <Lock className="w-3 h-3 text-amber-500" />
                      </div>
                      <div className="text-[11px] text-slate-500">Limited free usage · Full access in Pr...</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                {/* Support */}
                <a
                  href="mailto:info@fixfly.in"
                  className="w-full py-3.5 flex items-center justify-between text-left hover:bg-slate-50 px-2 rounded-xl transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">Support</div>
                      <div className="text-[11px] text-slate-500">Email help desk · info@fixfly.in</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </a>

                {/* Backup */}
                <button
                  onClick={() => {
                    onTabChange('profile');
                    setIsDrawerOpen(false);
                  }}
                  className="w-full py-3.5 flex items-center justify-between text-left hover:bg-slate-50 px-2 rounded-xl transition cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                      <CloudDownload className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">Backup</div>
                      <div className="text-[11px] text-slate-500">Cloud snapshots, JSON restore & ex...</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                {/* Admin Portal (/admin) */}
                <button
                  onClick={() => {
                    onTabChange('admin');
                    setIsDrawerOpen(false);
                  }}
                  className="w-full py-3.5 flex items-center justify-between text-left hover:bg-slate-50 px-2 rounded-xl transition cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#0B1528] flex items-center justify-center text-white">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <span>Admin Portal</span>
                        <span className="text-[9px] bg-slate-100 text-slate-600 px-1 rounded font-mono font-bold">/admin</span>
                      </div>
                      <div className="text-[11px] text-slate-500">Users, subscriptions & push</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Bottom Section: Premium Card & Footer */}
            <div className="pt-4 space-y-3">
              <button
                onClick={() => {
                  onOpenUpgrade();
                  setIsDrawerOpen(false);
                }}
                className="w-full p-4 rounded-2xl bg-[#0B1528] text-white flex items-center justify-between text-left shadow-lg active:scale-[0.99] transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                    <Crown className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white leading-snug">Upgrade to Premium</div>
                    <div className="text-[11px] text-slate-300">
                      Plans from {prefCurrency === 'INR' ? '₹49/mo' : '$0.99/mo'} · PayU Checkout
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 px-1">
                <span>Al Money Manager</span>
                <span>info@fixfly.in</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
