/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Home,
  Layers,
  BarChart3,
  Brain,
  User,
  CloudDownload,
  Mail,
  Crown,
  Lock,
  Sparkles,
  ChevronRight,
  Sun,
  Moon,
  Wallet,
  Monitor,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import { NavTab } from './HeaderAndDrawer';
import { UserProfile } from '../types/finance';
import { formatCurrency } from '../services/currencyService';
import { EntitlementService } from '../services/entitlementService';

interface DesktopSidebarProps {
  profile: UserProfile;
  totalBalance: number;
  accountCount: number;
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onOpenUpgrade: () => void;
  onToggleDarkMode: () => void;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  profile,
  totalBalance,
  accountCount,
  activeTab,
  onTabChange,
  onOpenUpgrade,
  onToggleDarkMode,
}) => {
  const prefCurrency = profile.preferredCurrency;
  const isPro = EntitlementService.isPro(profile);
  const isLoggedIn = Boolean(
    profile.firebaseUid &&
    profile.firebaseUid !== 'guest' &&
    profile.storageMode === 'cloud'
  );

  const cleanName = profile.name.trim();
  const isDefaultOrGeneric = !cleanName || cleanName.toLowerCase() === 'ai money manager' || cleanName.toLowerCase() === 'fixfly';
  const displayName = isLoggedIn
    ? (!isDefaultOrGeneric ? cleanName : (profile.email ? profile.email.split('@')[0] : 'Member'))
    : 'AI Money Manager';
  const subtitle = isLoggedIn ? 'Verified Member' : 'Guest • Local Mode';
  const initialLetter = isLoggedIn ? displayName.charAt(0).toUpperCase() : 'AI';

  const navItems = [
    { id: 'home' as NavTab, label: 'Home / Dashboard', icon: Home, isProRequired: false },
    { id: 'manage' as NavTab, label: 'Manage Accounts & Categories', icon: Layers, isProRequired: false },
    { id: 'analysis' as NavTab, label: 'Financial Analysis', icon: BarChart3, isProRequired: false, lockNotice: !isPro },
    { id: 'ai_manager' as NavTab, label: 'AI Money Manager', icon: Brain, isProRequired: false, lockNotice: !isPro },
    { id: 'profile' as NavTab, label: 'Profile & Multi-Currency', icon: User, isProRequired: false },
    { id: 'backup' as NavTab, label: 'Cloud & Local Backup', icon: CloudDownload, isProRequired: false },
  ];

  return (
    <aside className="w-64 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200/90 dark:border-slate-800 flex flex-col justify-between h-screen sticky top-0 z-40 select-none">
      {/* Brand & Logo */}
      <div className="p-5 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0B1528] dark:bg-blue-600 flex items-center justify-center text-white shadow-xs">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-[#0B1528] dark:text-white tracking-tight leading-tight">
              AI Money Manager
            </h1>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Personal & Business
            </span>
          </div>
        </div>

        {/* Consolidated Balance Card */}
        <div className="p-3.5 rounded-2xl bg-[#F8FAFC] dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase font-mono">
              TOTAL BALANCE
            </span>
            <span className="text-[10px] font-semibold text-slate-400">
              {accountCount} {accountCount === 1 ? 'account' : 'accounts'}
            </span>
          </div>
          <div className="text-lg font-extrabold font-mono-numbers text-emerald-600 dark:text-emerald-400 mt-1">
            {formatCurrency(totalBalance, prefCurrency)}
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                  isActive
                    ? 'bg-[#0B1528] dark:bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-3 truncate">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.lockNotice && !isActive && (
                  <Lock className="w-3 h-3 text-amber-500 shrink-0" />
                )}
              </button>
            );
          })}

          {/* Support Link */}
          <a
            href="mailto:info@fixfly.in"
            className="w-full px-3 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 flex items-center justify-between transition"
          >
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-slate-400" />
              <span>Support Desk</span>
            </div>
            <span className="text-[10px] text-slate-400">Email</span>
          </a>

          {/* Desktop Website Portal Link */}
          <a
            href="https://aimoneymanager.pro"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full px-3 py-2.5 rounded-xl text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 flex items-center justify-between transition group"
          >
            <div className="flex items-center gap-3">
              <Monitor className="w-4 h-4 text-blue-500 group-hover:scale-105 transition-transform" />
              <span>Website Portal</span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
          </a>
        </nav>
      </div>

      {/* Bottom Section: User Status Bar */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#0B1528] dark:bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
              {profile.photoUrl ? (
                <img src={profile.photoUrl} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                initialLetter
              )}
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-slate-800 dark:text-white truncate block max-w-[120px]">
                {displayName}
              </span>
              <div className={`flex items-center gap-1 text-[10px] font-bold ${isLoggedIn ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                {isLoggedIn && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                <span>{subtitle}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onToggleDarkMode}
            aria-label="Toggle theme"
            className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            {profile.darkModeEnabled ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </aside>
  );
};
