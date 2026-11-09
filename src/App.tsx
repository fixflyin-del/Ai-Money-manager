/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Account,
  Transaction,
  UserProfile,
} from './types/finance';
import { StorageService, CategoryItem } from './services/storageService';
import { convertCurrency, fetchLiveRates, getCachedRates } from './services/currencyService';

// Original Components
import { SplashScreen } from './components/SplashScreen';
import { WelcomeModal } from './components/WelcomeModal';
import { HeaderAndDrawer, NavTab } from './components/HeaderAndDrawer';
import { BottomNav } from './components/BottomNav';
import { HomeScreen } from './components/HomeScreen';
import { ManageScreen } from './components/ManageScreen';
import { AnalysisScreen } from './components/AnalysisScreen';
import { AiManagerScreen } from './components/AiManagerScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { AddTransactionModal } from './components/AddTransactionModal';
import { PremiumModal } from './components/PremiumModal';
import { ReceiptScannerModal } from './components/ReceiptScannerModal';
import { PinLockModal } from './components/PinLockModal';
import { AdminPanel } from './components/AdminPanel';

export default function App() {
  // App State
  const [showSplash, setShowSplash] = useState(() => window.location.pathname !== '/admin');
  const [profile, setProfile] = useState<UserProfile>(() => StorageService.getUserProfile());
  const [accounts, setAccounts] = useState<Account[]>(() => StorageService.getAccounts());
  const [transactions, setTransactions] = useState<Transaction[]>(() => StorageService.getTransactions());
  const [categories, setCategories] = useState<CategoryItem[]>(() => StorageService.getCategories());

  // Navigation
  const [activeTab, setActiveTab] = useState<NavTab>(() => {
    return window.location.pathname === '/admin' ? 'admin' : 'home';
  });
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Modals
  const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState(false);
  const [isAddEntryModalOpen, setIsAddEntryModalOpen] = useState(false);
  const [isPremiumModalOpen, setIsPremiumModalOpen] = useState(false);
  const [isReceiptScannerOpen, setIsReceiptScannerOpen] = useState(false);
  const [isAppLocked, setIsAppLocked] = useState(false);
  const [manageInitialAddAccount, setManageInitialAddAccount] = useState(false);

  // Initialize and check first launch welcome modal
  useEffect(() => {
    fetchLiveRates();

    const storedProfile = StorageService.getUserProfile();
    if (!storedProfile.hasSelectedStorageMode) {
      setIsWelcomeModalOpen(true);
    }

    if (storedProfile.darkModeEnabled) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Android Google Play billing purchase result listener
    window.onPlayBillingPurchaseResult = (jsonStr: string) => {
      try {
        const res = JSON.parse(jsonStr);
        if (res.success) {
          const currentProfile = StorageService.getUserProfile();
          const updated: UserProfile = {
            ...currentProfile,
            subscription: {
              ...currentProfile.subscription,
              isPro: true,
              planName: 'Google Play Pro',
              gateway: 'Google Play Billing',
              transactionId: res.orderId || `play_${Date.now()}`,
              purchaseDate: new Date().toISOString(),
              status: 'active',
            },
          };
          StorageService.saveUserProfile(updated);
          setProfile(updated);
        }
      } catch (err) {
        console.error('Failed to parse Play Billing purchase result:', err);
      }
    };
  }, []);

  // Idle lock
  useEffect(() => {
    if (!profile.isPinLocked || !profile.pinHash) return;
    const handleVisibility = () => {
      if (document.hidden) setIsAppLocked(true);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [profile.isPinLocked, profile.pinHash]);

  // Consolidated Total Balance across all accounts in preferred display currency
  const prefCurrency = profile.preferredCurrency;
  const rates = getCachedRates().rates;

  const totalBalance = useMemo(() => {
    return accounts.reduce((acc, account) => {
      const converted = convertCurrency(account.balance, account.currency, prefCurrency, rates);
      return acc + converted;
    }, 0);
  }, [accounts, prefCurrency, rates]);

  // Handlers for Storage operations
  const handleAddAccount = useCallback((accData: any) => {
    StorageService.addAccount(accData);
    setAccounts([...StorageService.getAccounts()]);
  }, []);

  const handleUpdateAccount = useCallback((acc: Account) => {
    StorageService.updateAccount(acc);
    setAccounts([...StorageService.getAccounts()]);
  }, []);

  const handleAdjustBalance = useCallback((id: string, newBalance: number, notes?: string) => {
    StorageService.adjustBalance(id, newBalance, notes);
    setAccounts([...StorageService.getAccounts()]);
    setTransactions([...StorageService.getTransactions()]);
  }, []);

  const handleToggleArchive = useCallback((id: string) => {
    StorageService.toggleArchiveAccount(id);
    setAccounts([...StorageService.getAccounts()]);
  }, []);

  const handleDeleteAccount = useCallback((id: string) => {
    StorageService.deleteAccount(id);
    setAccounts([...StorageService.getAccounts()]);
  }, []);

  const handleAddTransaction = useCallback((txData: Omit<Transaction, 'id' | 'createdAt'>) => {
    StorageService.addTransaction(txData);
    setTransactions([...StorageService.getTransactions()]);
    setAccounts([...StorageService.getAccounts()]);
  }, []);

  const handleAddCategory = useCallback((cat: any) => {
    StorageService.addCategory(cat);
    setCategories([...StorageService.getCategories()]);
  }, []);

  const handleDeleteCategory = useCallback((id: string) => {
    StorageService.deleteCategory(id);
    setCategories([...StorageService.getCategories()]);
  }, []);

  const handleUpdateProfile = useCallback((updated: UserProfile) => {
    setProfile({ ...updated });
  }, []);

  // Welcome modal handlers
  const handleSelectGoogleAuth = () => {
    const updated = StorageService.markStorageModeSelected('cloud', 'FixFly User', 'fixfly.in@gmail.com');
    setProfile(updated);
    setIsWelcomeModalOpen(false);
  };

  const handleSelectLocalStorage = () => {
    const updated = StorageService.markStorageModeSelected('local');
    setProfile(updated);
    setIsWelcomeModalOpen(false);
  };

  // Listen to browser navigation popstate
  useEffect(() => {
    const handlePopState = () => {
      setActiveTab(window.location.pathname === '/admin' ? 'admin' : 'home');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (activeTab === 'admin') {
    return (
      <AdminPanel
        onBackToApp={() => {
          setActiveTab('home');
          window.history.pushState({}, '', '/');
        }}
      />
    );
  }

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] text-slate-800 dark:text-slate-100 flex flex-col antialiased">
      {/* 1. First-Launch Welcome & Auth Popup (Screenshot 3) */}
      <WelcomeModal
        isOpen={isWelcomeModalOpen}
        onClose={() => setIsWelcomeModalOpen(false)}
        onSelectGoogle={handleSelectGoogleAuth}
        onSelectLocal={handleSelectLocalStorage}
      />

      {/* 2. PIN Lock Modal */}
      <PinLockModal
        isLocked={isAppLocked}
        correctPin={profile.pinHash || ''}
        biometricsEnabled={profile.biometricsEnabled}
        onUnlock={() => setIsAppLocked(false)}
      />

      {/* 3. Global Header & Side Drawer (Screenshots 1, 2, 4, 5, 6, 7, 8) */}
      <HeaderAndDrawer
        profile={profile}
        totalBalance={totalBalance}
        accountCount={accounts.length}
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          if (tab === 'admin') {
            window.history.pushState({}, '', '/admin');
          } else if (window.location.pathname === '/admin') {
            window.history.pushState({}, '', '/');
          }
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        isDrawerOpen={isDrawerOpen}
        setIsDrawerOpen={setIsDrawerOpen}
        onOpenUpgrade={() => setIsPremiumModalOpen(true)}
      />

      {/* 4. Active Main Content Screen */}
      <main className="flex-1 w-full">
        {activeTab === 'home' && (
          <HomeScreen
            profile={profile}
            accounts={accounts}
            transactions={transactions}
            onOpenAddModal={() => setIsAddEntryModalOpen(true)}
            onOpenCreateAccount={() => {
              setActiveTab('manage');
              setManageInitialAddAccount(true);
            }}
            onNavigateManage={() => setActiveTab('manage')}
          />
        )}

        {activeTab === 'manage' && (
          <ManageScreen
            profile={profile}
            accounts={accounts}
            categories={categories}
            transactions={transactions}
            onAddAccount={handleAddAccount}
            onUpdateAccount={handleUpdateAccount}
            onAdjustBalance={handleAdjustBalance}
            onToggleArchive={handleToggleArchive}
            onDeleteAccount={handleDeleteAccount}
            onAddCategory={handleAddCategory}
            onDeleteCategory={handleDeleteCategory}
            initialOpenAddAccount={manageInitialAddAccount}
          />
        )}

        {activeTab === 'analysis' && (
          <AnalysisScreen
            profile={profile}
            accounts={accounts}
            transactions={transactions}
            onOpenUpgrade={() => setIsPremiumModalOpen(true)}
          />
        )}

        {activeTab === 'ai_manager' && (
          <AiManagerScreen
            profile={profile}
            accounts={accounts}
            transactions={transactions}
            onOpenUpgrade={() => setIsPremiumModalOpen(true)}
            onOpenReceiptScanner={() => setIsReceiptScannerOpen(true)}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileScreen
            profile={profile}
            accounts={accounts}
            transactions={transactions}
            totalBalance={totalBalance}
            onUpdateProfile={handleUpdateProfile}
            onOpenUpgrade={() => setIsPremiumModalOpen(true)}
            onOpenGoogleSignIn={handleSelectGoogleAuth}
          />
        )}
      </main>

      {/* 5. Central Add Entry Modal */}
      <AddTransactionModal
        isOpen={isAddEntryModalOpen}
        onClose={() => setIsAddEntryModalOpen(false)}
        profile={profile}
        accounts={accounts}
        categories={categories}
        onAddTransaction={handleAddTransaction}
        onOpenCreateAccount={() => {
          setIsAddEntryModalOpen(false);
          setActiveTab('manage');
          setManageInitialAddAccount(true);
        }}
      />

      {/* 6. Premium Upgrade Modal */}
      <PremiumModal
        isOpen={isPremiumModalOpen}
        onClose={() => setIsPremiumModalOpen(false)}
        profile={profile}
        onUpdateProfile={handleUpdateProfile}
      />

      {/* 7. Gemini AI Receipt Scanner Modal */}
      <ReceiptScannerModal
        isOpen={isReceiptScannerOpen}
        onClose={() => setIsReceiptScannerOpen(false)}
        profile={profile}
        accounts={accounts}
        onSaveTransaction={handleAddTransaction}
      />

      {/* 8. Fixed Bottom Navigation (5 items) */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setManageInitialAddAccount(false);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenAddModal={() => setIsAddEntryModalOpen(true)}
      />
    </div>
  );
}
