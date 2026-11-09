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
import { convertCurrency, fetchLiveRates, getCachedRates, formatCurrency } from './services/currencyService';
import { CalculationService } from './services/calculationService';
import { AuthService } from './services/firebase';
import { CloudFirestoreService } from './services/cloudFirestoreService';

// Components
import { SplashScreen } from './components/SplashScreen';
import { WelcomeModal } from './components/WelcomeModal';
import { HeaderAndDrawer, NavTab } from './components/HeaderAndDrawer';
import { DesktopSidebar } from './components/DesktopSidebar';
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
import { Sun, Moon, User, Plus } from 'lucide-react';

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

  // Apply Theme Helper
  const applyTheme = useCallback((isDark: boolean) => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  // Initialize and check first launch welcome modal
  useEffect(() => {
    fetchLiveRates();

    const storedProfile = StorageService.getUserProfile();
    if (!storedProfile.hasSelectedStorageMode) {
      setIsWelcomeModalOpen(true);
    }

    applyTheme(Boolean(storedProfile.darkModeEnabled));

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
          if (updated.firebaseUid) {
            CloudFirestoreService.saveUserProfile(updated);
          }
        }
      } catch (err) {
        console.error('Failed to parse Play Billing purchase result:', err);
      }
    };
  }, [applyTheme]);

  // Requirement 9: Strict User Data Isolation on Firebase Auth State Change
  useEffect(() => {
    const unsubscribe = AuthService.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        const uid = firebaseUser.uid;
        // 1. Switch local storage boundary to this specific UID
        StorageService.setActiveUser(uid);

        try {
          // 2. Fetch cloud profile
          const cloudProf = await CloudFirestoreService.getUserProfile(uid);

          if (cloudProf) {
            // Returning user: restore their exact cloud data
            setProfile(cloudProf);
            StorageService.saveUserProfile(cloudProf);
            applyTheme(Boolean(cloudProf.darkModeEnabled));

            const cloudAccounts = await CloudFirestoreService.getAccounts(uid);
            const cloudTx = await CloudFirestoreService.getTransactions(uid);
            const cloudCat = await CloudFirestoreService.getCategories(uid);

            const sortedTx = CalculationService.sortTransactionsNewestFirst(cloudTx);
            const recalculatedAccounts = CalculationService.recalculateAllAccountBalances(cloudAccounts, sortedTx);

            setAccounts(recalculatedAccounts);
            setTransactions(sortedTx);
            if (cloudCat.length > 0) setCategories(cloudCat);

            StorageService.saveAccounts(recalculatedAccounts);
            StorageService.saveTransactions(sortedTx);
            if (cloudCat.length > 0) StorageService.saveCategories(cloudCat);
          } else {
            // Brand new user: initialize clean isolated state (NO data from previous user!)
            const newProf: UserProfile = {
              ...StorageService.getUserProfile(),
              id: uid,
              firebaseUid: uid,
              name: firebaseUser.displayName || 'FixFly User',
              email: firebaseUser.email || '',
              photoUrl: firebaseUser.photoURL || undefined,
              storageMode: 'cloud',
              hasSelectedStorageMode: true,
              darkModeEnabled: false,
              subscription: {
                isPro: false,
                billingRegion: 'IN',
                billingCurrency: 'INR',
                amountPaid: 0,
                gateway: 'PayU',
                status: 'expired',
              },
            };

            await CloudFirestoreService.saveUserProfile(newProf);
            setProfile(newProf);
            StorageService.saveUserProfile(newProf);
            applyTheme(false);

            // Fresh accounts & transactions
            setAccounts([]);
            setTransactions([]);
            StorageService.saveAccounts([]);
            StorageService.saveTransactions([]);
            const defaults = StorageService.getCategories();
            setCategories(defaults);
          }
        } catch (err) {
          console.warn('Firestore sync failed or offline:', err);
          // Load this UID's local storage data
          setProfile(StorageService.getUserProfile());
          setAccounts(StorageService.getAccounts());
          setTransactions(StorageService.getTransactions());
          setCategories(StorageService.getCategories());
        }
      } else {
        // Logged out / Guest: Switch back to guest boundary
        StorageService.setActiveUser('guest');
        const guestProf = StorageService.getUserProfile();
        setProfile(guestProf);
        setAccounts(StorageService.getAccounts());
        setTransactions(StorageService.getTransactions());
        setCategories(StorageService.getCategories());
        applyTheme(Boolean(guestProf.darkModeEnabled));
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [applyTheme]);

  // Idle lock
  useEffect(() => {
    if (!profile.isPinLocked || !profile.pinHash) return;
    const handleVisibility = () => {
      if (document.hidden) setIsAppLocked(true);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [profile.isPinLocked, profile.pinHash]);

  // Consolidated Total Balance computed deterministically via CalculationService
  const prefCurrency = profile.preferredCurrency;
  const rates = getCachedRates().rates;

  const totalBalance = useMemo(() => {
    return CalculationService.calculateConsolidatedBalance(accounts, transactions, prefCurrency, rates);
  }, [accounts, transactions, prefCurrency, rates]);

  // Handlers for Account operations
  const handleAddAccount = useCallback((accData: any) => {
    const created = StorageService.addAccount(accData);
    const updatedAccounts = StorageService.getAccounts();
    setAccounts(updatedAccounts);
    if (profile.firebaseUid) {
      CloudFirestoreService.saveAccount(profile.firebaseUid, created);
    }
  }, [profile.firebaseUid]);

  const handleUpdateAccount = useCallback((acc: Account) => {
    StorageService.updateAccount(acc);
    const updatedAccounts = StorageService.getAccounts();
    setAccounts(updatedAccounts);
    if (profile.firebaseUid) {
      CloudFirestoreService.saveAccount(profile.firebaseUid, acc);
    }
  }, [profile.firebaseUid]);

  const handleAdjustBalance = useCallback((id: string, newBalance: number, notes?: string) => {
    StorageService.adjustBalance(id, newBalance, notes);
    const updatedAccounts = StorageService.getAccounts();
    setAccounts(updatedAccounts);
    const target = updatedAccounts.find((a) => a.id === id);
    if (target && profile.firebaseUid) {
      CloudFirestoreService.saveAccount(profile.firebaseUid, target);
    }
  }, [profile.firebaseUid]);

  const handleToggleArchive = useCallback((id: string) => {
    StorageService.toggleArchiveAccount(id);
    const updatedAccounts = StorageService.getAccounts();
    setAccounts(updatedAccounts);
    const target = updatedAccounts.find((a) => a.id === id);
    if (target && profile.firebaseUid) {
      CloudFirestoreService.saveAccount(profile.firebaseUid, target);
    }
  }, [profile.firebaseUid]);

  const handleDeleteAccount = useCallback((id: string) => {
    StorageService.deleteAccount(id);
    setAccounts(StorageService.getAccounts());
    if (profile.firebaseUid) {
      CloudFirestoreService.deleteAccount(id);
    }
  }, [profile.firebaseUid]);

  // Requirement 3 & 8: Handlers for Transaction CRUD with deterministic atomic recalculation
  const handleAddTransaction = useCallback((txData: Omit<Transaction, 'id' | 'createdAt'>) => {
    const createdTx = StorageService.addTransaction(txData);
    const allTx = StorageService.getTransactions();
    const updatedAccounts = StorageService.getAccounts();

    setTransactions(allTx);
    setAccounts(updatedAccounts);

    if (profile.firebaseUid) {
      CloudFirestoreService.saveTransaction(profile.firebaseUid, createdTx);
      // Sync affected accounts
      const src = updatedAccounts.find((a) => a.id === createdTx.accountId);
      if (src) CloudFirestoreService.saveAccount(profile.firebaseUid, src);
      if (createdTx.toAccountId) {
        const dest = updatedAccounts.find((a) => a.id === createdTx.toAccountId);
        if (dest) CloudFirestoreService.saveAccount(profile.firebaseUid, dest);
      }
    }
  }, [profile.firebaseUid]);

  const handleUpdateTransaction = useCallback((updatedTx: Transaction) => {
    StorageService.updateTransaction(updatedTx);
    const allTx = StorageService.getTransactions();
    const updatedAccounts = StorageService.getAccounts();

    setTransactions(allTx);
    setAccounts(updatedAccounts);

    if (profile.firebaseUid) {
      CloudFirestoreService.saveTransaction(profile.firebaseUid, updatedTx);
      const src = updatedAccounts.find((a) => a.id === updatedTx.accountId);
      if (src) CloudFirestoreService.saveAccount(profile.firebaseUid, src);
      if (updatedTx.toAccountId) {
        const dest = updatedAccounts.find((a) => a.id === updatedTx.toAccountId);
        if (dest) CloudFirestoreService.saveAccount(profile.firebaseUid, dest);
      }
    }
  }, [profile.firebaseUid]);

  const handleDeleteTransaction = useCallback((id: string) => {
    const target = transactions.find((t) => t.id === id);
    StorageService.deleteTransaction(id);
    const allTx = StorageService.getTransactions();
    const updatedAccounts = StorageService.getAccounts();

    setTransactions(allTx);
    setAccounts(updatedAccounts);

    if (profile.firebaseUid) {
      CloudFirestoreService.deleteTransaction(profile.firebaseUid, id);
      if (target) {
        const src = updatedAccounts.find((a) => a.id === target.accountId);
        if (src) CloudFirestoreService.saveAccount(profile.firebaseUid, src);
        if (target.toAccountId) {
          const dest = updatedAccounts.find((a) => a.id === target.toAccountId);
          if (dest) CloudFirestoreService.saveAccount(profile.firebaseUid, dest);
        }
      }
    }
  }, [transactions, profile.firebaseUid]);

  const handleAddCategory = useCallback((cat: any) => {
    StorageService.addCategory(cat);
    setCategories([...StorageService.getCategories()]);
    if (profile.firebaseUid) {
      CloudFirestoreService.saveCategory(profile.firebaseUid, cat);
    }
  }, [profile.firebaseUid]);

  const handleDeleteCategory = useCallback((id: string) => {
    StorageService.deleteCategory(id);
    setCategories([...StorageService.getCategories()]);
    setTransactions([...StorageService.getTransactions()]);
  }, []);

  const handleUpdateProfile = useCallback((updated: UserProfile) => {
    setProfile({ ...updated });
    StorageService.saveUserProfile(updated);
    if (updated.firebaseUid) {
      CloudFirestoreService.saveUserProfile(updated);
    }
  }, []);

  // Requirement 1: Toggle Theme with persistence in profile and Firestore
  const handleToggleDarkMode = () => {
    const isDark = !profile.darkModeEnabled;
    const updated: UserProfile = {
      ...profile,
      darkModeEnabled: isDark,
      themeMode: isDark ? 'dark' : 'light',
    };
    applyTheme(isDark);
    StorageService.saveUserProfile(updated);
    setProfile(updated);
    if (updated.firebaseUid) {
      CloudFirestoreService.saveUserProfile(updated);
    }
  };

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

  const getPageTitle = (tab: NavTab) => {
    switch (tab) {
      case 'home':
        return 'Dashboard Overview';
      case 'manage':
        return 'Manage Accounts & Categories';
      case 'analysis':
        return 'Financial Intelligence & Analysis';
      case 'ai_manager':
        return 'AI Money Manager Assistant';
      case 'profile':
      case 'backup':
        return 'Profile, Currency & Backups';
      default:
        return 'AI Money Manager';
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] text-slate-800 dark:text-slate-100 flex flex-col md:flex-row antialiased transition-colors duration-200">
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

      {/* 3. DESKTOP LEFT SIDEBAR (Requirement 2: md:flex, hidden on mobile) */}
      <div className="hidden md:flex">
        <DesktopSidebar
          profile={profile}
          totalBalance={totalBalance}
          accountCount={accounts.length}
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onOpenUpgrade={() => setIsPremiumModalOpen(true)}
          onToggleDarkMode={handleToggleDarkMode}
        />
      </div>

      {/* 4. MAIN CONTENT AREA (Responsive) */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header (Hidden on Desktop) */}
        <HeaderAndDrawer
          profile={profile}
          totalBalance={totalBalance}
          accountCount={accounts.length}
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          isDrawerOpen={isDrawerOpen}
          setIsDrawerOpen={setIsDrawerOpen}
          onOpenUpgrade={() => setIsPremiumModalOpen(true)}
        />

        {/* Desktop Top Header Bar (Hidden on mobile) */}
        <header className="hidden md:flex items-center justify-between px-8 py-4 bg-white dark:bg-slate-900 border-b border-slate-200/90 dark:border-slate-800 sticky top-0 z-30 shadow-2xs">
          <div>
            <h2 className="text-base font-extrabold text-[#0B1528] dark:text-white">
              {getPageTitle(activeTab)}
            </h2>
            <p className="text-xs text-slate-400">
              Personal & Business Financial Workspace · {profile.preferredCurrency} active
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Balance Pill */}
            <div className="px-3.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Total Balance</span>
              <span className="text-sm font-extrabold font-mono-numbers text-emerald-600 dark:text-emerald-400">
                {formatCurrency(totalBalance, prefCurrency)}
              </span>
            </div>

            {/* Dark mode button */}
            <button
              onClick={handleToggleDarkMode}
              className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
              title="Toggle Theme"
            >
              {profile.darkModeEnabled ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Profile Avatar */}
            <button
              onClick={() => setActiveTab('profile')}
              className="flex items-center gap-2 pl-2 pr-3 py-1 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-[#0B1528] dark:bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                {profile.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs font-bold text-slate-800 dark:text-white max-w-[100px] truncate">
                {profile.name}
              </span>
            </button>
          </div>
        </header>

        {/* Dynamic Screen View */}
        <main className="flex-1 w-full pb-20 md:pb-8">
          {activeTab === 'home' && (
            <HomeScreen
              profile={profile}
              accounts={accounts}
              transactions={transactions}
              categories={categories}
              onOpenAddModal={() => setIsAddEntryModalOpen(true)}
              onOpenCreateAccount={() => {
                setActiveTab('manage');
                setManageInitialAddAccount(true);
              }}
              onNavigateManage={() => setActiveTab('manage')}
              onUpdateTransaction={handleUpdateTransaction}
              onDeleteTransaction={handleDeleteTransaction}
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

          {(activeTab === 'profile' || activeTab === 'backup') && (
            <ProfileScreen
              profile={profile}
              accounts={accounts}
              transactions={transactions}
              totalBalance={totalBalance}
              onUpdateProfile={handleUpdateProfile}
              onOpenUpgrade={() => setIsPremiumModalOpen(true)}
              onOpenGoogleSignIn={() => setIsWelcomeModalOpen(true)}
            />
          )}
        </main>
      </div>

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

      {/* 8. Fixed Bottom Navigation (Mobile Only: md:hidden) */}
      <div className="md:hidden">
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

      {/* 9. Requirement 2: DESKTOP FLOATING ADD BUTTON (+) */}
      <button
        onClick={() => setIsAddEntryModalOpen(true)}
        className="hidden md:flex fixed bottom-8 right-8 z-40 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white shadow-2xl items-center justify-center transition-all cursor-pointer group"
        aria-label="Add Transaction"
        title="Add Transaction (+)"
      >
        <Plus className="w-7 h-7 text-white stroke-[2.5] group-hover:rotate-90 transition-transform duration-200" />
      </button>
    </div>
  );
}
