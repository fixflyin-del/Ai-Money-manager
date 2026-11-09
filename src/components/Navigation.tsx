/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  LayoutDashboard,
  ReceiptText,
  PieChart,
  Target,
  Settings as SettingsIcon,
  Plus,
  Sparkles,
  ShieldCheck,
  Globe2,
  Crown,
} from 'lucide-react';
import { CurrencyCode, UserProfile } from '../types/finance';
import { getCurrencyInfo } from '../services/currencyService';

export type NavTab = 'dashboard' | 'transactions' | 'analytics' | 'budgets' | 'settings';

interface NavigationProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onQuickAdd: () => void;
  onOpenAiAdvisor: () => void;
  onOpenUpgrade: () => void;
  profile: UserProfile;
  exchangeRateLastUpdated: string;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onTabChange,
  onQuickAdd,
  onOpenAiAdvisor,
  onOpenUpgrade,
  profile,
}) => {
  const currencyInfo = getCurrencyInfo(profile.preferredCurrency);

  const navItems = [
    { id: 'dashboard' as NavTab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'transactions' as NavTab, label: 'Transactions', icon: ReceiptText },
    { id: 'analytics' as NavTab, label: 'Analytics', icon: PieChart },
    { id: 'budgets' as NavTab, label: 'Budgets & Goals', icon: Target },
    { id: 'settings' as NavTab, label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <>
      {/* Top Header Bar for Desktop & Mobile */}
      <header className="sticky top-0 z-30 bg-[#0F172A]/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Brand Logo & FixFly Tagline */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/20">
              <div className="w-full h-full bg-[#0F172A] rounded-[10px] flex items-center justify-center">
                <span className="text-emerald-400 font-bold text-lg font-mono-numbers">₹$</span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-base sm:text-lg tracking-tight text-white flex items-center gap-1.5">
                  AI Money Manager
                </h1>
                {profile.subscription.isPro ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gradient-to-r from-amber-500/20 to-indigo-500/20 text-amber-300 border border-amber-500/30">
                    <Crown className="w-3 h-3 text-amber-400" /> PRO
                  </span>
                ) : (
                  <button
                    onClick={onOpenUpgrade}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-500/40 transition cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" /> Get Pro
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="text-emerald-400 font-medium">FixFly</span>
                <span>•</span>
                <span className="hidden sm:inline">aimoney.fixfly.in</span>
                <span className="hidden sm:inline">•</span>
                <span className="inline-flex items-center gap-1 text-slate-400">
                  <ShieldCheck className="w-3 h-3 text-emerald-500" />
                  {profile.storageMode === 'cloud' ? 'Cloud Synced' : 'Offline Secure'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Action Badges */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Currency Pill */}
            <button
              onClick={() => onTabChange('settings')}
              title="Change Display Currency"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-medium text-slate-200 transition cursor-pointer"
            >
              <Globe2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>{currencyInfo.flag}</span>
              <span className="font-mono-numbers font-semibold text-emerald-400">{currencyInfo.code}</span>
              <span className="text-slate-400">({currencyInfo.symbol})</span>
            </button>

            {/* AI Advisor Button */}
            <button
              onClick={onOpenAiAdvisor}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-medium transition cursor-pointer shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span className="hidden md:inline">AI Advisor</span>
            </button>

            {/* Quick Add Button (Desktop) */}
            <button
              onClick={onQuickAdd}
              className="hidden md:flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/30 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Transaction</span>
            </button>
          </div>
        </div>
      </header>

      {/* Desktop Navigation Tabs */}
      <nav className="hidden md:block bg-[#0F172A] border-b border-slate-800/80 px-6">
        <div className="max-w-7xl mx-auto flex gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition cursor-pointer ${
                  isActive
                    ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Mobile Floating Quick Action Button (+) */}
      <div className="md:hidden fixed bottom-20 right-5 z-40">
        <button
          onClick={onQuickAdd}
          aria-label="Add Transaction"
          className="w-14 h-14 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-xl shadow-emerald-500/40 flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer border border-emerald-400/40"
        >
          <Plus className="w-7 h-7" />
        </button>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#0F172A]/95 backdrop-blur-lg border-t border-slate-800 px-2 py-1.5 pb-safe">
        <div className="flex items-center justify-around">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-colors cursor-pointer ${
                  isActive ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-emerald-400 scale-110' : ''} transition-transform`} />
                <span className="text-[10px] font-medium mt-1 truncate max-w-[64px]">
                  {item.label.split(' ')[0]}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
