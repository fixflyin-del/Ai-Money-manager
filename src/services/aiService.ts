/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { auth } from './firebase';
import { AndroidBridge } from './androidBridge';
import {
  AiChatResponse,
  AiQuotaStatus,
  BudgetPlanResponse,
  CurrencyCode,
  DailyAiInsightsResponse,
  DeepSmartAnalysisResponse,
  FinancialHealthInsight,
  PaymentMode,
} from '../types/finance';

export interface ParsedReceiptData {
  merchant: string;
  amount: number;
  currency: CurrencyCode;
  date: string;
  category: string;
  paymentMode: PaymentMode;
  taxAmount?: number;
  items?: { name: string; price: number }[];
  confidence: number;
}

export interface ParsedVoiceExpense {
  amount: number;
  currency: CurrencyCode;
  category: string;
  merchantOrDescription: string;
  paymentMode: PaymentMode;
  type: 'expense' | 'income';
  notes?: string;
  rawText: string;
}

export class AiApiError extends Error {
  status: number;
  code: string;
  limitReached: boolean;
  quotaConsumed: boolean;
  quotaStatus?: Partial<AiQuotaStatus>;

  constructor(
    message: string,
    options: {
      status?: number;
      code?: string;
      limitReached?: boolean;
      quotaConsumed?: boolean;
      quotaStatus?: Partial<AiQuotaStatus>;
    } = {}
  ) {
    super(message);
    this.status = options.status || 500;
    this.code = options.code || 'AI_API_ERROR';
    this.limitReached = Boolean(options.limitReached);
    this.quotaConsumed = Boolean(options.quotaConsumed);
    this.quotaStatus = options.quotaStatus;
  }
}

export function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  } catch {
    return 'Asia/Kolkata';
  }
}

