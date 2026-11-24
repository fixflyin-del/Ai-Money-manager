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
  sortOrder?: number;
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
      gateway: string;
      gatewayProductId: string;
    };
    GLOBAL: {
      currency: 'USD';
      symbol: '
  isPro: boolean;
  planId?: 'monthly' | 'annual' | 'lifetime';
  planName?: string;
  billingRegion: 'IN' | 'GLOBAL';
  billingCurrency: 'INR' | 'USD';
  amountPaid: number;
  gateway: 'Free' | 'None';
  transactionId?: string;
  purchaseDate?: string;
  expiryDate?: string;
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
  timezone?: string;
  categoriesSeeded?: boolean;
  subscription: UserSubscription;
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

export interface AiQuotaStatus {
  isPro: boolean;
  questionsRemaining: number;
  questionsUsed: number;
  limit: number | null;
  date: string;
  timezone: string;
  resetAt: string;
  dailyLimitReached: boolean;
}

export interface AiChatResponse extends AiQuotaStatus {
  reply: string;
  modelUsed?: string;
  ledgerHighlights?: {
    totalBalance: number;
    thisMonthIncome: number;
    thisMonthExpense: number;
    savingsRate: number;
    preferredCurrency: string;
  };
}

export interface DailyInsightItem {
  category: string;
  amountSpent: number;
  percentageOfExpenses: number | null;
  reason: string;
  recommendedAction: string;
  estimatedPotentialSavings: number | null;
  priority: 'High' | 'Medium' | 'Low';
}

export interface DailyAiInsightsResponse {
  success: boolean;
  cached: boolean;
  rateProtected?: boolean;
  ledgerHash: string;
  generatedAt: string;
  modelUsed: string;
  preferredCurrency: string;
  summary: string;
  insights: DailyInsightItem[];
}

export interface DeepSmartAnalysisMetrics {
  preferredCurrency: string;
  timezone: string;
  scopeAccountId: string;
  scopeLabel: string;
  currentMonth: string;
  lastMonth: string;
  totalBalance: number;
  activeAccountsCount: number;
  totalTransactionsCount: number;
  thisMonth: {
    income: number;
    expense: number;
    netSavings: number;
    savingsRate: number;
    transferIn: number;
    transferOut: number;
    transferInternal: number;
    transactionCount: number;
    dailyBurnRate: number;
    projectedMonthExpense: number;
    runwayDays: number;
  };
  lastMonthSummary: {
    income: number;
    expense: number;
    netSavings: number;
    savingsRate: number;
  };
  healthScore: number;
  healthRating: 'Excellent' | 'Good' | 'Needs Attention' | 'Critical';
  topCategories: {
    category: string;
    amount: number;
    count: number;
    percentageOfExpenses: number;
    lastMonthAmount: number;
    momChangePercent: number | null;
  }[];
  accountPositions: {
    id: string;
    name: string;
    type: string;
    currency: string;
    nativeBalance: number;
    convertedBalance: number;
    thisMonthIncome: number;
    thisMonthExpense: number;
    sharePercent: number;
  }[];
  last6MonthsTrend: { key: string; label: string; income: number; expense: number; netSavings: number }[];
  unusualExpenses: {
    transactionId: string;
    date: string;
    category: string;
    description: string;
    amountConverted: number;
    reason: string;
  }[];
  recurringExpenses: {
    label: string;
    category: string;
    occurrences: number;
    averageAmountConverted: number;
    totalAmountConverted: number;
    lastDate: string;
  }[];
  budgetUtilization: {
    id: string;
    category: string;
    limitConverted: number;
    spentConverted: number;
    remainingConverted: number;
    percentUsed: number;
    projectedMonthSpend: number;
    status: 'ok' | 'warning' | 'overbudget';
  }[];
  riskWarnings: {
    code: string;
    title: string;
    severity: 'high' | 'medium' | 'low';
    detail: string;
  }[];
  availableSavingsCapacity: number;
}

export interface DeepSmartAnalysisResponse {
  success: boolean;
  modelUsed: string;
  generatedAt: string;
  metrics: DeepSmartAnalysisMetrics;
  aiAnalysis: {
    executiveSummary: string;
    healthScoreExplanation: string;
    spendingTrendSummary: string;
    unusualExpenseAnalysis: string;
    recurringExpenseAnalysis: string;
    riskExplanations: {
      title: string;
      severity: 'high' | 'medium' | 'low';
      explanation: string;
      impact: string;
    }[];
    savingOpportunities: {
      title: string;
      category: string;
      action: string;
      potentialMonthlySavings: number;
      basis: string;
    }[];
    recommendedNextActions: {
      priority: 'High' | 'Medium' | 'Low';
      title: string;
      detail: string;
      targetMetric: string;
    }[];
  };
}

export interface BudgetCategoryRecommendation {
  category: string;
  currentMonthlySpend: number;
  existingLimit: number | null;
  recommendedLimit: number;
  suggestedMonthlySavings: number;
  reasoning: string;
  priority: 'High' | 'Medium' | 'Low';
}

export interface BudgetPlanResponse {
  success: boolean;
  modelUsed: string;
  generatedAt: string;
  preferredCurrency: string;
  plan: {
    monthlyIncome: number;
    monthlyExpense: number;
    availableSavingsCapacity: number;
    recommendedMonthlySavings: number;
    overallStrategy: string;
    categoryRecommendations: BudgetCategoryRecommendation[];
  };
}

;
      price: number;
      displayPrice: string;
      gateway: string;
      gatewayProductId: string;
    };
  };
}

