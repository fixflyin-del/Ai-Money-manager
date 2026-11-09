/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Users,
  CreditCard,
  Bell,
  Activity,
  ShieldCheck,
  Search,
  Lock,
  Unlock,
  CheckCircle2,
  Send,
  Smartphone,
  Globe,
  Download,
  ArrowLeft,
  Crown,
  KeyRound,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import {
  AdminService,
  AdminUser,
  AdminSubscriptionRecord,
  PushNotificationRecord,
} from '../services/adminService';

interface AdminPanelProps {
  onBackToApp: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onBackToApp }) => {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('aimoney_admin_auth') === 'true';
  });
  const [passcode, setPasscode] = useState('');
  const [authError, setAuthError] = useState('');

  // Active Tab
  const [activeTab, setActiveTab] = useState<'users' | 'subscriptions' | 'push' | 'system'>('users');

  // Data
  const [users, setUsers] = useState<AdminUser[]>(() => AdminService.getUsers());
  const [subscriptions] = useState<AdminSubscriptionRecord[]>(() => AdminService.getSubscriptions());
  const [pushHistory, setPushHistory] = useState<PushNotificationRecord[]>(() =>
    AdminService.getPushHistory()
  );

  // Filters & Search
  const [userSearch, setUserSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState<'all' | 'android' | 'web'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pro' | 'free'>('all');

  // Push Form
  const [pushTitle, setPushTitle] = useState('');
  const [pushBody, setPushBody] = useState('');
  const [pushAudience, setPushAudience] = useState<PushNotificationRecord['targetAudience']>('all');
  const [pushSending, setPushSending] = useState(false);
  const [pushSuccessMsg, setPushSuccessMsg] = useState('');

  // Handle Passcode Submit
  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Default passcodes: "admin123" or "fixfly@2026"
    if (passcode.trim() === 'admin123' || passcode.trim() === 'fixfly@2026') {
      setIsAuthenticated(true);
      sessionStorage.setItem('aimoney_admin_auth', 'true');
      setAuthError('');
    } else {
      setAuthError('Incorrect passcode. Use default: admin123 or fixfly@2026');
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('aimoney_admin_auth');
    setIsAuthenticated(false);
  };

  // Toggle Pro
  const handleTogglePro = (userId: string) => {
    const updated = AdminService.toggleUserPro(userId);
    setUsers([...updated]);
  };

  // Send Push
  const handleSendPush = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pushTitle.trim() || !pushBody.trim()) return;

    setPushSending(true);
    setTimeout(() => {
      const record = AdminService.sendPushNotification(pushTitle, pushBody, pushAudience);
      setPushHistory([record, ...AdminService.getPushHistory().slice(1)]);
      setPushTitle('');
      setPushBody('');
      setPushSending(false);
      setPushSuccessMsg(`Broadcast sent successfully to ${record.deliveredCount} devices!`);
      setTimeout(() => setPushSuccessMsg(''), 3000);
    }, 600);
  };

  // Export CSV
  const handleExportUsers = () => {
    const headers = 'ID,Name,Email,Mobile,Platform,StorageMode,IsPro,Plan,Gateway,RegisteredAt\n';
    const rows = users
      .map(
        (u) =>
          `"${u.id}","${u.name}","${u.email}","${u.mobileNumber || ''}","${u.platform}","${u.storageMode}","${u.isPro}","${u.planName || ''}","${u.gateway || ''}","${u.registeredAt}"`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `aimoney_users_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    if (platformFilter !== 'all' && u.platform !== platformFilter) return false;
    if (statusFilter === 'pro' && !u.isPro) return false;
    if (statusFilter === 'free' && u.isPro) return false;
    if (userSearch.trim()) {
      const q = userSearch.toLowerCase();
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.mobileNumber && u.mobileNumber.includes(q))
      );
    }
    return true;
  });

  // Calculate Metrics
  const totalRevenueINR = subscriptions
    .filter((s) => s.currency === 'INR')
    .reduce((sum, s) => sum + s.amount, 0);
  const totalRevenueUSD = subscriptions
    .filter((s) => s.currency === 'USD')
    .reduce((sum, s) => sum + s.amount, 0);
  const proCount = users.filter((u) => u.isPro).length;

  // 1. PIN / Login Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4 antialiased">
        <div className="w-full max-w-sm bg-white rounded-3xl p-8 border border-slate-200 shadow-xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-[#0B1528] text-white flex items-center justify-center mx-auto shadow-md">
              <ShieldCheck className="w-7 h-7 text-emerald-400" />
            </div>
            <h1 className="text-lg font-extrabold text-[#0B1528]">Master Admin Portal</h1>
            <p className="text-xs text-slate-500">
              Enter admin passcode to manage users, Google Play & PayU subscriptions, and push notifications.
            </p>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Admin Passcode
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  autoFocus
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter passcode (default: admin123)"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:border-blue-500"
                />
                <KeyRound className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              </div>
              {authError && (
                <p className="text-xs text-rose-500 font-semibold mt-1.5">{authError}</p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-[#0B1528] hover:bg-[#111e38] text-white font-bold text-xs shadow-md transition cursor-pointer"
            >
              Authenticate & Open Console
            </button>
          </form>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <button
              onClick={onBackToApp}
              className="text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to App</span>
            </button>
            <span className="text-[11px] text-slate-400">Passcode: admin123</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Main Admin Dashboard
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col antialiased">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-[#0B1528] text-white px-4 sm:px-6 py-3.5 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToApp}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
            title="Return to Finance App"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-extrabold tracking-tight">
                AI Money Manager · Master Admin
              </h1>
              <span className="hidden sm:inline-block text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                LIVE PRODUCTION
              </span>
            </div>
            <span className="text-[11px] text-slate-300">
              Web & Android Central Control · fixfly.in
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onBackToApp}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold transition cursor-pointer"
          >
            Open User App
          </button>
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-bold transition cursor-pointer"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: Total Users */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold">Total Users</span>
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-extrabold font-mono-numbers text-slate-900">
              {users.length}
            </div>
            <div className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
              <span>+2 new today</span>
            </div>
          </div>

          {/* Card 2: Pro Subscriptions */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold">Active Pro Members</span>
              <Crown className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-extrabold font-mono-numbers text-slate-900">
              {proCount} <span className="text-xs font-normal text-slate-400">/ {users.length}</span>
            </div>
            <div className="text-[11px] text-amber-600 font-semibold">
              {((proCount / (users.length || 1)) * 100).toFixed(0)}% Conversion
            </div>
          </div>

          {/* Card 3: Total Revenue */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold">Total Revenue</span>
              <CreditCard className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold font-mono-numbers text-emerald-600">
              ₹{totalRevenueINR} <span className="text-xs font-normal text-slate-500">+ ${totalRevenueUSD}</span>
            </div>
            <div className="text-[11px] text-slate-500">PayU + Google Play + Card</div>
          </div>

          {/* Card 4: Push Delivered */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold">Push Notifications</span>
              <Bell className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-2xl font-extrabold font-mono-numbers text-slate-900">
              {pushHistory.reduce((sum, p) => sum + p.deliveredCount, 0)}
            </div>
            <div className="text-[11px] text-purple-600 font-semibold">
              {pushHistory.length} Campaigns Broadcasted
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white p-1 rounded-2xl border border-slate-200/90 shadow-xs flex items-center gap-1 overflow-x-auto text-xs font-bold">
          <button
            onClick={() => setActiveTab('users')}
            className={`py-2.5 px-4 rounded-xl transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'users'
                ? 'bg-[#0B1528] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>User Directory ({users.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('subscriptions')}
            className={`py-2.5 px-4 rounded-xl transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'subscriptions'
                ? 'bg-[#0B1528] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Subscriptions & Orders ({subscriptions.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('push')}
            className={`py-2.5 px-4 rounded-xl transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'push'
                ? 'bg-[#0B1528] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>Push Notifications</span>
          </button>

          <button
            onClick={() => setActiveTab('system')}
            className={`py-2.5 px-4 rounded-xl transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'system'
                ? 'bg-[#0B1528] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Deployment & Gateways</span>
          </button>
        </div>

        {/* TAB 1: USER DIRECTORY */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden space-y-4 p-5">
            {/* Filter Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search user by name, email, mobile..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-2">
                {/* Platform filter */}
                <select
                  value={platformFilter}
                  onChange={(e) => setPlatformFilter(e.target.value as any)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  <option value="all">All Platforms</option>
                  <option value="android">Android App</option>
                  <option value="web">Web Browser</option>
                </select>

                {/* Status filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  <option value="all">All Status</option>
                  <option value="pro">Pro Only</option>
                  <option value="free">Free Only</option>
                </select>

                <button
                  onClick={handleExportUsers}
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-bold text-slate-700 inline-flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px] tracking-wider font-mono">
                    <th className="pb-3 font-bold">User</th>
                    <th className="pb-3 font-bold">Platform</th>
                    <th className="pb-3 font-bold">Storage</th>
                    <th className="pb-3 font-bold">Subscription</th>
                    <th className="pb-3 font-bold">Activity</th>
                    <th className="pb-3 font-bold text-right">Admin Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 pr-3">
                        <div className="font-extrabold text-slate-900">{u.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{u.email}</div>
                        {u.mobileNumber && (
                          <div className="text-[10px] text-slate-400 font-mono">{u.mobileNumber}</div>
                        )}
                      </td>

                      <td className="py-3 pr-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            u.platform === 'android'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          {u.platform === 'android' ? (
                            <Smartphone className="w-3 h-3" />
                          ) : (
                            <Globe className="w-3 h-3" />
                          )}
                          <span className="capitalize">{u.platform}</span>
                        </span>
                      </td>

                      <td className="py-3 pr-3">
                        <span className="capitalize text-slate-600 font-medium">
                          {u.storageMode === 'cloud' ? '☁️ Cloud Sync' : '📱 Local Only'}
                        </span>
                      </td>

                      <td className="py-3 pr-3">
                        {u.isPro ? (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              <Crown className="w-3 h-3 text-amber-600" />
                              <span>{u.planName || 'Pro'}</span>
                            </span>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {u.gateway || 'Paid'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-medium">Free Plan</span>
                        )}
                      </td>

                      <td className="py-3 pr-3 text-slate-500">
                        <div>{u.lastActive}</div>
                        <div className="text-[10px] text-slate-400">Reg: {u.registeredAt}</div>
                      </td>

                      <td className="py-3 text-right">
                        <button
                          onClick={() => handleTogglePro(u.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer inline-flex items-center gap-1 ${
                            u.isPro
                              ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200'
                              : 'bg-[#0B1528] text-white hover:bg-[#111e38]'
                          }`}
                        >
                          {u.isPro ? (
                            <>
                              <Lock className="w-3 h-3" />
                              <span>Revoke Pro</span>
                            </>
                          ) : (
                            <>
                              <Unlock className="w-3 h-3" />
                              <span>Grant Pro Free</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: SUBSCRIPTIONS & ORDERS */}
        {activeTab === 'subscriptions' && (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden space-y-4 p-5">
            <div>
              <h3 className="text-sm font-extrabold text-[#0B1528]">
                Central Payment & Entitlement Audit
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Tracks payments across Google Play Billing (Android), PayU India (Website INR), and International Cards (Website USD).
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px] tracking-wider font-mono">
                    <th className="pb-3 font-bold">Transaction / Order</th>
                    <th className="pb-3 font-bold">Customer</th>
                    <th className="pb-3 font-bold">Gateway & Plan</th>
                    <th className="pb-3 font-bold">Amount</th>
                    <th className="pb-3 font-bold">Status</th>
                    <th className="pb-3 font-bold">Date & Expiry</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {subscriptions.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 pr-3 font-mono">
                        <div className="font-bold text-slate-900">{s.transactionId}</div>
                        <div className="text-[10px] text-slate-400">{s.orderId}</div>
                      </td>

                      <td className="py-3 pr-3">
                        <div className="font-bold text-slate-800">{s.userName}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{s.userEmail}</div>
                      </td>

                      <td className="py-3 pr-3">
                        <div className="font-bold text-slate-900">{s.planName}</div>
                        <span
                          className={`inline-block text-[10px] font-bold px-1.5 py-0.2 rounded mt-0.5 ${
                            s.gateway === 'Google Play Billing'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : s.gateway === 'PayU'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-purple-50 text-purple-700 border border-purple-200'
                          }`}
                        >
                          {s.gateway}
                        </span>
                      </td>

                      <td className="py-3 pr-3 font-extrabold font-mono-numbers text-slate-900">
                        {s.currency === 'INR' ? `₹${s.amount}` : `$${s.amount}`}
                      </td>

                      <td className="py-3 pr-3">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span className="capitalize">{s.status}</span>
                        </span>
                      </td>

                      <td className="py-3 text-slate-500">
                        <div>Purchased: {s.purchaseDate}</div>
                        <div className="text-[10px] text-slate-400">
                          Expires: {s.expiryDate || 'Lifetime Access'}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: PUSH NOTIFICATIONS */}
        {activeTab === 'push' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Push Composer Form */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-purple-600" />
                <h3 className="text-sm font-extrabold text-[#0B1528]">
                  Compose Push Notification
                </h3>
              </div>
              <p className="text-xs text-slate-500">
                Send instant alerts, feature announcements, and payment reminders directly to Android app users and web subscribers.
              </p>

              <form onSubmit={handleSendPush} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Notification Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={pushTitle}
                    onChange={(e) => setPushTitle(e.target.value)}
                    placeholder="e.g. November Budget Alert 🚨"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Message Body *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={pushBody}
                    onChange={(e) => setPushBody(e.target.value)}
                    placeholder="e.g. Your monthly food expenses exceeded 80% of budget limit. Open app to view AI analysis."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Target Audience
                  </label>
                  <select
                    value={pushAudience}
                    onChange={(e) => setPushAudience(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 cursor-pointer"
                  >
                    <option value="all">Broadcast to All Users (Android + Web)</option>
                    <option value="free_only">Free Plan Users Only (Upgrade Promo)</option>
                    <option value="pro_only">Pro Members Only (VIP Announcements)</option>
                    <option value="android_only">Android App Users Only</option>
                    <option value="web_only">Web Users Only</option>
                  </select>
                </div>

                {pushSuccessMsg && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{pushSuccessMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={pushSending}
                  className="w-full py-3 rounded-xl bg-[#0B1528] hover:bg-[#111e38] text-white font-bold text-xs inline-flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>{pushSending ? 'Broadcasting...' : 'Send Push Notification Now'}</span>
                </button>
              </form>
            </div>

            {/* Broadcast History Log */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-[#0B1528]">Broadcast History</h3>
                <span className="text-xs text-slate-400 font-mono">
                  {pushHistory.length} messages
                </span>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {pushHistory.map((p) => (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5"
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-xs font-bold text-slate-900">{p.title}</span>
                      <span className="text-[10px] font-mono text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded font-bold">
                        SENT
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">{p.body}</p>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 font-mono">
                      <span>Audience: {p.targetAudience}</span>
                      <span>Delivered: {p.deliveredCount}</span>
                      <span>{p.sentAt}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: SYSTEM, DEPLOYMENT & GATEWAYS */}
        {activeTab === 'system' && (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 sm:p-6 space-y-6">
            <div>
              <h3 className="text-base font-extrabold text-[#0B1528]">
                Deployment Architecture & Gateway Configuration
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Detailed deployment guide for Vercel, Google Play Console, and payment webhook integrations.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Box 1: Vercel Web Deployment */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="w-5 h-5 text-blue-600" />
                    <h4 className="text-xs font-bold text-slate-900">1. Vercel Web App (Website)</h4>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    100% Supported
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  GitHub repository ko Vercel me import karke direct deploy karein. Build command:{' '}
                  <code className="bg-slate-200 px-1 rounded font-mono">npm run build</code> aur output directory:{' '}
                  <code className="bg-slate-200 px-1 rounded font-mono">dist</code>.
                </p>
                <div className="text-[11px] text-slate-500 space-y-1 pt-1">
                  <div>• Subscriptions: <strong>PayU (India INR)</strong> & <strong>International Card (USD)</strong></div>
                  <div>• Custom Domain: Map your domain (e.g. <code className="font-mono">aimoney.fixfly.in</code>)</div>
                </div>
              </div>

              {/* Box 2: Google Play Console (Android) */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-emerald-600" />
                    <h4 className="text-xs font-bold text-slate-900">2. Google Play Console (Android App)</h4>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    AAB Ready
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Android folder me Gradle build karke signed <code className="font-mono">.aab</code> file Play Console par upload karein. Package name:{' '}
                  <code className="bg-slate-200 px-1 rounded font-mono">com.aimoneymanager.app</code>.
                </p>
                <div className="text-[11px] text-slate-500 space-y-1 pt-1">
                  <div>• Subscriptions: <strong>Google Play Billing 7.1.1</strong> (PlayBillingManager.java)</div>
                  <div>• In-App Products: <code className="font-mono">aimoney_pro_monthly</code>, <code className="font-mono">aimoney_pro_yearly</code>, <code className="font-mono">aimoney_pro_lifetime</code></div>
                </div>
              </div>

              {/* Box 3: Updates & Synchronization */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-purple-600" />
                  <h4 className="text-xs font-bold text-slate-900">3. How Updates Work (Both Platforms)</h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong>Single Shared Source:</strong> Dono ka UI aur calculation ek hi React source code se chalta hai. Jab aap Vercel par live domain deploy karte hain, to remote WebView se Android app me bhi bina Google review ke <strong>instant update</strong> ho jata hai!
                </p>
              </div>

              {/* Box 4: Environment Variables */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-slate-700" />
                  <h4 className="text-xs font-bold text-slate-900">4. Environment Credentials (.env)</h4>
                </div>
                <div className="text-xs font-mono bg-slate-900 text-slate-200 p-2.5 rounded-xl space-y-1 text-[11px]">
                  <div>GEMINI_API_KEY="AIzaSy..."</div>
                  <div>PAYU_MERCHANT_KEY="your_key"</div>
                  <div>PAYU_MERCHANT_SALT="your_salt"</div>
                  <div>APP_URL="https://aimoney.fixfly.in"</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
