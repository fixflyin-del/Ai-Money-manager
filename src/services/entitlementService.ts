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
    freeAllowed: true,
    premiumOnly: false,
    description: 'Interactive spending trends, income vs expense velocity, and category pie charts.',
  },
  weekly_yearly_custom_analytics: {
    key: 'weekly_yearly_custom_analytics',
    name: 'Weekly, Yearly & Custom Filters',
    freeAllowed: true,
    premiumOnly: false,
    description: 'Analyze financial health over weekly, annual, or custom date ranges.',
  },
  deep_financial_analysis: {
    key: 'deep_financial_analysis',
    name: 'Deep Financial Analysis',
    freeAllowed: true,
    premiumOnly: false,
    description: 'Multi-account comparisons, net-worth growth velocity, and burn-rate tracking.',
  },
  advanced_ai_reports: {
    key: 'advanced_ai_reports',
    name: 'Executive AI Reports',
    freeAllowed: true,
    premiumOnly: false,
    description: 'Comprehensive AI-generated monthly executive audits and PDF briefings.',
  },
  ai_chat_unlimited: {
    key: 'ai_chat_unlimited',
    name: 'Daily AI Chat',
    freeAllowed: true,
    premiumOnly: false,
    freeLimit: '1 question / day',
    description: 'Ask financial queries in Hindi, Hinglish, or English (1 query/day).',
  },
  receipt_ocr: {
    key: 'receipt_ocr',
    name: 'Gemini AI Receipt OCR',
    freeAllowed: true,
    premiumOnly: false,
    description: 'Scan camera or gallery receipts with automated itemization.',
  },
  smart_ai_entry: {
    key: 'smart_ai_entry',
    name: 'Smart AI Draft Entry',
    freeAllowed: true,
    premiumOnly: false,
    description: 'Natural language and voice-powered ledger logging.',
  },
  cashflow_forecasting: {
    key: 'cashflow_forecasting',
    name: 'Cashflow Forecasting',
    freeAllowed: true,
    premiumOnly: false,
    description: 'Predict next 30-90 days cash balances based on recurring habits.',
  },
  advanced_ai_recommendations: {
    key: 'advanced_ai_recommendations',
    name: 'AI Recommendations & Anomalies',
    freeAllowed: true,
    premiumOnly: false,
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

// 100% Free Edition: All core, analytics, and export features are free for every user.
export const IS_FREE_EDITION = true;

export class EntitlementService {
  static isPro(_profile?: UserProfile | null): boolean {
    return true;
  }

  /**
   * 100% Free Edition: Paid Pro plans are disabled, so every signed-in user shares
   * the consistent 1 successful AI Chat query per day quota across Web and Android.
   */
  static hasPaidProChatEntitlement(_profile?: UserProfile | null): boolean {
    return false;
  }

  static canAccess(_profile: UserProfile, _feature: FeatureKey): boolean {
    return true;
  }

  static getRemainingAiQuestions(profile: UserProfile): number {
    if (this.hasPaidProChatEntitlement(profile)) return 999999;
    const today = new Date().toISOString().slice(0, 10);
    const lastDate = profile.dailyAiLastDate || '';
    if (lastDate !== today) {
      return 1; // 1 free question per day!
    }
    return Math.max(0, 1 - (profile.dailyAiQuestionsUsed || 0));
  }
}
