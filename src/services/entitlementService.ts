/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserProfile } from '../types/finance';

export type FeatureKey =
  | 'basic_dashboard'
  | 'basic_transactions'
  | 'account_management'
  | 'category_management'
  | 'basic_monthly_analysis'
  | 'per_account_basic_analysis'
  | 'basic_category_analysis'
  | 'advanced_charts'
  | 'weekly_yearly_custom_analytics'
  | 'deep_financial_analysis'
  | 'advanced_ai_reports'
  | 'ai_chat_unlimited'
  | 'receipt_ocr'
  | 'smart_ai_entry'
  | 'cashflow_forecasting'
  | 'advanced_ai_recommendations'
  | 'export_financial_statements';

export interface EntitlementRule {
  key: FeatureKey;
  name: string;
  freeAllowed: boolean;
  premiumOnly: boolean;
  freeLimit?: string;
  description: string;
}

export const ENTITLEMENT_RULES: Record<FeatureKey, EntitlementRule> = {
  basic_dashboard: {
    key: 'basic_dashboard',
    name: 'Dashboard Overview',
    freeAllowed: true,
    premiumOnly: false,
    description: 'View consolidated total balance, income, expense, and quick actions.',
  },
  basic_transactions: {
    key: 'basic_transactions',
    name: 'Transaction Ledger',
    freeAllowed: true,
    premiumOnly: false,
    description: 'Add, view, filter, and track income, expense, and transfer transactions.',
  },
  account_management: {
    key: 'account_management',
    name: 'Account Management',
    freeAllowed: true,
    premiumOnly: false,
    description: 'Create and manage unlimited bank, cash, wallet, and credit accounts.',
  },
  category_management: {
    key: 'category_management',
    name: 'Category Customization',
    freeAllowed: true,
    premiumOnly: false,
    description: 'Customize categories with custom Lucide icons and colors.',
  },
  basic_monthly_analysis: {
    key: 'basic_monthly_analysis',
    name: 'Monthly Analysis',
    freeAllowed: true,
    premiumOnly: false,
    description: 'View current month total balance, income, expense, and top categories.',
  },
  per_account_basic_analysis: {
    key: 'per_account_basic_analysis',
    name: 'Per-Account Analysis',
    freeAllowed: true,
    premiumOnly: false,
    description: 'Filter analytics by any individual account to monitor its specific performance.',
  },
  basic_category_analysis: {
    key: 'basic_category_analysis',
    name: 'Category Spending Overview',
    freeAllowed: true,
    premiumOnly: false,
    description: 'Top category breakdown and percentage distribution.',
  },
  advanced_charts: {
    key: 'advanced_charts',
    name: '6 Interactive Charts',
    freeAllowed: false,
    premiumOnly: true,
    description: 'Interactive spending trends, income vs expense velocity, and category pie charts.',
  },
  weekly_yearly_custom_analytics: {
    key: 'weekly_yearly_custom_analytics',
    name: 'Weekly, Yearly & Custom Filters',
    freeAllowed: false,
    premiumOnly: true,
    description: 'Analyze financial health over weekly, annual, or custom date ranges.',
  },
  deep_financial_analysis: {
    key: 'deep_financial_analysis',
    name: 'Deep Financial Analysis',
    freeAllowed: false,
    premiumOnly: true,
    description: 'Multi-account comparisons, net-worth growth velocity, and burn-rate tracking.',
  },
  advanced_ai_reports: {
    key: 'advanced_ai_reports',
    name: 'Executive AI Reports',
    freeAllowed: false,
    premiumOnly: true,
    description: 'Comprehensive AI-generated monthly executive audits and PDF briefings.',
  },
  ai_chat_unlimited: {
    key: 'ai_chat_unlimited',
    name: 'Unlimited AI Chat',
    freeAllowed: false,
    premiumOnly: true,
    freeLimit: '1 question / day',
    description: 'Ask unlimited financial queries in Hindi, Hinglish, or English.',
  },
  receipt_ocr: {
    key: 'receipt_ocr',
    name: 'Gemini AI Receipt OCR',
    freeAllowed: false,
    premiumOnly: true,
    description: 'Scan camera or gallery receipts with automated itemization.',
  },
  smart_ai_entry: {
    key: 'smart_ai_entry',
    name: 'Smart AI Draft Entry',
    freeAllowed: false,
    premiumOnly: true,
    description: 'Natural language and voice-powered ledger logging.',
  },
  cashflow_forecasting: {
    key: 'cashflow_forecasting',
    name: 'Cashflow Forecasting',
    freeAllowed: false,
    premiumOnly: true,
    description: 'Predict next 30-90 days cash balances based on recurring habits.',
  },
  advanced_ai_recommendations: {
    key: 'advanced_ai_recommendations',
    name: 'AI Recommendations & Anomalies',
    freeAllowed: false,
    premiumOnly: true,
    description: 'Proactive anomaly alerts, subscription audits, and optimization tips.',
  },
  export_financial_statements: {
    key: 'export_financial_statements',
    name: 'Export Statements (PDF / CSV / Excel)',
    freeAllowed: true,
    premiumOnly: false,
    description: 'Download complete authenticated ledger to device.',
  },
};

export class EntitlementService {
  static isPro(profile: UserProfile): boolean {
    return Boolean(profile.subscription && profile.subscription.isPro);
  }

  static canAccess(profile: UserProfile, feature: FeatureKey): boolean {
    const rule = ENTITLEMENT_RULES[feature];
    if (!rule) return true;
    if (this.isPro(profile)) return true;
    return rule.freeAllowed;
  }

  static getRemainingAiQuestions(profile: UserProfile): number {
    if (this.isPro(profile)) return 999999;
    const today = new Date().toISOString().slice(0, 10);
    const lastDate = profile.dailyAiLastDate || '';
    if (lastDate !== today) {
      return 1; // 1 free question per day!
    }
    return Math.max(0, 1 - (profile.dailyAiQuestionsUsed || 0));
  }
}
