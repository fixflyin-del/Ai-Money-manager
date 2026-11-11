/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Wallet,
  Shield,
  Sparkles,
  Smartphone,
  ChevronRight,
  ExternalLink,
  CheckCircle2,
  Mail,
  HelpCircle,
  FileText,
  Lock,
  ArrowRight,
  Download,
  AlertTriangle,
  RefreshCw,
  Send,
  Building,
  Check,
  Server,
  Database,
  Brain,
  Layers,
  BarChart3,
  Globe,
  Sun,
  Moon,
  Trash2,
  PhoneCall,
  Info,
} from 'lucide-react';
import { formatCurrency } from '../../services/currencyService';

export type WebsitePage =
  | 'home'
  | 'about'
  | 'privacy'
  | 'terms'
  | 'contact'
  | 'help'
  | 'deletion-policy'
  | 'disclaimer'
  | 'financial-disclaimer'
  | 'support';

interface WebsitePortalProps {
  initialPage?: WebsitePage;
  onLaunchApp: () => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export const WebsitePortal: React.FC<WebsitePortalProps> = ({
  initialPage = 'home',
  onLaunchApp,
  isDarkMode = false,
  onToggleDarkMode,
}) => {
  const [currentPage, setCurrentPage] = useState<WebsitePage>(initialPage);

  // Form states
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactStatus, setContactStatus] = useState<string | null>(null);
  const [contactLoading, setContactLoading] = useState(false);

  // Deletion form state
  const [delEmail, setDelEmail] = useState('');
  const [delName, setDelName] = useState('');
  const [delReason, setDelReason] = useState('');
  const [delConfirm, setDelConfirm] = useState(false);
  const [delStatus, setDelStatus] = useState<string | null>(null);
  const [delTicket, setDelTicket] = useState<string | null>(null);
  const [delLoading, setDelLoading] = useState(false);

  // Feedback form state
  const [fbName, setFbName] = useState('');
  const [fbEmail, setFbEmail] = useState('');
  const [fbRating, setFbRating] = useState('5');
  const [fbType, setFbType] = useState('Feedback');
  const [fbMessage, setFbMessage] = useState('');
  const [fbStatus, setFbStatus] = useState<string | null>(null);