async function getAuthenticatedHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) {
    throw new AiApiError('Please sign in with Google or Email to access Cloud Gemini AI features.', {
      status: 401,
      code: 'AUTH_REQUIRED',
      quotaConsumed: false,
    });
  }

  const idToken = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${idToken}`,
  };
}

async function parseErrorResponse(res: Response, fallbackMessage: string): Promise<AiApiError> {
  const body = await res.json().catch(() => ({}));
  return new AiApiError(body.message || body.error || fallbackMessage, {
    status: res.status,
    code: body.error || 'AI_API_ERROR',
    limitReached: Boolean(res.status === 429 || body.limitReached || body.quotaExceeded),
    quotaConsumed: Boolean(body.quotaConsumed),
    quotaStatus:
      typeof body.questionsRemaining === 'number'
        ? {
            isPro: Boolean(body.isPro),
            questionsRemaining: body.questionsRemaining,
            limit: body.limit ?? 1,
            date: body.date,
            timezone: body.timezone,
            resetAt: body.resetAt,
            dailyLimitReached: Boolean(body.dailyLimitReached ?? body.limitReached),
          }
        : undefined,
  });
}

export class AiService {
  /**
   * Fetch persistent daily AI Chat quota status from Firestore via authenticated backend
   */
  static async getQuotaStatus(timezone?: string): Promise<AiQuotaStatus> {
    const headers = await getAuthenticatedHeaders();
    const tz = timezone || getBrowserTimezone();
    const url = AndroidBridge.getApiUrl(`/api/ai/quota-status?timezone=${encodeURIComponent(tz)}`);
    const res = await fetch(url, { method: 'GET', headers });

    if (!res.ok) {
      throw await parseErrorResponse(res, 'Failed to check daily AI quota status.');
    }

    return await res.json();
  }

  /**
   * Send grounded AI Chat query (1/day free, unlimited active Pro; failed calls never consume quota)
   */
  static async sendChatQuery(message: string, timezone?: string): Promise<AiChatResponse> {
    const headers = await getAuthenticatedHeaders();
    const tz = timezone || getBrowserTimezone();
    const url = AndroidBridge.getApiUrl('/api/ai/chat');
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: message.trim(),
        timezone: tz,
      }),
    });

    if (!res.ok) {
      throw await parseErrorResponse(res, 'Failed to generate Gemini AI response.');
    }

    return await res.json();
  }

  /**
   * Request Complete Deep AI Smart Analysis (Independent of Chat Quota)
   */
  static async getDeepSmartAnalysis(
    accountId: string = 'all',
    timezone?: string
  ): Promise<DeepSmartAnalysisResponse> {
    const headers = await getAuthenticatedHeaders();
    const tz = timezone || getBrowserTimezone();
    const url = AndroidBridge.getApiUrl('/api/ai/smart-analysis');
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        accountId,
        timezone: tz,
      }),
    });

    if (!res.ok) {
      throw await parseErrorResponse(res, 'Failed to load Deep AI Smart Analysis.');
    }

    return await res.json();
  }

  /**
   * Request Real Daily AI Insights with smart Firestore caching (Independent of Chat Quota)
   */
  static async getDailyInsights(options?: {
    accountId?: string;
    forceRefresh?: boolean;
    timezone?: string;
  }): Promise<DailyAiInsightsResponse> {
    const headers = await getAuthenticatedHeaders();
    const tz = options?.timezone || getBrowserTimezone();
    const url = AndroidBridge.getApiUrl('/api/ai/insights');
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        accountId: options?.accountId || 'all',
        forceRefresh: Boolean(options?.forceRefresh),
        timezone: tz,
      }),
    });

    if (!res.ok) {
      throw await parseErrorResponse(res, 'Failed to load Daily AI Insights.');
    }

    return await res.json();
  }

  /**
   * Request Budget Planning AI recommendations (Independent of Chat Quota, never auto-mutates)
   */
  static async getBudgetPlan(timezone?: string): Promise<BudgetPlanResponse> {
    const headers = await getAuthenticatedHeaders();
    const tz = timezone || getBrowserTimezone();
    const url = AndroidBridge.getApiUrl('/api/ai/budget-plan');
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ timezone: tz }),
    });

    if (!res.ok) {
      throw await parseErrorResponse(res, 'Failed to generate AI Budget Plan.');
    }

    return await res.json();
  }

  /**
   * Scan receipt image via authenticated server-side Gemini AI
   */
  static async scanReceipt(
    fileBase64: string,
    mimeType: string,
    preferredCurrency: CurrencyCode
  ): Promise<ParsedReceiptData> {
    const headers = await getAuthenticatedHeaders();
    const url = AndroidBridge.getApiUrl('/api/ai/scan-receipt');
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        image: fileBase64,
        mimeType,
        preferredCurrency,
      }),
    });

    if (!res.ok) {
      throw await parseErrorResponse(res, 'Failed to scan receipt with Gemini AI');
    }

    return await res.json();
  }

  /**
   * Parse natural speech / spoken text into structured transaction via authenticated backend
   */
  static async parseVoiceExpense(
    spokenText: string,
    preferredCurrency: CurrencyCode
  ): Promise<ParsedVoiceExpense> {
    const headers = await getAuthenticatedHeaders();
    const url = AndroidBridge.getApiUrl('/api/ai/voice-expense');
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        text: spokenText,
        preferredCurrency,
      }),
    });

    if (!res.ok) {
      throw await parseErrorResponse(res, 'Failed to parse voice expense with Gemini AI');
    }

    return await res.json();
  }

  /**
   * Request AI Financial Advisor Insights (grounded in real Firestore ledger)
   */
  static async getFinancialAdvice(_summaryData?: {
    totalBalance?: number;
    monthlyIncome?: number;
    monthlyExpense?: number;
    currency?: CurrencyCode;
    topCategories?: { category: string; amount: number }[];
  }): Promise<FinancialHealthInsight> {
    const headers = await getAuthenticatedHeaders();
    const url = AndroidBridge.getApiUrl('/api/ai/advice');
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ timezone: getBrowserTimezone() }),
    });

    if (!res.ok) {
      throw await parseErrorResponse(res, 'Failed to generate AI financial advice.');
    }

    return await res.json();
  }
}