export interface UserSubscription {
  isPro: boolean;
  planId?: 'monthly' | 'annual' | 'lifetime';
  planName?: string;
  billingRegion: 'IN' | 'GLOBAL';
  billingCurrency: 'INR' | 'USD';
  amountPaid: number;
  gateway: 'Free' | 'None';
  transactionId?: string;
  purchaseDate?: string;
  expiryDate?: string;
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
  timezone?: string;
  categoriesSeeded?: boolean;
  subscription: UserSubscription;
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

export interface AiQuotaStatus {
  isPro: boolean;
  questionsRemaining: number;
  questionsUsed: number;
  limit: number | null;
  date: string;
  timezone: string;
  resetAt: string;
  dailyLimitReached: boolean;
}

export interface AiChatResponse extends AiQuotaStatus {
  reply: string;
  modelUsed?: string;
  ledgerHighlights?: {
    totalBalance: number;
    thisMonthIncome: number;
    thisMonthExpense: number;
    savingsRate: number;
    preferredCurrency: string;
  };
}

export interface DailyInsightItem {
  category: string;
  amountSpent: number;
  percentageOfExpenses: number | null;
  reason: string;
  recommendedAction: string;
  estimatedPotentialSavings: number | null;
  priority: 'High' | 'Medium' | 'Low';
}

export interface DailyAiInsightsResponse {
  success: boolean;
  cached: boolean;
  rateProtected?: boolean;
  ledgerHash: string;
  generatedAt: string;
  modelUsed: string;
  preferredCurrency: string;
  summary: string;
  insights: DailyInsightItem[];
}

export interface DeepSmartAnalysisMetrics {
  preferredCurrency: string;
  timezone: string;
  scopeAccountId: string;
  scopeLabel: string;
  currentMonth: string;
  lastMonth: string;
  totalBalance: number;
  activeAccountsCount: number;
  totalTransactionsCount: number;
  thisMonth: {
    income: number;
    expense: number;
    netSavings: number;
    savingsRate: number;
    transferIn: number;
    transferOut: number;
    transferInternal: number;
    transactionCount: number;
    dailyBurnRate: number;
    projectedMonthExpense: number;
    runwayDays: number;
  };
  lastMonthSummary: {
    income: number;
    expense: number;
    netSavings: number;
    savingsRate: number;
  };
  healthScore: number;
  healthRating: 'Excellent' | 'Good' | 'Needs Attention' | 'Critical';
  topCategories: {
    category: string;
    amount: number;
    count: number;
    percentageOfExpenses: number;
    lastMonthAmount: number;
    momChangePercent: number | null;
  }[];
  accountPositions: {
    id: string;
    name: string;
    type: string;
    currency: string;
    nativeBalance: number;
    convertedBalance: number;
    thisMonthIncome: number;
    thisMonthExpense: number;
    sharePercent: number;
  }[];
  last6MonthsTrend: { key: string; label: string; income: number; expense: number; netSavings: number }[];
  unusualExpenses: {
    transactionId: string;
    date: string;
    category: string;
    description: string;
    amountConverted: number;
    reason: string;
  }[];
  recurringExpenses: {
    label: string;
    category: string;
    occurrences: number;
    averageAmountConverted: number;
    totalAmountConverted: number;
    lastDate: string;
  }[];
  budgetUtilization: {
    id: string;
    category: string;
    limitConverted: number;
    spentConverted: number;
    remainingConverted: number;
    percentUsed: number;
    projectedMonthSpend: number;
    status: 'ok' | 'warning' | 'overbudget';
  }[];
  riskWarnings: {
    code: string;
    title: string;
    severity: 'high' | 'medium' | 'low';
    detail: string;
  }[];
  availableSavingsCapacity: number;
}

export interface DeepSmartAnalysisResponse {
  success: boolean;
  modelUsed: string;
  generatedAt: string;
  metrics: DeepSmartAnalysisMetrics;
  aiAnalysis: {
    executiveSummary: string;
    healthScoreExplanation: string;
    spendingTrendSummary: string;
    unusualExpenseAnalysis: string;
    recurringExpenseAnalysis: string;
    riskExplanations: {
      title: string;
      severity: 'high' | 'medium' | 'low';
      explanation: string;
      impact: string;
    }[];
    savingOpportunities: {
      title: string;
      category: string;
      action: string;
      potentialMonthlySavings: number;
      basis: string;
    }[];
    recommendedNextActions: {
      priority: 'High' | 'Medium' | 'Low';
      title: string;
      detail: string;
      targetMetric: string;
    }[];
  };
}

export interface BudgetCategoryRecommendation {
  category: string;
  currentMonthlySpend: number;
  existingLimit: number | null;
  recommendedLimit: number;
  suggestedMonthlySavings: number;
  reasoning: string;
  priority: 'High' | 'Medium' | 'Low';
}

export interface BudgetPlanResponse {
  success: boolean;
  modelUsed: string;
  generatedAt: string;
  preferredCurrency: string;
  plan: {
    monthlyIncome: number;
    monthlyExpense: number;
    availableSavingsCapacity: number;
    recommendedMonthlySavings: number;
    overallStrategy: string;
    categoryRecommendations: BudgetCategoryRecommendation[];
  };
}

