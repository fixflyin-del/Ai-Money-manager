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
import { convertCurrency, getCachedRates } from './currencyService';

const KEY_USER = 'aimoney_user_profile';
const KEY_ACCOUNTS = 'aimoney_accounts';
const KEY_TRANSACTIONS = 'aimoney_transactions';
const KEY_BUDGETS = 'aimoney_budgets';
const KEY_GOALS = 'aimoney_goals';
const KEY_RECURRING = 'aimoney_recurring';
const KEY_CATEGORIES = 'aimoney_categories';
const KEY_MODE_SELECTED = 'aimoney_mode_selected';

export interface CategoryItem {
  id: string;
  name: string;
  type: 'income' | 'expense';
  icon: string;
  color: string;
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
  id: 'usr_aimoney_001',
  name: 'Al Money Manager', // Matches Screenshot 1, 2, 4, 5, 6, 7!
  email: 'fixfly.in@gmail.com',
  mobileNumber: '+91 98765 43210',
  preferredCurrency: 'INR',
  storageMode: 'local',
  hasSelectedStorageMode: false,
  isPinLocked: false,
  pinHash: '',
  biometricsEnabled: true,
  autoLockMinutes: 5,
  autoBackupSchedule: 'daily',
  darkModeEnabled: false,
  dailyAiQuestionsRemaining: 2,
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
  // --- Profile ---
  static getUserProfile(): UserProfile {
    try {
      const raw = localStorage.getItem(KEY_USER);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          ...DEFAULT_USER_PROFILE,
          ...parsed,
          hasSelectedStorageMode: localStorage.getItem(KEY_MODE_SELECTED) === 'true',
        };
      }
    } catch {
      // fallback
    }
    return {
      ...DEFAULT_USER_PROFILE,
      hasSelectedStorageMode: localStorage.getItem(KEY_MODE_SELECTED) === 'true',
    };
  }

  static saveUserProfile(profile: UserProfile): void {
    localStorage.setItem(KEY_USER, JSON.stringify(profile));
    if (profile.hasSelectedStorageMode) {
      localStorage.setItem(KEY_MODE_SELECTED, 'true');
    }
  }

  static markStorageModeSelected(mode: 'local' | 'cloud', name?: string, email?: string): UserProfile {
    const profile = this.getUserProfile();
    profile.storageMode = mode;
    profile.hasSelectedStorageMode = true;
    if (name) profile.name = name;
    if (email) profile.email = email;
    localStorage.setItem(KEY_MODE_SELECTED, 'true');
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
      const raw = localStorage.getItem(KEY_ACCOUNTS);
      if (raw) return JSON.parse(raw);
    } catch {
      // fallback
    }
    return [];
  }

  static saveAccounts(accounts: Account[]): void {
    localStorage.setItem(KEY_ACCOUNTS, JSON.stringify(accounts));
  }

  static addAccount(accountData: Omit<Account, 'id' | 'updatedAt' | 'createdAt' | 'openingPosition' | 'adjustments' | 'netTransfers'> & { openingPosition?: number }): Account {
    const accounts = this.getAccounts();
    const newAccount: Account = {
      ...accountData,
      id: `acc_${Date.now()}`,
      openingPosition: accountData.openingPosition ?? accountData.balance,
      adjustments: 0,
      netTransfers: 0,
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString(),
    };
    accounts.push(newAccount);
    this.saveAccounts(accounts);
    return newAccount;
  }

  static updateAccount(updated: Account): void {
    const accounts = this.getAccounts().map((a) => (a.id === updated.id ? updated : a));
    this.saveAccounts(accounts);
  }

  static adjustBalance(id: string, newBalance: number, notes?: string): void {
    const accounts = this.getAccounts();
    const target = accounts.find((a) => a.id === id);
    if (target) {
      const diff = newBalance - target.balance;
      target.adjustments += diff;
      target.balance = newBalance;
      target.updatedAt = new Date().toISOString();
      this.saveAccounts(accounts);

      // Log adjustment record
      this.addTransaction({
        type: diff >= 0 ? 'income' : 'expense',
        amount: Math.abs(diff),
        currency: target.currency,
        category: 'Adjustment',
        description: `Balance Adjustment: ${target.name}`,
        accountId: target.id,
        paymentMode: 'Other',
        date: new Date().toISOString().split('T')[0],
        notes: notes || 'Manual balance adjustment',
        tags: ['Adjustment'],
      });
    }
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
    const accounts = this.getAccounts().filter((a) => a.id !== id);
    this.saveAccounts(accounts);
  }

  // --- Transactions ---
  static getTransactions(): Transaction[] {
    try {
      const raw = localStorage.getItem(KEY_TRANSACTIONS);
      if (raw) return JSON.parse(raw);
    } catch {
      // fallback
    }
    return [];
  }

  static saveTransactions(transactions: Transaction[]): void {
    localStorage.setItem(KEY_TRANSACTIONS, JSON.stringify(transactions));
  }

  static addTransaction(tx: Omit<Transaction, 'id' | 'createdAt'>): Transaction {
    const transactions = this.getTransactions();
    const rates = getCachedRates().rates;

    const newTx: Transaction = {
      ...tx,
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      exchangeRateAtTransaction: tx.exchangeRateAtTransaction || rates[tx.currency] || 1,
      rateDate: tx.rateDate || new Date().toISOString().split('T')[0],
      rateSource: tx.rateSource || 'FixFly Reserve Engine',
      createdAt: new Date().toISOString(),
    };

    // Update account balances appropriately
    const accounts = this.getAccounts();
    const account = accounts.find((a) => a.id === tx.accountId);

    if (account) {
      const amountInAccountCurrency = convertCurrency(
        tx.amount,
        tx.currency,
        account.currency,
        rates
      );

      if (tx.type === 'income') {
        account.balance += amountInAccountCurrency;
      } else if (tx.type === 'expense') {
        account.balance -= amountInAccountCurrency;
      } else if (tx.type === 'transfer' && tx.toAccountId) {
        account.balance -= amountInAccountCurrency;
        account.netTransfers -= amountInAccountCurrency;
        const targetAcc = accounts.find((a) => a.id === tx.toAccountId);
        if (targetAcc) {
          const amountInTargetCurrency = convertCurrency(
            tx.amount,
            tx.currency,
            targetAcc.currency,
            rates
          );
          targetAcc.balance += amountInTargetCurrency;
          targetAcc.netTransfers += amountInTargetCurrency;
          targetAcc.updatedAt = new Date().toISOString();
        }
      }
      account.updatedAt = new Date().toISOString();
      this.saveAccounts(accounts);
    }

    transactions.unshift(newTx);
    this.saveTransactions(transactions);
    return newTx;
  }

  static deleteTransaction(id: string): void {
    const transactions = this.getTransactions();
    const tx = transactions.find((t) => t.id === id);
    if (!tx) return;

    // Reconcile balance
    const accounts = this.getAccounts();
    const account = accounts.find((a) => a.id === tx.accountId);
    const rates = getCachedRates().rates;

    if (account) {
      const amountInAccountCurrency = convertCurrency(
        tx.amount,
        tx.currency,
        account.currency,
        rates
      );
      if (tx.type === 'income') {
        account.balance -= amountInAccountCurrency;
      } else if (tx.type === 'expense') {
        account.balance += amountInAccountCurrency;
      } else if (tx.type === 'transfer' && tx.toAccountId) {
        account.balance += amountInAccountCurrency;
        account.netTransfers += amountInAccountCurrency;
        const targetAcc = accounts.find((a) => a.id === tx.toAccountId);
        if (targetAcc) {
          const amountInTargetCurrency = convertCurrency(
            tx.amount,
            tx.currency,
            targetAcc.currency,
            rates
          );
          targetAcc.balance -= amountInTargetCurrency;
          targetAcc.netTransfers -= amountInTargetCurrency;
          targetAcc.updatedAt = new Date().toISOString();
        }
      }
      account.updatedAt = new Date().toISOString();
      this.saveAccounts(accounts);
    }

    this.saveTransactions(transactions.filter((t) => t.id !== id));
  }

  // --- Categories (20 categories) ---
  static getCategories(): CategoryItem[] {
    try {
      const raw = localStorage.getItem(KEY_CATEGORIES);
      if (raw) return JSON.parse(raw);
    } catch {
      // fallback
    }
    this.saveCategories(DEFAULT_CATEGORIES);
    return DEFAULT_CATEGORIES;
  }

  static saveCategories(categories: CategoryItem[]): void {
    localStorage.setItem(KEY_CATEGORIES, JSON.stringify(categories));
  }

  static addCategory(cat: Omit<CategoryItem, 'id'>): CategoryItem {
    const list = this.getCategories();
    const newCat: CategoryItem = {
      ...cat,
      id: `cat_${Date.now()}`,
    };
    list.push(newCat);
    this.saveCategories(list);
    return newCat;
  }

  static deleteCategory(id: string): void {
    const list = this.getCategories().filter((c) => c.id !== id);
    this.saveCategories(list);
  }

  // --- Budgets ---
  static getBudgets(): Budget[] {
    try {
      const raw = localStorage.getItem(KEY_BUDGETS);
      if (raw) return JSON.parse(raw);
    } catch {
      // fallback
    }
    return [];
  }

  static saveBudgets(budgets: Budget[]): void {
    localStorage.setItem(KEY_BUDGETS, JSON.stringify(budgets));
  }

  static addBudget(budget: Omit<Budget, 'id'>): Budget {
    const list = this.getBudgets();
    const newBgt: Budget = {
      ...budget,
      id: `bgt_${Date.now()}`,
    };
    list.push(newBgt);
    this.saveBudgets(list);
    return newBgt;
  }

  // --- Goals ---
  static getGoals(): SavingsGoal[] {
    try {
      const raw = localStorage.getItem(KEY_GOALS);
      if (raw) return JSON.parse(raw);
    } catch {
      // fallback
    }
    return [];
  }

  static saveGoals(goals: SavingsGoal[]): void {
    localStorage.setItem(KEY_GOALS, JSON.stringify(goals));
  }

  static addGoal(goal: Omit<SavingsGoal, 'id'>): SavingsGoal {
    const goals = this.getGoals();
    const newGoal: SavingsGoal = {
      ...goal,
      id: `goal_${Date.now()}`,
    };
    goals.push(newGoal);
    this.saveGoals(goals);
    return newGoal;
  }

  static depositToGoal(goalId: string, amount: number, accountId?: string): void {
    const goals = this.getGoals();
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return;

    goal.currentAmount += amount;
    if (goal.currentAmount >= goal.targetAmount) {
      goal.isCompleted = true;
    }
    this.saveGoals(goals);

    if (accountId) {
      this.addTransaction({
        type: 'expense',
        amount,
        currency: goal.currency,
        category: 'Savings & Investments',
        description: `Deposit to Goal: ${goal.name}`,
        date: new Date().toISOString().split('T')[0],
        accountId,
        paymentMode: 'Net Banking',
        tags: ['Savings', 'Goal Deposit'],
      });
    }
  }

  // --- Recurring ---
  static getRecurringBills(): RecurringBill[] {
    try {
      const raw = localStorage.getItem(KEY_RECURRING);
      if (raw) return JSON.parse(raw);
    } catch {
      // fallback
    }
    return [];
  }

  static saveRecurringBills(bills: RecurringBill[]): void {
    localStorage.setItem(KEY_RECURRING, JSON.stringify(bills));
  }

  // --- Complete Backup & Restore ---
  static exportFullBackup(): string {
    const data = {
      app: 'AI Money Manager',
      version: '6.1.0',
      exportedAt: new Date().toISOString(),
      userProfile: this.getUserProfile(),
      accounts: this.getAccounts(),
      transactions: this.getTransactions(),
      categories: this.getCategories(),
      budgets: this.getBudgets(),
      goals: this.getGoals(),
      recurring: this.getRecurringBills(),
    };
    return JSON.stringify(data, null, 2);
  }

  static importFullBackup(jsonString: string): boolean {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed.userProfile) this.saveUserProfile(parsed.userProfile);
      if (parsed.accounts) this.saveAccounts(parsed.accounts);
      if (parsed.transactions) this.saveTransactions(parsed.transactions);
      if (parsed.categories) this.saveCategories(parsed.categories);
      if (parsed.budgets) this.saveBudgets(parsed.budgets);
      if (parsed.goals) this.saveGoals(parsed.goals);
      if (parsed.recurring) this.saveRecurringBills(parsed.recurring);
      return true;
    } catch (err) {
      console.error('Failed to restore backup:', err);
      return false;
    }
  }

  static resetToDemoData(): void {
    localStorage.removeItem(KEY_USER);
    localStorage.removeItem(KEY_ACCOUNTS);
    localStorage.removeItem(KEY_TRANSACTIONS);
    localStorage.removeItem(KEY_BUDGETS);
    localStorage.removeItem(KEY_GOALS);
    localStorage.removeItem(KEY_RECURRING);
    localStorage.removeItem(KEY_CATEGORIES);
    localStorage.removeItem(KEY_MODE_SELECTED);
  }
}