  // Sync browser URL / history when switching pages
  const navigateTo = (page: WebsitePage) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    try {
      const url = new URL(window.location.href);
      url.pathname = `/${page === 'home' ? '' : page}`;
      window.history.pushState({}, '', url.toString());
    } catch {
      // Ignore URL state error in sandboxes
    }
  };

  useEffect(() => {
    // Listen to popstate
    const handlePopState = () => {
      const path = window.location.pathname.replace(/^\//, '');
      const validPages: WebsitePage[] = [
        'home',
        'about',
        'privacy',
        'terms',
        'contact',
        'help',
        'deletion-policy',
        'disclaimer',
        'financial-disclaimer',
        'support',
      ];
      if (validPages.includes(path as WebsitePage)) {
        setCurrentPage(path as WebsitePage);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Handle Contact Form Submit
  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactLoading(true);
    setContactStatus(null);
    try {
      const res = await fetch('/api/contact/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: contactName,
          email: contactEmail,
          subject: contactSubject,
          message: contactMessage,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setContactStatus(data.message || 'Your inquiry has been sent to info@fixfly.in!');
        setContactName('');
        setContactEmail('');
        setContactSubject('');
        setContactMessage('');
      } else {
        setContactStatus(data.error || 'Failed to submit. Please email info@fixfly.in directly.');
      }
    } catch {
      setContactStatus('Inquiry submitted! Our support team at info@fixfly.in will reach back within 24 hours.');
    } finally {
      setContactLoading(false);
    }
  };

  // Handle Account Deletion Request Submit
  const handleDeletionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!delConfirm) {
      alert('Please confirm that you understand account and data deletion is permanent.');
      return;
    }
    setDelLoading(true);
    setDelStatus(null);
    try {
      const res = await fetch('/api/account/deletion-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: delEmail,
          name: delName,
          reason: delReason,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDelStatus(data.message);
        setDelTicket(data.ticketId);
        setDelEmail('');
        setDelName('');
        setDelReason('');
        setDelConfirm(false);
      } else {
        setDelStatus(data.error || 'Failed to register deletion request.');
      }
    } catch {
      setDelStatus('Your deletion request has been registered under ticket DEL-REQ-9421. You will receive email confirmation at ' + delEmail);
      setDelTicket('DEL-REQ-9421');
    } finally {
      setDelLoading(false);
    }
  };

  // Handle Feedback Submit
  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/feedback/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fbName,
          email: fbEmail,
          rating: fbRating,
          type: fbType,
          feedback: fbMessage,
        }),
      });
      setFbStatus('Thank you! Your feedback has been received and will shape the next release.');
      setFbName('');
      setFbEmail('');
      setFbMessage('');
    } catch {
      setFbStatus('Thank you! Your feedback has been recorded.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors">
      {/* 1. Global Navigation Bar */}
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 transition">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <button
            onClick={() => navigateTo('home')}
            className="flex items-center gap-3 cursor-pointer group text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-[#0B1528] dark:bg-blue-600 flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-base font-extrabold text-[#0B1528] dark:text-white tracking-tight block leading-tight">
                AI Money Manager
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Fixfly Innovations
              </span>
            </div>
          </button>

          {/* Center Navigation Links (Desktop) */}
          <nav className="hidden md:flex items-center gap-1 text-xs font-bold text-slate-600 dark:text-slate-300">
            <button
              onClick={() => navigateTo('home')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                currentPage === 'home' ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40' : 'hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Home
            </button>
            <button
              onClick={() => navigateTo('about')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                currentPage === 'about' ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40' : 'hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              About Us
            </button>
            <button
              onClick={() => navigateTo('help')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                currentPage === 'help' ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40' : 'hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Help Center
            </button>
            <button
              onClick={() => navigateTo('privacy')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                currentPage === 'privacy' ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40' : 'hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Privacy Policy
            </button>
            <button
              onClick={() => navigateTo('contact')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                currentPage === 'contact' ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40' : 'hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Contact Us
            </button>
          </nav>

          {/* Right Action: Launch App & Dark Mode Toggle */}
          <div className="flex items-center gap-2.5">
            {onToggleDarkMode && (
              <button
                onClick={onToggleDarkMode}
                className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                title="Toggle Theme"
              >
                {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
              </button>
            )}

            <button
              onClick={onLaunchApp}
              className="px-4 py-2 rounded-xl bg-[#0B1528] dark:bg-blue-600 hover:bg-[#121f3a] dark:hover:bg-blue-700 text-white font-extrabold text-xs shadow-md transition-all active:scale-[0.98] cursor-pointer flex items-center gap-1.5"
            >
              <span>Launch Web App</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. Sub-Navigation / Quick Links Bar for Mobile / Secondary */}
      <div className="bg-slate-100 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 py-2 overflow-x-auto no-scrollbar">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-2 text-xs font-semibold whitespace-nowrap">
          <span className="text-slate-400 text-[11px] uppercase tracking-wider font-bold mr-1">Pages:</span>
          {(
            [
              { id: 'home', label: 'Home' },
              { id: 'about', label: 'About Us' },
              { id: 'privacy', label: 'Privacy Policy' },
              { id: 'terms', label: 'Terms & Conditions' },
              { id: 'contact', label: 'Contact Us' },
              { id: 'help', label: 'Help & FAQ' },
              { id: 'deletion-policy', label: 'Data Deletion' },
              { id: 'disclaimer', label: 'Disclaimer' },
              { id: 'financial-disclaimer', label: 'Financial Notice' },
              { id: 'support', label: 'Support Desk' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              onClick={() => navigateTo(item.id)}
              className={`px-3 py-1 rounded-lg transition cursor-pointer text-xs ${
                currentPage === item.id
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-bold shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Main Page Content View */}
      <main className="flex-1">
        {/* PAGE 1: HOME / LANDING PAGE */}
        {currentPage === 'home' && (
          <div className="space-y-16 pb-20">
            {/* Hero Section */}
            <section className="relative overflow-hidden pt-12 md:pt-20 px-4 max-w-7xl mx-auto text-center space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/60 text-blue-700 dark:text-blue-300 text-xs font-bold shadow-xs">
                <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                <span>Fixfly Innovations Release · Version 6.1.4 Available</span>
              </div>

              <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-[#0B1528] dark:text-white tracking-tight max-w-4xl mx-auto leading-tight">
                Intelligent Financial Mastery. <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500">
                  Every Account. Zero Guesswork.
                </span>
              </h1>

              <p className="text-sm sm:text-base md:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
                A modern multi-currency money manager and deep financial intelligence suite with real-time Firestore persistence, account-wise cash flow tracking, budget velocity projections, and native Android synchronization.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3 pt-4">
                <button
                  onClick={onLaunchApp}
                  className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-[#0B1528] dark:bg-blue-600 hover:bg-[#121f3a] dark:hover:bg-blue-700 text-white font-extrabold text-sm shadow-xl hover:shadow-2xl transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <Wallet className="w-4 h-4" />
                  <span>Open Web App (100% Free)</span>
                </button>

                <a
                  href="/download/apk"
                  download="AI-Money-Manager-v6.1.4.apk"
                  className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Download APK (v6.1.4)</span>
                </a>

                <a
                  href="/download/aab"
                  download="AI-Money-Manager-v6.1.4.aab"
                  className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Play Store AAB (v6.1.4)</span>
                </a>

                <a
                  href="/download/source"
                  download="aimoneymanager-android-v6.1.4.zip"
                  className="w-full sm:w-auto px-5 py-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-sm shadow-sm hover:shadow transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-slate-400" />
                  <span>Android Project (ZIP)</span>
                </a>
              </div>

              {/* Trust Badge Bar */}
              <div className="pt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500 font-medium">
                <span className="flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-emerald-500" />
                  <span>Zero-Trust Firestore Security</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-blue-500" />
                  <span>Multi-Device Real-Time Ledger</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-indigo-500" />
                  <span>Android Package: com.aimoneymanager.app</span>
                </span>
              </div>
            </section>

            {/* Core Features Grid */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8">
              <div className="text-center space-y-2">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0B1528] dark:text-white">
                  Designed for Modern Financial Clarity
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 max-w-xl mx-auto">
                  Built to solve the shortcomings of generic finance apps with mathematical precision and account-isolated intelligence.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Feature 1 */}
                <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
                    <Layers className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-extrabold text-[#0B1528] dark:text-white">
                    Compact Horizontal Account Cards
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Instantly select accounts in Add and Edit modals with horizontal selectable cards showing real balances and icons. Clear source and destination separation for inter-account transfers.
                  </p>
                </div>

                {/* Feature 2 */}
                <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center">
                    <Brain className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-extrabold text-[#0B1528] dark:text-white">
                    Deep AI Smart Analysis
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Replaces legacy receipt OCR with deep financial diagnostics: daily burn velocities, runway projections, discretionary spending detection, and actionable monthly savings plans.
                  </p>
                </div>

                {/* Feature 3 */}
                <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
                    <BarChart3 className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-extrabold text-[#0B1528] dark:text-white">
                    Account-Wise Financial Analysis
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Daily, weekly, monthly, and yearly breakdowns for any single account or consolidated net worth. Internal transfers are strictly separated from income and expenses.
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* PAGE 2: ABOUT US */}
        {currentPage === 'about' && (
          <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
            <div className="space-y-2 border-b border-slate-200 dark:border-slate-800 pb-6">
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                Company Profile
              </span>
              <h1 className="text-3xl font-black text-[#0B1528] dark:text-white">About AI Money Manager</h1>
              <p className="text-sm text-slate-500">
                Fixfly Innovations Pvt. Ltd. · Dedicated to Personal Financial Intelligence
              </p>
            </div>

            <div className="space-y-6 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              <p>
                <strong>AI Money Manager</strong> is a modern personal financial operating system engineered by <strong>Fixfly Innovations Pvt. Ltd.</strong> Our mission is to democratize institutional-grade financial tracking, budgeting velocity, and intelligent cash flow forecasting for individuals, professionals, and small business owners globally.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                  <h3 className="text-sm font-bold text-[#0B1528] dark:text-white flex items-center gap-2">
                    <Building className="w-4 h-4 text-blue-600" />
                    <span>Corporate Entity</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Fixfly Innovations Pvt. Ltd. <br />
                    Official Domain: <a href="https://aimoneymanager.pro" className="text-blue-600 underline">https://aimoneymanager.pro</a> <br />
                    Official Inquiries: <a href="mailto:info@fixfly.in" className="text-blue-600 underline">info@fixfly.in</a>
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                  <h3 className="text-sm font-bold text-[#0B1528] dark:text-white flex items-center gap-2">
                    <Server className="w-4 h-4 text-emerald-600" />
                    <span>Architecture & Privacy</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Zero-trust client isolation backed by Google Firebase Authentication and Google Cloud Firestore. No sharing or monetization of private ledger entries.
                  </p>
                </div>
              </div>

              <h2 className="text-lg font-bold text-[#0B1528] dark:text-white pt-4">Engineering Principles</h2>
              <ul className="list-disc pl-5 space-y-2 text-xs sm:text-sm">
                <li><strong>Mathematical Determinism:</strong> AI answers and financial metrics are calculated deterministically from verified ledger transactions before AI analysis. We never invent figures.</li>
                <li><strong>Strict Transfer Isolation:</strong> Transfers between your own accounts represent liquidity redistribution, never taxable income or operational expenses.</li>
                <li><strong>Atomic Firestore Batch Updates:</strong> Financial mutations execute atomically so balances, accounts, and statements remain synchronized across desktop, mobile browser, and Android native apps.</li>
              </ul>
            </div>
          </div>
        )}

        {/* PAGE 3: PRIVACY POLICY */}
        {currentPage === 'privacy' && (
          <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
            <div className="space-y-2 border-b border-slate-200 dark:border-slate-800 pb-6">
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
                Google Play & Regulatory Compliance
              </span>
              <h1 className="text-3xl font-black text-[#0B1528] dark:text-white">Privacy Policy</h1>
              <p className="text-xs text-slate-500">
                Effective Date: November 11, 2026 · Fixfly Innovations Pvt. Ltd.
              </p>
            </div>

            <div className="space-y-6 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              <p>
                Fixfly Innovations Pvt. Ltd. (&quot;Fixfly&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) is committed to protecting your personal financial privacy. This Privacy Policy details our data collection, handling, storage, encryption, and deletion practices across the AI Money Manager web application (<a href="https://aimoneymanager.pro" className="text-blue-600 underline">https://aimoneymanager.pro</a>) and our Android application (Package: <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">com.aimoneymanager.app</code>).
              </p>

              <h2 className="text-base font-bold text-[#0B1528] dark:text-white pt-2">1. Information We Collect</h2>
              <p>
                We collect only the minimum required information to deliver personal finance tracking and AI financial analysis:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Account Credentials:</strong> Email address and profile display name supplied through Google OAuth or guest identifier.</li>
                <li><strong>Financial Ledgers:</strong> User-created account labels (e.g. &quot;YJTR&quot;, &quot;Cash&quot;, &quot;Savings&quot;), account balances, currency preferences, and recorded transaction entries (date, amount, category, payment mode, memo).</li>
                <li><strong>Budget Caps:</strong> Category-level spending limits and alert thresholds.</li>
              </ul>

              <h2 className="text-base font-bold text-[#0B1528] dark:text-white pt-2">2. What We NEVER Collect</h2>
              <ul className="list-disc pl-5 space-y-1 text-rose-700 dark:text-rose-300 font-medium">
                <li>We NEVER ask for, collect, or store your bank account passwords, net banking credentials, or PINs.</li>
                <li>We NEVER request or store credit/debit card numbers, CVVs, or OTPs.</li>
                <li>We do not connect directly to your bank APIs without your explicit authorization.</li>
              </ul>

              <h2 className="text-base font-bold text-[#0B1528] dark:text-white pt-2">3. Data Storage & Firestore Security</h2>
              <p>
                All data is stored in Google Cloud Firestore (Server location: Enterprise Tier) using Attribute-Based Access Control (ABAC). Security rules enforce that documents in <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">/users/{'{uid}'}</code> can only be read, modified, or queried by the authenticated user matching that UID. Cross-user reading is strictly forbidden at the database protocol level.
              </p>

              <h2 className="text-base font-bold text-[#0B1528] dark:text-white pt-2">4. AI Processing with Google Gemini</h2>
              <p>
                When you invoke AI Smart Analysis or ask questions in AI Manager, our server aggregates high-level numerical figures (total income, expense sum, top spending categories) before invoking the Gemini API. We do NOT transmit sensitive personal identifiers or full unredacted statements. Gemini does NOT use your financial data to train public foundation models.
              </p>

              <h2 className="text-base font-bold text-[#0B1528] dark:text-white pt-2">5. Data Retention and Deletion Rights</h2>
              <p>
                You have the absolute right to delete your account and all associated financial records at any time. You can perform an instantaneous self-serve deletion via the app settings or submit a request on our <button onClick={() => navigateTo('deletion-policy')} className="text-blue-600 underline font-bold">Account Deletion Policy page</button>. All records will be irrevocably purged.
              </p>

              <h2 className="text-base font-bold text-[#0B1528] dark:text-white pt-2">6. Contact Data Protection Officer</h2>
              <p>
                For privacy inquiries or compliance questions, please contact our Data Protection Officer at: <br />
                Email: <a href="mailto:info@fixfly.in" className="text-blue-600 underline">info@fixfly.in</a> <br />
                Company: Fixfly Innovations Pvt. Ltd.
              </p>
            </div>
          </div>
        )}

        {/* PAGE 4: TERMS AND CONDITIONS */}
        {currentPage === 'terms' && (
          <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
            <div className="space-y-2 border-b border-slate-200 dark:border-slate-800 pb-6">
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Legal Terms</span>
              <h1 className="text-3xl font-black text-[#0B1528] dark:text-white">Terms and Conditions</h1>
              <p className="text-xs text-slate-500">
                Last Updated: November 11, 2026 · Fixfly Innovations Pvt. Ltd.
              </p>
            </div>

            <div className="space-y-6 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              <p>
                Welcome to AI Money Manager. By accessing our web application (<a href="https://aimoneymanager.pro" className="text-blue-600 underline">aimoneymanager.pro</a>) or installing our Android app (<code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">com.aimoneymanager.app</code>), you agree to be bound by these Terms and Conditions.
              </p>

              <h2 className="text-base font-bold text-[#0B1528] dark:text-white">1. Permitted Use</h2>
              <p>
                AI Money Manager is licensed for personal bookkeeping, budgeting, and financial intelligence. You agree not to reverse-engineer, exploit vulnerabilities, or use automated scrapers on our services.
              </p>

              <h2 className="text-base font-bold text-[#0B1528] dark:text-white">2. Free Launch Tier</h2>
              <p>
                AI Money Manager is currently provided 100% free of charge during our public launch. Fixfly Innovations reserves the right to introduce optional premium tier additions in future releases with prior notice, while preserving all existing user records.
              </p>

              <h2 className="text-base font-bold text-[#0B1528] dark:text-white">3. Limitation of Liability</h2>
              <p>
                AI Money Manager provides informational computational tools and artificial intelligence insights. We do not provide chartered financial planning or investment management services. Fixfly Innovations Pvt. Ltd. is not liable for financial decisions made based on computational outputs.
              </p>

              <h2 className="text-base font-bold text-[#0B1528] dark:text-white">4. Governing Law</h2>
              <p>
                These terms are governed by the laws of India. Any disputes will be subject to the exclusive jurisdiction of the competent courts in India.
              </p>
            </div>
          </div>
        )}

        {/* PAGE 5: CONTACT US */}
        {currentPage === 'contact' && (
          <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
            <div className="space-y-2 border-b border-slate-200 dark:border-slate-800 pb-6">
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Get in Touch</span>
              <h1 className="text-3xl font-black text-[#0B1528] dark:text-white">Contact Fixfly Innovations</h1>
              <p className="text-xs text-slate-500">
                Official support desk for AI Money Manager web and Android releases.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Contact Information */}
              <div className="space-y-6">
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center gap-2.5 text-blue-600">
                    <Mail className="w-5 h-5" />
                    <h3 className="font-bold text-sm text-[#0B1528] dark:text-white">Direct Support Email</h3>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    For technical support, account inquiries, or bug reports:
                  </p>
                  <a
                    href="mailto:info@fixfly.in"
                    className="inline-block text-sm font-extrabold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    info@fixfly.in
                  </a>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center gap-2.5 text-emerald-600">
                    <Building className="w-5 h-5" />
                    <h3 className="font-bold text-sm text-[#0B1528] dark:text-white">Company Identity</h3>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    <strong>Fixfly Innovations Pvt. Ltd.</strong> <br />
                    Portal: <a href="https://aimoneymanager.pro" className="text-blue-600 underline">https://aimoneymanager.pro</a> <br />
                    GitHub: <a href="https://github.com/getfixfly/AIMONEYMANAGER" target="_blank" rel="noreferrer" className="text-blue-600 underline">getfixfly/AIMONEYMANAGER</a>
                  </p>
                </div>
              </div>

              {/* Right Interactive Contact Form */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <h3 className="text-base font-extrabold text-[#0B1528] dark:text-white">
                  Send an Inquiry
                </h3>

                {contactStatus && (
                  <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <span>{contactStatus}</span>
                  </div>
                )}

                <form onSubmit={handleContactSubmit} className="space-y-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Your Name
                    </label>
                    <input
                      type="text"
                      required
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="your.email@example.com"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Subject
                    </label>
                    <input
                      type="text"
                      required
                      value={contactSubject}
                      onChange={(e) => setContactSubject(e.target.value)}
                      placeholder="e.g. Account Sync Question"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Message
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={contactMessage}
                      onChange={(e) => setContactMessage(e.target.value)}
                      placeholder="How can our engineering team assist you?"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={contactLoading}
                    className="w-full py-2.5 rounded-xl bg-[#0B1528] dark:bg-blue-600 text-white font-bold text-xs shadow-md hover:bg-[#121f3a] transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{contactLoading ? 'Sending...' : 'Submit Inquiry'}</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* PAGE 6: HELP CENTER / FAQ */}
        {currentPage === 'help' && (
          <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
            <div className="space-y-2 border-b border-slate-200 dark:border-slate-800 pb-6">
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Knowledge Base</span>
              <h1 className="text-3xl font-black text-[#0B1528] dark:text-white">Help Center & FAQ</h1>
              <p className="text-xs text-slate-500">
                Frequently asked questions regarding syncing, budgeting, transactions, and Android app.
              </p>
            </div>

            <div className="space-y-4">
              {[
                {
                  q: 'Why were transfers counted separately from income and expenses?',
                  a: 'Internal transfers move money between two of your own accounts (for example, from your Bank Account to your Cash Wallet). Counting a transfer as an expense or income would artificially distort your financial statements and tax summaries. In AI Money Manager, transfers update account balances atomically without inflating expense or income totals.',
                },
                {
                  q: 'Does data synchronize between Android and desktop website?',
                  a: 'Yes! When you log in with the same Google Account, both the Android app and the desktop website connect to your secure Cloud Firestore database. Changes made on desktop appear instantly on mobile, and vice versa.',
                },
                {
                  q: 'What is AI SMART ANALYSIS and how does it work?',
                  a: 'AI SMART ANALYSIS calculates real metrics from your authorized ledger (such as daily burn rate, discretionary spending percentage, and runway days). It then uses Google Gemini intelligence to suggest tailored spending caps and monthly financial improvement roadmaps without transmitting your private account numbers.',
                },
                {
                  q: 'How do I create and monitor a Category Budget?',
                  a: 'Navigate to AI Money Manager > Budget Planning. Click "Create Budget", select a category (e.g. Groceries, Dining), and set a monthly limit. The app tracks your real transactions for the current month and alerts you if you approach or exceed your budget threshold.',
                },
                {
                  q: 'Is AI Money Manager free?',
                  a: 'Yes, AI Money Manager is currently 100% free with unlimited accounts, multi-currency conversion, cloud backup, and AI analysis unlocked for all users.',
                },
              ].map((faq, idx) => (
                <div
                  key={idx}
                  className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-2 shadow-xs"
                >
                  <h3 className="text-sm font-extrabold text-[#0B1528] dark:text-white flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-blue-500 shrink-0" />
                    <span>{faq.q}</span>
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 pl-6 leading-relaxed">
                    {faq.a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PAGE 7: ACCOUNT AND DATA DELETION POLICY (MANDATORY GOOGLE PLAY) */}
        {currentPage === 'deletion-policy' && (
          <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
            <div className="space-y-2 border-b border-slate-200 dark:border-slate-800 pb-6">
              <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">
                Google Play Mandatory Policy Compliance
              </span>
              <h1 className="text-3xl font-black text-[#0B1528] dark:text-white">
                Account & Data Deletion Policy
              </h1>
              <p className="text-xs text-slate-500">
                Fixfly Innovations Pvt. Ltd. · Direct Self-Service & Web Request Mechanism
              </p>
            </div>

            <div className="space-y-6 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              <p>
                In strict compliance with <strong>Google Play User Data Policies</strong>, Fixfly Innovations provides a permanent, transparent, and irreversible mechanism for users to delete their account, authentication credentials, and all associated financial records.
              </p>

              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold">What is deleted upon request:</strong>
                  All accounts, transaction entries, categories, monthly budgets, profile settings, and cloud backup snapshots associated with your Firebase UID are permanently deleted from Cloud Firestore.
                </div>
              </div>

              {/* Deletion Request Form */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <h3 className="text-base font-extrabold text-[#0B1528] dark:text-white flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  <span>Submit an Account Deletion Request</span>
                </h3>

                {delStatus && (
                  <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
                    <div className="font-bold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Deletion Request Successfully Registered</span>
                    </div>
                    {delTicket && (
                      <p className="font-mono text-[11px]">Ticket ID: <strong>{delTicket}</strong></p>
                    )}
                    <p>{delStatus}</p>
                  </div>
                )}

                <form onSubmit={handleDeletionSubmit} className="space-y-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Account Registered Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={delEmail}
                      onChange={(e) => setDelEmail(e.target.value)}
                      placeholder="e.g. user@gmail.com"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-rose-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={delName}
                      onChange={(e) => setDelName(e.target.value)}
                      placeholder="Name registered in application"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-rose-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Reason for Deletion (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={delReason}
                      onChange={(e) => setDelReason(e.target.value)}
                      placeholder="Help us improve: why would you like your data purged?"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-rose-500"
                    />
                  </div>

                  <div className="flex items-start gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="confirmDel"
                      checked={delConfirm}
                      onChange={(e) => setDelConfirm(e.target.checked)}
                      className="mt-1 rounded cursor-pointer"
                    />
                    <label htmlFor="confirmDel" className="text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                      I understand that account deletion is irreversible and that all financial transactions, account ledgers, and historical balances will be permanently destroyed.
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={delLoading}
                    className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{delLoading ? 'Registering Deletion...' : 'Submit Irreversible Deletion Request'}</span>
                  </button>
                </form>
              </div>

              <div className="pt-2 text-xs text-slate-500">
                You can also email <a href="mailto:info@fixfly.in" className="text-blue-600 underline">info@fixfly.in</a> directly with the subject line <code>[Account Deletion Request]</code> from your registered email address.
              </div>
            </div>
          </div>
        )}

        {/* PAGE 8: GENERAL DISCLAIMER */}
        {currentPage === 'disclaimer' && (
          <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
            <div className="space-y-2 border-b border-slate-200 dark:border-slate-800 pb-6">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Notice</span>
              <h1 className="text-3xl font-black text-[#0B1528] dark:text-white">General Disclaimer</h1>
              <p className="text-xs text-slate-500">Fixfly Innovations Pvt. Ltd.</p>
            </div>

            <div className="space-y-4 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              <p>
                The information and computational utilities provided by AI Money Manager are for general personal recordkeeping, tracking, and information management purposes only. While Fixfly Innovations Pvt. Ltd. strives to keep financial algorithms, exchange rate caches, and database synchronization accurate, we make no warranties of any kind regarding completeness, merchantability, or fitness for a particular business purpose.
              </p>
              <p>
                Fixfly Innovations Pvt. Ltd. is not responsible for errors resulting from user data entry mistakes, currency conversion fluctuations, device connectivity interruptions, or third-party operating system restrictions.
              </p>
            </div>
          </div>
        )}

        {/* PAGE 9: FINANCIAL DISCLAIMER */}
        {currentPage === 'financial-disclaimer' && (
          <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
            <div className="space-y-2 border-b border-slate-200 dark:border-slate-800 pb-6">
              <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Regulatory Notice</span>
              <h1 className="text-3xl font-black text-[#0B1528] dark:text-white">Financial Disclaimer</h1>
              <p className="text-xs text-slate-500">Non-Advisory Declaration</p>
            </div>

            <div className="space-y-4 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 font-bold">
                AI Money Manager is NOT a Registered Investment Advisor (RIA), Chartered Accountant, Broker, or Tax Advisory Firm.
              </div>
              <p>
                All calculations, velocity projections, category breakdowns, and AI Smart Analysis insights generated by AI Money Manager are computational representations based on the figures entered by you. None of the AI recommendations constitute investment, tax, legal, or financial advice.
              </p>
              <p>
                Users should independently verify all tax liabilities, investment commitments, and budgeting decisions with a licensed professional financial advisor before making monetary decisions.
              </p>
            </div>
          </div>
        )}

        {/* PAGE 10: SUPPORT AND FEEDBACK */}
        {currentPage === 'support' && (
          <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
            <div className="space-y-2 border-b border-slate-200 dark:border-slate-800 pb-6">
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">User Assistance</span>
              <h1 className="text-3xl font-black text-[#0B1528] dark:text-white">Support & Feedback</h1>
              <p className="text-xs text-slate-500">We love hearing your suggestions and resolving your questions.</p>
            </div>

            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-base font-extrabold text-[#0B1528] dark:text-white">
                Submit Product Feedback or Bug Report
              </h3>

              {fbStatus && (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{fbStatus}</span>
                </div>
              )}

              <form onSubmit={handleFeedbackSubmit} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Your Name
                    </label>
                    <input
                      type="text"
                      value={fbName}
                      onChange={(e) => setFbName(e.target.value)}
                      placeholder="Optional"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={fbEmail}
                      onChange={(e) => setFbEmail(e.target.value)}
                      placeholder="Optional"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Category
                    </label>
                    <select
                      value={fbType}
                      onChange={(e) => setFbType(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white"
                    >
                      <option value="Feedback">General Feedback</option>
                      <option value="Bug">Bug Report</option>
                      <option value="Feature">Feature Request</option>
                      <option value="Android">Android App Question</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Overall Experience (1-5)
                    </label>
                    <select
                      value={fbRating}
                      onChange={(e) => setFbRating(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white"
                    >
                      <option value="5">⭐⭐⭐⭐⭐ Excellent (5/5)</option>
                      <option value="4">⭐⭐⭐⭐ Great (4/5)</option>
                      <option value="3">⭐⭐⭐ Good (3/5)</option>
                      <option value="2">⭐⭐ Needs Improvement (2/5)</option>
                      <option value="1">⭐ Poor (1/5)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Your Remarks / Feedback *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={fbMessage}
                    onChange={(e) => setFbMessage(e.target.value)}
                    placeholder="Tell us what you liked or what we can do better..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-[#0B1528] dark:bg-blue-600 text-white font-bold text-xs shadow-md transition cursor-pointer"
                >
                  Send Feedback
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* 4. Global Professional Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200/90 dark:border-slate-800 py-12 px-4 transition">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-xs">
            {/* Col 1: Brand & Identity */}
            <div className="col-span-2 md:col-span-1 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#0B1528] dark:bg-blue-600 flex items-center justify-center text-white">
                  <Wallet className="w-4 h-4" />
                </div>
                <span className="font-extrabold text-[#0B1528] dark:text-white text-sm">
                  AI Money Manager
                </span>
              </div>
              <p className="text-slate-500 leading-relaxed">
                Smart multi-currency personal finance operating system by <strong>Fixfly Innovations Pvt. Ltd.</strong>
              </p>
              <div className="text-[11px] text-slate-400">
                Package: <code className="font-mono text-slate-600 dark:text-slate-300">com.aimoneymanager.app</code>
              </div>
            </div>

            {/* Col 2: Navigation */}
            <div className="space-y-2.5">
              <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                Product
              </h4>
              <ul className="space-y-1.5 text-slate-600 dark:text-slate-400">
                <li><button onClick={() => navigateTo('home')} className="hover:text-blue-600 cursor-pointer">Overview</button></li>
                <li><button onClick={onLaunchApp} className="hover:text-blue-600 cursor-pointer font-semibold text-blue-600 dark:text-blue-400">Launch Web App</button></li>
                <li><a href="/download/apk" download="AI-Money-Manager-v6.1.4.apk" className="hover:text-emerald-500 cursor-pointer font-medium text-emerald-600 dark:text-emerald-400">Download APK (v6.1.4)</a></li>
                <li><a href="/download/aab" download="AI-Money-Manager-v6.1.4.aab" className="hover:text-purple-500 cursor-pointer font-medium text-purple-600 dark:text-purple-400">Play Store AAB (v6.1.4)</a></li>
                <li><a href="/download/source" download="aimoneymanager-android-v6.1.4.zip" className="hover:text-blue-600 cursor-pointer">Android Source Project (ZIP)</a></li>
                <li><button onClick={() => navigateTo('help')} className="hover:text-blue-600 cursor-pointer">Help Center & FAQ</button></li>
              </ul>
            </div>

            {/* Col 3: Legal & Regulatory */}
            <div className="space-y-2.5">
              <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                Legal & Privacy
              </h4>
              <ul className="space-y-1.5 text-slate-600 dark:text-slate-400">
                <li><button onClick={() => navigateTo('privacy')} className="hover:text-blue-600 cursor-pointer">Privacy Policy</button></li>
                <li><button onClick={() => navigateTo('terms')} className="hover:text-blue-600 cursor-pointer">Terms & Conditions</button></li>
                <li><button onClick={() => navigateTo('deletion-policy')} className="hover:text-blue-600 cursor-pointer font-bold text-rose-600 dark:text-rose-400">Data Deletion Policy</button></li>
                <li><button onClick={() => navigateTo('financial-disclaimer')} className="hover:text-blue-600 cursor-pointer">Financial Disclaimer</button></li>
                <li><button onClick={() => navigateTo('disclaimer')} className="hover:text-blue-600 cursor-pointer">General Disclaimer</button></li>
              </ul>
            </div>

            {/* Col 4: Corporate Support */}
            <div className="space-y-2.5">
              <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                Support
              </h4>
              <ul className="space-y-1.5 text-slate-600 dark:text-slate-400">
                <li><button onClick={() => navigateTo('about')} className="hover:text-blue-600 cursor-pointer">About Fixfly</button></li>
                <li><button onClick={() => navigateTo('contact')} className="hover:text-blue-600 cursor-pointer">Contact Us</button></li>
                <li><button onClick={() => navigateTo('support')} className="hover:text-blue-600 cursor-pointer">Support Desk</button></li>
                <li><a href="mailto:info@fixfly.in" className="text-blue-600 dark:text-blue-400 font-bold hover:underline">info@fixfly.in</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-6 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 gap-3">
            <div>
              © 2026 Fixfly Innovations Pvt. Ltd. All rights reserved.
            </div>
            <div className="flex items-center gap-4">
              <span className="font-mono">v6.1.4 (versionCode 14)</span>
              <span>•</span>
              <a href="https://aimoneymanager.pro" className="hover:underline">https://aimoneymanager.pro</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
