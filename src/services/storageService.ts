/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Account,
  Budget,
  CurrencyCode,
  RecurringBill,
  SavingsGoal,
  Transaction,
  UserProfile,
} from '../types/finance';
import { CalculationService } from './calculationService';

export interface CategoryItem {
  id: string;
  name: string;
  type: 'income' | 'expense';
  icon: string;
  color: string;
  isDefault?: boolean;
}

export const DEFAULT_CATEGORIES: CategoryItem[] = [
  // 12 Expense Categories
  { id: 'cat_food', name: 'Food & Dining', type: 'expense', icon: 'Utensils', color: '#F59E0B' },
  { id: 'cat_groceries', name: 'Groceries', type: 'expense', icon: 'ShoppingCart', color: '#10B981' },
  { id: 'cat_transport', name: 'Transport', type: 'expense', icon: 'Car', color: '#3B82F6' },
  { id: 'cat_shopping', name: 'Shopping', type: 'expense', icon: 'ShoppingBag', color: '#EC4899' },
  { id: 'cat_utilities', name: 'Utilities & Bills', type: 'expense', icon: 'Zap', color: '#8B5CF6' },
  { id: 'cat_entertainment', name: 'Entertainment', type: 'expense', icon: 'Film', color: '#06B6D4' },
  { id: 'cat_health', name: 'Health & Medical', type: 'expense', icon: 'HeartPulse', color: '#EF4444' },
  { id: 'cat_travel', name: 'Travel & Trips', type: 'expense', icon: 'Plane', color: '#14B8A6' },
  { id: 'cat_education', name: 'Education', type: 'expense', icon: 'GraduationCap', color: '#6366F1' },
  { id: 'cat_subs', name: 'Subscriptions', type: 'expense', icon: 'Repeat', color: '#F97316' },
  { id: 'cat_personal', name: 'Personal Care', type: 'expense', icon: 'Sparkles', color: '#A855F7' },
  { id: 'cat_housing', name: 'Housing & Rent', type: 'expense', icon: 'Home', color: '#64748B' },
  // 8 Income Categories
  { id: 'cat_salary', name: 'Salary', type: 'income', icon: 'Briefcase', color: '#10B981' },
  { id: 'cat_freelance', name: 'Freelance & Consulting', type: 'income', icon: 'Laptop', color: '#3B82F6' },
  { id: 'cat_business', name: 'Business Revenue', type: 'income', icon: 'TrendingUp', color: '#6366F1' },
  { id: 'cat_investments', name: 'Investments & Returns', type: 'income', icon: 'Coins', color: '#EAB308' },
  { id: 'cat_rental', name: 'Rental Income', type: 'income', icon: 'Building', color: '#06B6D4' },
  { id: 'cat_dividends', name: 'Dividends', type: 'income', icon: 'PieChart', color: '#8B5CF6' },
  { id: 'cat_cashback', name: 'Cashback & Rewards', type: 'income', icon: 'Gift', color: '#EC4899' },
  { id: 'cat_other_inc', name: 'Other Income', type: 'income', icon: 'PlusCircle', color: '#64748B' },
];

export const DEFAULT_USER_PROFILE: UserProfile = {
  id: 'usr_aimoney_guest',
  name: 'AI Money Manager',
  email: '',
  mobileNumber: '',
  preferredCurrency: 'INR',
  storageMode: 'local',
  hasSelectedStorageMode: false,
  isPinLocked: false,
  pinHash: '',
  biometricsEnabled: true,
  autoLockMinutes: 5,
  autoBackupSchedule: 'daily',
  darkModeEnabled: false,
  themeMode: 'light',
  dailyAiQuestionsRemaining: 1,
  subscription: {
    isPro: false,
    billingRegion: 'IN',
    billingCurrency: 'INR',
    amountPaid: 0,
    gateway: 'PayU',
    status: 'expired',
  },
};

export class StorageService {
  private static activeUserId: string = 'guest';

  /**
   * Sets the active user boundary.
   * If a Firebase UID is supplied, all operations are isolated to that UID.
   */
  static setActiveUser(userId: string | null | undefined): void {
    this.activeUserId = userId && userId.trim() ? userId.trim() : 'guest';
  }

  static getActiveUser(): string {
    return this.activeUserId;
  }

  private static getKey(baseKey: string): string {
    return this.activeUserId === 'guest' ? baseKey : `${baseKey}_${this.activeUserId}`;
  }

