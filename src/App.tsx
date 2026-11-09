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
import { Sun, Moon, User, Bell } from 'lucide-react';

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

  // Real Firebase onAuthStateChanged listener for seamless session sync
  useEffect(() => {
    const unsubscribe = AuthService.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Check if cloud profile exists
          const cloudProf = await CloudFirestoreService.getUserProfile(firebaseUser.uid);
          if (cloudProf) {
            setProfile(cloudProf);
            StorageService.saveUserProfile(cloudProf);
          } else {
            // Seed profile to cloud
            const newProf: UserProfile = {
              ...StorageService.getUserProfile(),
              firebaseUid: firebaseUser.uid,
              name: firebaseUser.displayName || 'FixFly User',
              email: firebaseUser.email || '',
              photoUrl: firebaseUser.photoURL || undefined,
              storageMode: 'cloud',
            };
            await CloudFirestoreService.saveUserProfile(newProf);
            setProfile(newProf);
            StorageService.saveUserProfile(newProf);
          }

          // Fetch cloud accounts, categories, transactions
          const cloudAccounts = await CloudFirestoreService.getAccounts(firebaseUser.uid);
          if (cloudAccounts.length > 0) {
            setAccounts(cloudAccounts);
            localStorage.setItem('aimm_accounts', JSON.stringify(cloudAccounts));
          }

          const cloudTx = await CloudFirestoreService.getTransactions(firebaseUser.uid);
          if (cloudTx.length > 0) {
            setTransactions(cloudTx);
            localStorage.setItem('aimm_transactions', JSON.stringify(cloudTx));
          }

          const cloudCat = await CloudFirestoreService.getCategories(firebaseUser.uid);
          if (cloudCat.length > 0) {
            setCategories(cloudCat);
            localStorage.setItem('aimm_categories', JSON.stringify(cloudCat));
          }
        } catch (err) {
          console.warn('Firestore sync failed or offline, continuing with local:', err);
        }
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
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
    if (profile.firebaseUid) {
      CloudFirestoreService.saveAccount(profile.firebaseUid, accData);
    }
  }, [profile.firebaseUid]);

  const handleUpdateAccount = useCallback((acc: Account) => {
    StorageService.updateAccount(acc);
    setAccounts([...StorageService.getAccounts()]);
    if (profile.firebaseUid) {
      CloudFirestoreService.saveAccount(profile.firebaseUid, acc);
    }
  }, [profile.firebaseUid]);

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
    if (profile.firebaseUid) {
      const allTx = StorageService.getTransactions();
      const latest = allTx[0];
      if (latest) {
        CloudFirestoreService.saveTransaction(profile.firebaseUid, latest);
      }
    }
  }, [profile.firebaseUid]);

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
    if (updated.firebaseUid) {
      CloudFirestoreService.saveUserProfile(updated);
    }
  }, []);

  const handleToggleDarkMode = () => {
    const isDark = !profile.darkModeEnabled;
    const updated = { ...profile, darkModeEnabled: isDark };
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    StorageService.saveUserProfile(updated);
    setProfile(updated);
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
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] text-slate-800 dark:text-slate-100 flex flex-col md:flex-row antialiased">
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

        {/* Desktop Top Header Bar (Requirement 2: Hidden on mobile) */}
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
    </div>
  );
}
