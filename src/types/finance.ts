/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type CurrencyCode =
  | 'INR'
  | 'USD'
  | 'EUR'
  | 'GBP'
  | 'AED'
  | 'SAR'
  | 'CAD'
  | 'AUD'
  | 'SGD'
  | 'JPY';

export interface CurrencyInfo {
  code: CurrencyCode;
  name: string;
  symbol: string;
  locale: string;
  fractionDigits: number;
  flag: string;
}

export const SUPPORTED_CURRENCIES: CurrencyInfo[] = [
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', locale: 'en-IN', fractionDigits: 2, flag: '🇮🇳' },
  { code: 'USD', name: 'US Dollar', symbol: '$', locale: 'en-US', fractionDigits: 2, flag: '🇺🇸' },
  { code: 'EUR', name: 'Euro', symbol: '€', locale: 'de-DE', fractionDigits: 2, flag: '🇪🇺' },
  { code: 'GBP', name: 'British Pound', symbol: '£', locale: 'en-GB', fractionDigits: 2, flag: '🇬🇧' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', locale: 'ar-AE', fractionDigits: 2, flag: '🇦🇪' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼', locale: 'ar-SA', fractionDigits: 2, flag: '🇸🇦' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', locale: 'en-CA', fractionDigits: 2, flag: '🇨🇦' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', locale: 'en-AU', fractionDigits: 2, flag: '🇦🇺' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', locale: 'en-SG', fractionDigits: 2, flag: '🇸🇬' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', locale: 'ja-JP', fractionDigits: 0, flag: '🇯🇵' },
];

export type AccountType =
  | 'bank'
  | 'cash'
  | 'personal'
  | 'business'
  | 'savings'
  | 'credit'
  | 'upi'
  | 'wallet'
  | 'custom';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number; // Stored in true Account Currency
  currency: CurrencyCode;
  color: string;
  icon?: string;
  accountNumber?: string;
  notes?: string;
  openingPosition: number;
  adjustments: number;
  netTransfers: number;
  createdAt: string;
  updatedAt: string;
  archived?: boolean;
}

export type TransactionType = 'income' | 'expense' | 'transfer';
export type PaymentMode = 'Cash' | 'UPI' | 'Credit Card' | 'Debit Card' | 'Net Banking' | 'Wallet' | 'Other';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number; // Original transaction amount (NEVER modified)
  currency: CurrencyCode; // Original currency (NEVER modified)
  category: string;
  subCategory?: string;
  description: string;
  notes?: string;
  date: string; // ISO string YYYY-MM-DD
  accountId: string;
  toAccountId?: string; // For transfers
  paymentMode: PaymentMode;
  tags: string[];
  receiptUrl?: string;
  exchangeRateAtTransaction?: number; // Rate against USD at recording time
  rateDate?: string;
  rateSource?: string;
  time?: string; // e.g. 14:30
  isDeleted?: boolean;
  userId?: string;
  updatedAt?: string;
  createdAt: string;
}

export interface Budget {
  id: string;
  category: string;
  monthlyLimit: number; // Stored in budget's native currency
  currency: CurrencyCode;
  alertThreshold: number; // e.g. 80 for 80%
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: CurrencyCode;
  targetDate: string; // YYYY-MM-DD
  color: string;
  category?: string;
  isCompleted?: boolean;
}

export interface RecurringBill {
  id: string;
  title: string;
  amount: number;
  currency: CurrencyCode;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  nextDueDate: string;
  category: string;
  accountId: string;
  autoPay?: boolean;
}

export interface ExchangeRates {
  base: 'USD';
  rates: Record<CurrencyCode, number>;
  lastUpdated: string;
  source: string;
}

export interface UserSubscription {
  isPro: boolean;
  planId?: 'monthly' | 'annual' | 'lifetime';
  planName?: string;
  billingRegion: 'IN' | 'GLOBAL';
  billingCurrency: 'INR' | 'USD';
  amountPaid: number;
  gateway: 'PayU' | 'International Card' | 'Google Play Billing';
  transactionId?: string;
  purchaseDate?: string;
  expiryDate?: string; // null or undefined for lifetime
  status: 'active' | 'cancelled' | 'expired';
}

export interface UserProfile {
  id: string;
  name: string; // Display name shown in Top Header!
  email: string;
  mobileNumber?: string;
  photoUrl?: string;
  firebaseUid?: string;
  preferredCurrency: CurrencyCode; // Current profile display currency
  storageMode: 'local' | 'cloud';
  hasSelectedStorageMode?: boolean; // Controls whether the first launch popup appears
  isPinLocked: boolean;
  pinHash?: string; // 4-digit PIN hash
  biometricsEnabled: boolean;
  autoLockMinutes: number;
  autoBackupSchedule?: 'manual' | 'daily' | 'weekly';
  darkModeEnabled?: boolean;
  themeMode?: 'light' | 'dark' | 'system';
  dailyAiQuestionsRemaining?: number;
  dailyAiQuestionsUsed?: number;
  dailyAiLastDate?: string;
  categoriesSeeded?: boolean;
  subscription: UserSubscription;
}

export interface SubscriptionPlanDefinition {
  id: 'monthly' | 'annual' | 'lifetime';
  name: string;
  duration: string;
  badge?: string;
  features: string[];
  pricing: {
    IN: {
      currency: 'INR';
      symbol: '₹';
      price: number;
      displayPrice: string;
      gateway: 'PayU';
      gatewayProductId: string;
    };
    GLOBAL: {
      currency: 'USD';
      symbol: '$';
      price: number;
      displayPrice: string;
      gateway: 'International Card';
      gatewayProductId: string;
    };
  };
}

export interface FinancialHealthInsight {
  score: number; // 0 - 100
  rating: 'Excellent' | 'Good' | 'Needs Attention' | 'Critical';
  summary: string;
  monthlySavingsRate: number; // Percentage
  anomalies: string[];
  tips: {
    title: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
    category: string;
  }[];
}