  // --- Profile ---
  static getUserProfile(): UserProfile {
    try {
      const key = this.getKey('aimoney_user_profile');
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Cleanse any legacy Fixfly or Al Money Manager typo
        let sanitizedName = parsed.name || 'AI Money Manager';
        if (sanitizedName === 'Fixfly' || sanitizedName === 'Al Money Manager') {
          sanitizedName = 'AI Money Manager';
        }
        return {
          ...DEFAULT_USER_PROFILE,
          ...parsed,
          name: sanitizedName,
          hasSelectedStorageMode: localStorage.getItem(this.getKey('aimoney_mode_selected')) === 'true',
        };
      }
    } catch {
      // fallback
    }
    return {
      ...DEFAULT_USER_PROFILE,
      hasSelectedStorageMode: localStorage.getItem(this.getKey('aimoney_mode_selected')) === 'true',
    };
  }

  static getProfile(): UserProfile {
    return this.getUserProfile();
  }

  static saveUserProfile(profile: UserProfile): void {
    const key = this.getKey('aimoney_user_profile');
    localStorage.setItem(key, JSON.stringify(profile));
    if (profile.hasSelectedStorageMode) {
      localStorage.setItem(this.getKey('aimoney_mode_selected'), 'true');
    }
  }

  static saveProfile(profile: UserProfile): void {
    this.saveUserProfile(profile);
  }

  static markStorageModeSelected(mode: 'local' | 'cloud', name?: string, email?: string): UserProfile {
    const profile = this.getUserProfile();
    profile.storageMode = mode;
    profile.hasSelectedStorageMode = true;
    if (name) profile.name = name;
    if (email) profile.email = email;
    localStorage.setItem(this.getKey('aimoney_mode_selected'), 'true');
    this.saveUserProfile(profile);
    return profile;
  }

  static updatePreferredCurrency(currency: CurrencyCode): UserProfile {
    const profile = this.getUserProfile();
    profile.preferredCurrency = currency;
    this.saveUserProfile(profile);
    return profile;
  }

  // --- Accounts ---
  static getAccounts(): Account[] {
    try {
      const key = this.getKey('aimoney_accounts');
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return CalculationService.sortAccountsByOrder(parsed);
        }
      }
    } catch {
      // fallback
    }
    return [];
  }

  static saveAccounts(accounts: Account[]): void {
    const key = this.getKey('aimoney_accounts');
    localStorage.setItem(key, JSON.stringify(accounts));
  }

  static reorderAccounts(orderedAccounts: Account[]): Account[] {
    const now = new Date().toISOString();
    const normalized = orderedAccounts.map((acc, index) => ({
      ...acc,
      sortOrder: index,
      updatedAt: now,
    }));
    this.saveAccounts(normalized);
    return normalized;
  }

  static addAccount(
    accountData: Omit<Account, 'id' | 'updatedAt' | 'createdAt' | 'openingPosition' | 'adjustments' | 'netTransfers'> & {
      openingPosition?: number;
    }
  ): Account {
    const accounts = this.getAccounts();
    const opening = accountData.openingPosition !== undefined ? Number(accountData.openingPosition) : Number(accountData.balance || 0);
    const maxSortOrder = accounts.reduce(
      (max, acc, idx) => Math.max(max, typeof acc.sortOrder === 'number' && isFinite(acc.sortOrder) ? acc.sortOrder : idx),
      -1
    );

    const newAccount: Account = {
      ...accountData,
      id: `acc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      openingPosition: opening,
      balance: opening,
      adjustments: 0,
      netTransfers: 0,
      sortOrder: maxSortOrder + 1,
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString(),
    };

    accounts.push(newAccount);

    // Deterministically recalculate balances with transactions
    const transactions = this.getTransactions();
    const recalculated = CalculationService.recalculateAllAccountBalances(accounts, transactions);
    this.saveAccounts(recalculated);

    return recalculated.find((a) => a.id === newAccount.id) || newAccount;
  }

  static updateAccount(updated: Account): void {
    const accounts = this.getAccounts().map((a) => (a.id === updated.id ? updated : a));
    const transactions = this.getTransactions();
    const recalculated = CalculationService.recalculateAllAccountBalances(accounts, transactions);
    this.saveAccounts(recalculated);
  }

  static adjustBalance(id: string, newBalance: number, notes?: string): void {
    const accounts = this.getAccounts();
    const target = accounts.find((a) => a.id === id);
    if (!target) return;

    // Adjustment delta
    const currentCalculated = CalculationService.calculateAccountBalance(target, this.getTransactions());
    const adjustmentDelta = newBalance - currentCalculated;
    target.adjustments = (target.adjustments || 0) + adjustmentDelta;
    target.notes = notes || target.notes;
    target.updatedAt = new Date().toISOString();

    const transactions = this.getTransactions();
    const recalculated = CalculationService.recalculateAllAccountBalances(accounts, transactions);
    this.saveAccounts(recalculated);
  }

  static toggleArchiveAccount(id: string): void {
    const accounts = this.getAccounts();
    const target = accounts.find((a) => a.id === id);
    if (target) {
      target.archived = !target.archived;
      target.updatedAt = new Date().toISOString();
      this.saveAccounts(accounts);
    }
  }

  static deleteAccount(id: string): void {
    const accounts = this.getAccounts()
      .filter((a) => a.id !== id)
      .map((acc, index) => ({ ...acc, sortOrder: index }));
    this.saveAccounts(accounts);
  }

  // --- Transactions ---
  static getTransactions(): Transaction[] {
    try {
      const key = this.getKey('aimoney_transactions');
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed: Transaction[] = JSON.parse(raw);
        return CalculationService.sortTransactionsNewestFirst(parsed);
      }
    } catch {
      // fallback
    }
    return [];
  }

  static saveTransactions(transactions: Transaction[]): void {
    const sorted = CalculationService.sortTransactionsNewestFirst(transactions);
    const key = this.getKey('aimoney_transactions');
    localStorage.setItem(key, JSON.stringify(sorted));
  }

  static addTransaction(tx: Omit<Transaction, 'id' | 'createdAt'>): Transaction {
    const transactions = this.getTransactions();

    const newTx: Transaction = {
      ...tx,
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      rateDate: tx.rateDate || new Date().toISOString().split('T')[0],
      rateSource: tx.rateSource || 'FixFly Reserve Engine',
      createdAt: new Date().toISOString(),
    };

    if (newTx.type !== 'transfer') {
      delete newTx.toAccountId;
    }

    transactions.unshift(newTx);
    const sorted = CalculationService.sortTransactionsNewestFirst(transactions);
    this.saveTransactions(sorted);

    // Atomic recalculation of all account balances
    const accounts = this.getAccounts();
    const recalculatedAccounts = CalculationService.recalculateAllAccountBalances(accounts, sorted);
    this.saveAccounts(recalculatedAccounts);

    return newTx;
  }

  static updateTransaction(updatedTx: Transaction): void {
    const cleanTx = { ...updatedTx };
    if (cleanTx.type !== 'transfer') {
      delete cleanTx.toAccountId;
    }
    const transactions = this.getTransactions().map((t) => (t.id === cleanTx.id ? cleanTx : t));
    const sorted = CalculationService.sortTransactionsNewestFirst(transactions);
    this.saveTransactions(sorted);

    // Atomic recalculation of all account balances
    const accounts = this.getAccounts();
    const recalculatedAccounts = CalculationService.recalculateAllAccountBalances(accounts, sorted);
    this.saveAccounts(recalculatedAccounts);
  }

  static deleteTransaction(id: string): void {
    const transactions = this.getTransactions().filter((t) => t.id !== id);
    this.saveTransactions(transactions);

    // Atomic recalculation of all account balances
    const accounts = this.getAccounts();
    const recalculatedAccounts = CalculationService.recalculateAllAccountBalances(accounts, transactions);
    this.saveAccounts(recalculatedAccounts);
  }

  // --- Categories (20 categories) ---
  static getCategories(): CategoryItem[] {
    try {
      const key = this.getKey('aimoney_categories');
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter((c) => c && typeof c.id === 'string' && typeof c.name === 'string');
        }
      }
    } catch {
      // fallback
    }
    const defaults = [...DEFAULT_CATEGORIES];
    this.saveCategories(defaults);
    return defaults;
  }

  static saveCategories(categories: CategoryItem[]): void {
    const key = this.getKey('aimoney_categories');
    localStorage.setItem(key, JSON.stringify(categories));
  }

  static addCategory(cat: Omit<CategoryItem, 'id'>): CategoryItem {
    let list = this.getCategories();
    const newCat: CategoryItem = {
      ...cat,
      name: cat.name.trim(),
      id: `cat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      isDefault: Boolean(cat.isDefault),
    };
    if (newCat.isDefault) {
      list = list.map((c) => (c.type === newCat.type ? { ...c, isDefault: false } : c));
    }
    list.push(newCat);
    this.saveCategories(list);
    return newCat;
  }

  static updateCategory(updatedCat: CategoryItem): void {
    const list = this.getCategories();
    const oldCat = list.find((c) => c.id === updatedCat.id);
    const normalized: CategoryItem = {
      ...updatedCat,
      name: updatedCat.name.trim(),
      isDefault: Boolean(updatedCat.isDefault),
    };

    const updatedList = list.map((c) => {
      if (c.id === normalized.id) return normalized;
      if (normalized.isDefault && c.type === normalized.type && c.isDefault) {
        return { ...c, isDefault: false };
      }
      return c;
    });
    this.saveCategories(updatedList);

    if (oldCat && oldCat.name !== normalized.name) {
      const transactions = this.getTransactions();
      let hasChanges = false;
      const updatedTxs = transactions.map((tx) => {
        if (tx.category === oldCat.name) {
          hasChanges = true;
          return { ...tx, category: normalized.name };
        }
        return tx;
      });
      if (hasChanges) {
        this.saveTransactions(updatedTxs);
      }
    }
  }

  static getTransactionsUsingCategory(categoryName: string): Transaction[] {
    const transactions = this.getTransactions();
    return transactions.filter((tx) => tx.category === categoryName);
  }

  static deleteCategory(id: string, fallbackCategory: string = 'General'): { success: boolean; reassignedCount: number } {
    const list = this.getCategories();
    const target = list.find((c) => c.id === id);
    if (!target) return { success: false, reassignedCount: 0 };

    const transactions = this.getTransactions();
    let reassignedCount = 0;
    const updatedTxs = transactions.map((tx) => {
      if (tx.category === target.name) {
        reassignedCount++;
        return { ...tx, category: fallbackCategory };
      }
      return tx;
    });

    if (reassignedCount > 0) {
      this.saveTransactions(updatedTxs);
    }

    const filtered = list.filter((c) => c.id !== id);
    this.saveCategories(filtered);
    return { success: true, reassignedCount };
  }

  // --- Budgets ---
  static getBudgets(): Budget[] {
    try {
      const key = this.getKey('aimoney_budgets');
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch {
      // fallback
    }
    return [];
  }

  static saveBudgets(budgets: Budget[]): void {
    const key = this.getKey('aimoney_budgets');
    localStorage.setItem(key, JSON.stringify(budgets));
  }

  // --- Goals ---
  static getGoals(): SavingsGoal[] {
    try {
      const key = this.getKey('aimoney_goals');
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch {
      // fallback
    }
    return [];
  }

  static saveGoals(goals: SavingsGoal[]): void {
    const key = this.getKey('aimoney_goals');
    localStorage.setItem(key, JSON.stringify(goals));
  }

  // --- Recurring ---
  static getRecurringBills(): RecurringBill[] {
    try {
      const key = this.getKey('aimoney_recurring');
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch {
      // fallback
    }
    return [];
  }

  static saveRecurringBills(bills: RecurringBill[]): void {
    const key = this.getKey('aimoney_recurring');
    localStorage.setItem(key, JSON.stringify(bills));
  }

  /**
   * Clears state for active user when switching or starting fresh
   */
  static clearActiveUserData(): void {
    const keyAcc = this.getKey('aimoney_accounts');
    const keyTx = this.getKey('aimoney_transactions');
    localStorage.removeItem(keyAcc);
    localStorage.removeItem(keyTx);
  }

  static exportFullBackup(): string {
    const backup = {
      accounts: this.getAccounts(),
      transactions: this.getTransactions(),
      categories: this.getCategories(),
      profile: this.getProfile(),
      budgets: this.getBudgets(),
      goals: this.getGoals(),
      recurring: this.getRecurringBills(),
      exportedAt: new Date().toISOString(),
      version: '6.1.1',
    };
    return JSON.stringify(backup, null, 2);
  }

  static importFullBackup(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString);
      if (Array.isArray(data.accounts)) this.saveAccounts(data.accounts);
      if (Array.isArray(data.transactions)) this.saveTransactions(data.transactions);
      if (Array.isArray(data.categories)) this.saveCategories(data.categories);
      if (data.profile) this.saveProfile(data.profile);
      if (Array.isArray(data.budgets)) this.saveBudgets(data.budgets);
      if (Array.isArray(data.goals)) this.saveGoals(data.goals);
      if (Array.isArray(data.recurring)) this.saveRecurringBills(data.recurring);
      return true;
    } catch {
      return false;
    }
  }

  static resetToDemoData(): void {
    this.clearActiveUserData();
    localStorage.removeItem(this.getKey('aimoney_categories'));
    localStorage.removeItem(this.getKey('aimoney_profile'));
  }

  /**
   * Strictly limits free daily AI queries to 1 per user per day to protect admin AI credits.
   */
  static getDailyAiQuota(userId: string): { remaining: number; date: string } {
    const today = new Date().toISOString().slice(0, 10);
    const key = `aimoney_daily_ai_${userId || 'guest'}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.date === today) {
          const used = Number(parsed.used) || 0;
          return { remaining: Math.max(0, 1 - used), date: today };
        }
      }
    } catch {
      // Fallback
    }
    return { remaining: 1, date: today };
  }

  static consumeDailyAiQuota(userId: string): void {
    const today = new Date().toISOString().slice(0, 10);
    const key = `aimoney_daily_ai_${userId || 'guest'}`;
    try {
      localStorage.setItem(key, JSON.stringify({ date: today, used: 1 }));
    } catch {
      // Ignore
    }
  }
}
