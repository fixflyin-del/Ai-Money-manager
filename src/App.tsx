/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Account,
  Transaction,
  UserProfile,
} from './types/finance';
import { StorageService, CategoryItem } from './services/storageService';
import { fetchLiveRates, getCachedRates, formatCurrency } from './services/currencyService';
import { CalculationService } from './services/calculationService';
import { AuthService, auth } from './services/firebase';
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
import { Sun, Moon, Loader2 } from 'lucide-react';

export default function App() {
  // Authentication & Startup State
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isVaultSyncing, setIsVaultSyncing] = useState(true);
  const [showSplash, setShowSplash] = useState(() => window.location.pathname !== '/admin');

  // App Data State
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

  // Active Real-Time Listeners Unsubscribe Store
  const unsubsRef = useRef<(() => void)[]>([]);

  // Apply Theme Helper
  const applyTheme = useCallback((isDark: boolean) => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  // Clean up all active listeners
  const cleanupSubscriptions = useCallback(() => {
    unsubsRef.current.forEach((unsub) => {
      try {
        unsub();
      } catch (err) {
        console.warn('Subscription cleanup error:', err);
      }
    });
    unsubsRef.current = [];
  }, []);

  // 1. Initial live rates & Play Billing listener
  useEffect(() => {
    fetchLiveRates();
    CloudFirestoreService.testConnection();

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
  }, []);

  // 2. Authoritative Firebase Authentication & Real-Time Firestore Synchronization
  useEffect(() => {
    const unsubscribeAuth = AuthService.onAuthStateChanged(async (firebaseUser) => {
      cleanupSubscriptions();

      if (firebaseUser) {
        const uid = firebaseUser.uid;
        StorageService.setActiveUser(uid);
        setIsVaultSyncing(true);

        try {
          // A. Fetch existing Firestore records to check if hydration or migration is needed
          const cloudProf = await CloudFirestoreService.getUserProfile(uid);
          const cloudAccounts = await CloudFirestoreService.getAccounts(uid);
          const cloudTx = await CloudFirestoreService.getTransactions(uid);
          const cloudCats = await CloudFirestoreService.getCategories(uid);

          const hasCloudData = Boolean(cloudProf) || cloudAccounts.length > 0 || cloudTx.length > 0;

          if (!hasCloudData) {
            // Check if user has local data from guest usage that should be migrated safely
            const localAccs = StorageService.getAccounts();
            const localTxs = StorageService.getTransactions();
            const localCats = StorageService.getCategories();
            const localProf = StorageService.getUserProfile();

            const newProf: UserProfile = {
              ...localProf,
              id: uid,
              firebaseUid: uid,
              name: firebaseUser.displayName || localProf.name || 'AI Money Manager',
              email: firebaseUser.email || localProf.email || '',
              photoUrl: firebaseUser.photoURL || undefined,
              storageMode: 'cloud',
              hasSelectedStorageMode: true,
            };

            await CloudFirestoreService.migrateLocalDataToFirestore(
              uid,
              localAccs,
              localTxs,
              localCats.length > 0 ? localCats : StorageService.getCategories(),
              newProf
            );
          } else {
            // Existing cloud profile: update locally and apply theme
            if (cloudProf) {
              setProfile(cloudProf);
              StorageService.saveUserProfile(cloudProf);
              applyTheme(Boolean(cloudProf.darkModeEnabled));
            }
          }

          // B. Attach Real-Time Firestore Listeners for cross-device synchronization
          const unsubProfile = CloudFirestoreService.subscribeToProfile(uid, (updatedProf) => {
            if (updatedProf) {
              setProfile(updatedProf);
              StorageService.saveUserProfile(updatedProf);
              applyTheme(Boolean(updatedProf.darkModeEnabled));
            }
          });
          unsubsRef.current.push(unsubProfile);

          const unsubAccounts = CloudFirestoreService.subscribeToAccounts(uid, (accs) => {
            setAccounts((prev) => {
              // Recalculate with latest transactions
              const currentTxs = StorageService.getTransactions();
              const recalculated = CalculationService.recalculateAllAccountBalances(accs, currentTxs);
              StorageService.saveAccounts(recalculated);
              return recalculated;
            });
          });
          unsubsRef.current.push(unsubAccounts);

          const unsubTx = CloudFirestoreService.subscribeToTransactions(uid, (txs) => {
            const sorted = CalculationService.sortTransactionsNewestFirst(txs);
            setTransactions(sorted);
            StorageService.saveTransactions(sorted);

            setAccounts((prevAccs) => {
              const recalculated = CalculationService.recalculateAllAccountBalances(prevAccs, sorted);
              StorageService.saveAccounts(recalculated);
              return recalculated;
            });
          });
          unsubsRef.current.push(unsubTx);

          const unsubCats = CloudFirestoreService.subscribeToCategories(uid, (cats) => {
            if (cats && cats.length > 0) {
              setCategories(cats);
              StorageService.saveCategories(cats);
            }
          });
          unsubsRef.current.push(unsubCats);
        } catch (err) {
          console.warn('Realtime Firestore synchronization notice:', err);
          // Hydrate from local cache if offline
          setProfile(StorageService.getUserProfile());
          setAccounts(StorageService.getAccounts());
          setTransactions(StorageService.getTransactions());
          setCategories(StorageService.getCategories());
        } finally {
          setIsVaultSyncing(false);
          setIsAuthReady(true);
        }
      } else {
        // Guest mode
        StorageService.setActiveUser('guest');
        const guestProf = StorageService.getUserProfile();
        setProfile(guestProf);
        setAccounts(StorageService.getAccounts());
        setTransactions(StorageService.getTransactions());
        setCategories(StorageService.getCategories());
        applyTheme(Boolean(guestProf.darkModeEnabled));
        setIsVaultSyncing(false);
        setIsAuthReady(true);
      }
    });

    return () => {
      cleanupSubscriptions();
      unsubscribeAuth();
    };
  }, [applyTheme, cleanupSubscriptions]);

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
  const handleAddAccount = useCallback(async (accData: any): Promise<boolean> => {
    const currentUid = auth.currentUser?.uid || profile.firebaseUid;
    const created = StorageService.addAccount(accData);
    const updatedAccounts = StorageService.getAccounts();

    // If authenticated, persist to Firestore and await confirmation
    if (currentUid && currentUid !== 'guest') {
      await CloudFirestoreService.saveAccount(currentUid, created);
    }

    setAccounts(updatedAccounts);
    return true;
  }, [profile.firebaseUid]);

  const handleUpdateAccount = useCallback(async (acc: Account): Promise<boolean> => {
    const currentUid = auth.currentUser?.uid || profile.firebaseUid;
    StorageService.updateAccount(acc);
    const updatedAccounts = StorageService.getAccounts();

    if (currentUid && currentUid !== 'guest') {
      await CloudFirestoreService.saveAccount(currentUid, acc);
    }

    setAccounts(updatedAccounts);
    return true;
  }, [profile.firebaseUid]);

  const handleAdjustBalance = useCallback(async (id: string, newBalance: number, notes?: string): Promise<boolean> => {
    const currentUid = auth.currentUser?.uid || profile.firebaseUid;
    StorageService.adjustBalance(id, newBalance, notes);
    const updatedAccounts = StorageService.getAccounts();
    const target = updatedAccounts.find((a) => a.id === id);

    if (target && currentUid && currentUid !== 'guest') {
      await CloudFirestoreService.saveAccount(currentUid, target);
    }

    setAccounts(updatedAccounts);
    return true;
  }, [profile.firebaseUid]);

  const handleToggleArchive = useCallback(async (id: string): Promise<boolean> => {
    const currentUid = auth.currentUser?.uid || profile.firebaseUid;
    StorageService.toggleArchiveAccount(id);
    const updatedAccounts = StorageService.getAccounts();
    const target = updatedAccounts.find((a) => a.id === id);

    if (target && currentUid && currentUid !== 'guest') {
      await CloudFirestoreService.saveAccount(currentUid, target);
    }

    setAccounts(updatedAccounts);
    return true;
  }, [profile.firebaseUid]);

  const handleDeleteAccount = useCallback(async (id: string): Promise<boolean> => {
    const currentUid = auth.currentUser?.uid || profile.firebaseUid;
    StorageService.deleteAccount(id);
    const remaining = StorageService.getAccounts();

    if (currentUid && currentUid !== 'guest') {
      await CloudFirestoreService.deleteAccount(currentUid, id);
    }

    setAccounts(remaining);
    return true;
  }, [profile.firebaseUid]);

  // Transaction CRUD handlers with atomic multi-document writes and strict error handling
  const handleAddTransaction = useCallback(async (txData: Omit<Transaction, 'id' | 'createdAt'>): Promise<boolean> => {
    const currentUid = auth.currentUser?.uid || profile.firebaseUid;

    if (!txData.amount || isNaN(txData.amount) || txData.amount <= 0) {
      throw new Error('Transaction amount must be a positive number.');
    }
    if (!txData.accountId) {
      throw new Error('Transaction requires a valid account.');
    }
    if (txData.type === 'transfer') {
      if (!txData.toAccountId) {
        throw new Error('Transfer requires a destination account.');
      }
      if (txData.accountId === txData.toAccountId) {
        throw new Error('Source and destination accounts must be different.');
      }
    }

    const newTx: Transaction = {
      ...txData,
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
      userId: currentUid || 'guest',
    };

    if (newTx.type !== 'transfer') {
      delete newTx.toAccountId;
    }

    const currentTxs = [newTx, ...StorageService.getTransactions()];
    const currentAccounts = StorageService.getAccounts();
    const recalculatedAccounts = CalculationService.recalculateAllAccountBalances(currentAccounts, currentTxs);

    // If authenticated, await atomic Firestore commit FIRST
    if (currentUid && currentUid !== 'guest') {
      const affected = recalculatedAccounts.filter(
        (a) => a.id === newTx.accountId || (newTx.type === 'transfer' && a.id === newTx.toAccountId)
      );
      await CloudFirestoreService.saveTransactionWithAccounts(currentUid, newTx, affected);
    }

    // Persist locally & update reactive state
    StorageService.saveTransactions(currentTxs);
    StorageService.saveAccounts(recalculatedAccounts);
    setTransactions(currentTxs);
    setAccounts(recalculatedAccounts);
    return true;
  }, [profile.firebaseUid]);

  const handleUpdateTransaction = useCallback(async (updatedTx: Transaction): Promise<boolean> => {
    const currentUid = auth.currentUser?.uid || profile.firebaseUid;

    if (!updatedTx.amount || isNaN(updatedTx.amount) || updatedTx.amount <= 0) {
      throw new Error('Transaction amount must be a positive number.');
    }
    if (!updatedTx.accountId) {
      throw new Error('Transaction requires a valid account.');
    }
    if (updatedTx.type === 'transfer') {
      if (!updatedTx.toAccountId) {
        throw new Error('Transfer requires a destination account.');
      }
      if (updatedTx.accountId === updatedTx.toAccountId) {
        throw new Error('Source and destination accounts must be different.');
      }
    }

    const cleanTx: Transaction = {
      ...updatedTx,
      userId: currentUid || updatedTx.userId || 'guest',
      updatedAt: new Date().toISOString(),
    };

    if (cleanTx.type !== 'transfer') {
      delete cleanTx.toAccountId;
    }

    const currentTxs = StorageService.getTransactions().map((t) => (t.id === cleanTx.id ? cleanTx : t));
    const currentAccounts = StorageService.getAccounts();
    const recalculatedAccounts = CalculationService.recalculateAllAccountBalances(currentAccounts, currentTxs);

    if (currentUid && currentUid !== 'guest') {
      const affected = recalculatedAccounts.filter(
        (a) => a.id === cleanTx.accountId || (cleanTx.type === 'transfer' && a.id === cleanTx.toAccountId)
      );
      await CloudFirestoreService.saveTransactionWithAccounts(currentUid, cleanTx, affected);
    }

    StorageService.saveTransactions(currentTxs);
    StorageService.saveAccounts(recalculatedAccounts);
    setTransactions(currentTxs);
    setAccounts(recalculatedAccounts);
    return true;
  }, [profile.firebaseUid]);

  const handleDeleteTransaction = useCallback(async (id: string): Promise<boolean> => {
    const currentUid = auth.currentUser?.uid || profile.firebaseUid;
    const target = transactions.find((t) => t.id === id);
    const currentTxs = StorageService.getTransactions().filter((t) => t.id !== id);
    const currentAccounts = StorageService.getAccounts();
    const recalculatedAccounts = CalculationService.recalculateAllAccountBalances(currentAccounts, currentTxs);

    if (currentUid && currentUid !== 'guest') {
      const affected = recalculatedAccounts.filter(
        (a) => target && (a.id === target.accountId || (target.type === 'transfer' && a.id === target.toAccountId))
      );
      await CloudFirestoreService.deleteTransactionWithAccounts(currentUid, id, affected);
    }

    StorageService.saveTransactions(currentTxs);
    StorageService.saveAccounts(recalculatedAccounts);
    setTransactions(currentTxs);
    setAccounts(recalculatedAccounts);
    return true;
  }, [profile.firebaseUid, transactions]);

  const handleAddCategory = useCallback(async (cat: any): Promise<boolean> => {
    const currentUid = auth.currentUser?.uid || profile.firebaseUid;
    const created = StorageService.addCategory(cat);
    const updated = StorageService.getCategories();
    setCategories(updated);

    if (currentUid && currentUid !== 'guest') {
      await CloudFirestoreService.saveCategory(currentUid, created);
    }
    return true;
  }, [profile.firebaseUid]);

  const handleDeleteCategory = useCallback(async (id: string): Promise<boolean> => {
    const currentUid = auth.currentUser?.uid || profile.firebaseUid;
    StorageService.deleteCategory(id);
    const updatedCats = StorageService.getCategories();
    setCategories(updatedCats);

    if (currentUid && currentUid !== 'guest') {
      await CloudFirestoreService.deleteCategory(currentUid, id);
    }
    return true;
  }, [profile.firebaseUid]);

  const handleUpdateProfile = useCallback(async (updated: UserProfile) => {
    setProfile({ ...updated });
    StorageService.saveUserProfile(updated);
    const currentUid = auth.currentUser?.uid || updated.firebaseUid;
    if (currentUid && currentUid !== 'guest') {
      await CloudFirestoreService.saveUserProfile({ ...updated, firebaseUid: currentUid });
    }
  }, []);

  // Theme toggle with Firestore persistence
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
    const currentUid = auth.currentUser?.uid || updated.firebaseUid;
    if (currentUid && currentUid !== 'guest') {
      CloudFirestoreService.saveUserProfile(updated);
    }
  };

  // Welcome modal handlers
  const handleSelectGoogleAuth = () => {
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

  // Pre-load / Vault initialization screen to prevent race conditions or data flash
  if (!isAuthReady || isVaultSyncing) {
    return (
      <div className="fixed inset-0 bg-[#0B1528] flex flex-col items-center justify-center p-6 text-white space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-2xl flex items-center justify-center">
          <div className="w-full h-full bg-[#0B1528] rounded-[14px] flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          </div>
        </div>
        <div className="text-center space-y-1">
          <h2 className="text-base font-extrabold tracking-tight">FixFly AI Money Manager</h2>
          <p className="text-xs text-slate-400">Connecting to secure financial ledger...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] text-slate-800 dark:text-slate-100 flex flex-col md:flex-row antialiased transition-colors duration-200">
      {/* 1. First-Launch Welcome & Auth Popup */}
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

      {/* 3. DESKTOP LEFT SIDEBAR */}
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

      {/* 4. MAIN VIEWPORT */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Mobile Header and Drawer Navigation */}
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

        {/* Desktop Top Header Bar */}
        <header className="hidden md:flex sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200/90 dark:border-slate-800 px-6 py-3.5 items-center justify-between">
          <div>
            <h2 className="text-base font-extrabold text-[#0B1528] dark:text-white capitalize">
              {activeTab === 'home'
                ? 'Dashboard Overview'
                : activeTab === 'manage'
                ? 'Manage Accounts & Categories'
                : activeTab === 'analysis'
                ? 'Financial Intelligence & Analysis'
                : activeTab === 'ai_manager'
                ? 'AI Money Manager Assistant'
                : 'Profile, Currency & Security'}
            </h2>
            <p className="text-xs text-slate-400">
              {profile.firebaseUid
                ? 'Cloud Firestore Synced · Real-time ledger active'
                : 'Local Secure Ledger'}
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

      {/* 8. Mobile Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenAddModal={() => setIsAddEntryModalOpen(true)}
      />
    </div>
  );
}
