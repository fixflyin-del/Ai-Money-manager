/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from '@google/genai';
import type { DeterministicLedgerAnalytics } from './ledgerAnalytics.js';
import { round2 } from './ledgerAnalytics.js';

export const PRIMARY_GEMINI_MODEL = (process.env.GEMINI_MODEL || 'gemini-3.8-flash').trim();
export const FALLBACK_GEMINI_MODEL = 'gemini-4-hydrogen';

let resolvedWorkingModel: string | null = null;

export class GeminiServiceError extends Error {
  status: number;
  code: string;
  retryable: boolean;

  constructor(message: string, status = 502, code = 'GEMINI_UPSTREAM_ERROR', retryable = true) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

function getCleanGeminiApiKey(): string {
  const raw = process.env.GEMINI_API_KEY || '';
  return raw.trim().replace(/^['"]|['"]$/g, '').trim();
}

export function isGeminiConfigured(): boolean {
  const key = getCleanGeminiApiKey();
  const lower = key.toLowerCase();
  return Boolean(
    key.length > 10 &&
      !lower.includes('placeholder') &&
      !lower.includes('your_gemini') &&
      !lower.includes('yourgeminiapikey')
  );
}

export function getResolvedModelName(): string {
  return resolvedWorkingModel || PRIMARY_GEMINI_MODEL;
}

function getClient(): GoogleGenAI {
  if (!isGeminiConfigured()) {
    throw new GeminiServiceError(
      'Gemini AI is not configured on the server (GEMINI_API_KEY missing). Your daily chat quota was not consumed.',
      503,
      'GEMINI_NOT_CONFIGURED',
      false
    );
  }
  return new GoogleGenAI({
    apiKey: getCleanGeminiApiKey(),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function isModelNotFoundError(err: any): boolean {
  const msg = String(err?.message || '').toLowerCase();
  const status = Number(err?.status || err?.code || 0);
  return (
    status === 404 ||
    msg.includes('not_found') ||
    msg.includes('404') ||
    (msg.includes('model') && (msg.includes('not found') || msg.includes('unsupported') || msg.includes('does not exist')))
  );
}

function isTransientError(err: any): boolean {
  const msg = String(err?.message || '').toLowerCase();
  const status = Number(err?.status || err?.code || 0);
  if ([429, 500, 502, 503, 504].includes(status)) return true;
  if (
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('rate limit') ||
    msg.includes('overloaded') ||
    msg.includes('unavailable') ||
    msg.includes('fetch failed')
  ) {
    return true;
  }
  return false;
}

function isApiKeyInvalidError(err: any): boolean {
  const msg = String(err?.message || '').toLowerCase();
  return (
    msg.includes('api_key_invalid') ||
    msg.includes('api key not valid') ||
    (msg.includes('permission_denied') && msg.includes('api key'))
  );
}

function sanitizeErrorMessage(err: any): string {
  const raw = String(err?.message || 'Gemini request failed');
  // Redact anything resembling a Google API key if ever echoed upstream
  return raw.replace(/AIza[0-9A-Za-z_-]{20,}/g, '[REDACTED_KEY]');
}

async function callWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new GeminiServiceError('Gemini AI request timed out. Please try again.', 504, 'GEMINI_TIMEOUT', true));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function generateContentWithResilience(params: {
  contents: any;
  config?: Record<string, any>;
  timeoutMs?: number;
  maxRetries?: number;
}): Promise<{ text: string; modelUsed: string }> {
  const client = getClient();
  const timeoutMs = params.timeoutMs ?? 18_000;
  const maxRetries = params.maxRetries ?? 2;

  const candidateModels = resolvedWorkingModel
    ? [resolvedWorkingModel]
    : PRIMARY_GEMINI_MODEL === FALLBACK_GEMINI_MODEL
    ? [PRIMARY_GEMINI_MODEL]
    : [PRIMARY_GEMINI_MODEL, FALLBACK_GEMINI_MODEL];

  let lastError: any = null;

  for (const model of candidateModels) {
    // Strip deprecated sampling params for Gemini 4 models per @google/genai guidelines
    let effectiveConfig = params.config;
    if (effectiveConfig && model.startsWith('gemini-4-')) {
      const { temperature: _t, topP: _p, topK: _k, candidateCount: _c, ...rest } = effectiveConfig;
      effectiveConfig = rest;
    }

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await callWithTimeout(
          client.models.generateContent({
            model,
            contents: params.contents,
            config: effectiveConfig,
          }),
          timeoutMs
        );

        const text = typeof res?.text === 'string' ? res.text.trim() : '';
        if (!text) {
          throw new GeminiServiceError(
            'Gemini AI returned an empty response. Please retry.',
            502,
            'GEMINI_EMPTY_RESPONSE',
            true
          );
        }

        resolvedWorkingModel = model;
        return { text, modelUsed: model };
      } catch (err: any) {
        lastError = err;

        if (isApiKeyInvalidError(err)) {
          throw new GeminiServiceError(
            'Gemini AI service key on the server is invalid or unauthorized. Please configure a valid GEMINI_API_KEY in server secrets. Your daily chat quota was not consumed.',
            503,
            'GEMINI_API_KEY_INVALID',
            false
          );
        }

        if (isModelNotFoundError(err) && model !== candidateModels[candidateModels.length - 1]) {
          // Primary model returned 404/NOT_FOUND — move immediately to verified active fallback model
          break;
        }

        if (err instanceof GeminiServiceError && !err.retryable) {
          throw err;
        }

        const retryable = err instanceof GeminiServiceError ? err.retryable : isTransientError(err);
        if (!retryable || attempt >= maxRetries) {
          if (err instanceof GeminiServiceError) throw err;
          throw new GeminiServiceError(
            `Gemini AI service temporarily unavailable: ${sanitizeErrorMessage(err)}`,
            502,
            'GEMINI_UPSTREAM_ERROR',
            false
          );
        }

        // Exponential backoff with small jitter
        const delayMs = 600 * Math.pow(2, attempt) + Math.floor(Math.random() * 250);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  if (lastError instanceof GeminiServiceError) throw lastError;
  throw new GeminiServiceError(
    `Gemini AI failed after retries: ${sanitizeErrorMessage(lastError)}`,
    502,
    'GEMINI_UPSTREAM_ERROR',
    false
  );
}

function parseStrictJson<T>(rawText: string): T {
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new GeminiServiceError(
      'Gemini AI returned malformed structured JSON output.',
      502,
      'GEMINI_INVALID_JSON',
      true
    );
  }
}

function buildCompactLedgerSnapshot(analytics: DeterministicLedgerAnalytics) {
  return {
    preferredCurrency: analytics.preferredCurrency,
    timezone: analytics.timezone,
    currentMonth: analytics.currentMonth,
    scope: analytics.scopeLabel,
    totalBalance: analytics.totalBalance,
    activeAccountsCount: analytics.activeAccountsCount,
    totalTransactionsCount: analytics.totalTransactionsCount,
    thisMonth: analytics.thisMonth,
    lastMonth: analytics.lastMonthSummary,
    trailing3MonthsAvg: analytics.trailing3MonthsAvg,
    healthScore: analytics.healthScore,
    healthRating: analytics.healthRating,
    topCategoriesThisMonth: analytics.topCategories,
    allCategoriesThisMonth: analytics.allCategoriesThisMonth,
    accountPositions: analytics.accountPositions,
    last6MonthsTrend: analytics.last6MonthsTrend,
    unusualExpenses: analytics.unusualExpenses,
    recurringExpenses: analytics.recurringExpenses,
    budgetUtilization: analytics.budgetUtilization,
    riskWarnings: analytics.riskWarnings,
    discretionaryTotal: analytics.discretionaryTotal,
    availableSavingsCapacity: analytics.availableSavingsCapacity,
    recentTransactions: analytics.recentTransactionsSnippet.slice(0, 15),
  };
}

// ---------------------------------------------------------------------------
// 1. Grounded AI Chat Response
// ---------------------------------------------------------------------------
export async function generateGroundedChatReply(params: {
  message: string;
  analytics: DeterministicLedgerAnalytics;
}): Promise<{ reply: string; modelUsed: string }> {
  const { message, analytics } = params;
  const snapshot = buildCompactLedgerSnapshot(analytics);

  const systemInstruction = `You are the senior personal financial advisor inside "AI Money Manager".
CRITICAL GROUNDING RULES:
1. You MUST base every number, balance, income, expense, category, account name, budget status, and risk strictly on the AUTHORIZED LEDGER JSON below.
2. NEVER invent transactions, categories, weekend spending percentages, or unrecorded subscriptions that are not present in the JSON.
3. If the user has 0 transactions or 0 balance for a metric, state that clearly and offer practical setup guidance instead of guessing amounts.
4. Match the user's language naturally (Hindi, Hinglish, or English). Keep formatting clean, clear, scannable, and practical — include specific real figures (with currency ${analytics.preferredCurrency}), top categories/accounts, any unusual or over-budget alerts if present, and 1–3 concrete actionable saving suggestions.`;

  const prompt = `AUTHORIZED LEDGER JSON:
${JSON.stringify(snapshot, null, 2)}

USER QUESTION:
"""
${message.trim().slice(0, 1000)}
"""

Respond directly to the user's question using the real ledger data above.`;

  const { text, modelUsed } = await generateContentWithResilience({
    contents: prompt,
    config: {
      systemInstruction,
      temperature: 0.25,
    },
    timeoutMs: 18_000,
    maxRetries: 2,
  });

  if (text.length < 8) {
    throw new GeminiServiceError('Gemini AI returned an incomplete response.', 502, 'GEMINI_INVALID_OUTPUT', true);
  }

  return { reply: text, modelUsed };
}

// ---------------------------------------------------------------------------
// 2. Deep AI Smart Analysis (Independent of Chat Quota)
// ---------------------------------------------------------------------------
export interface DeepSmartAnalysisAiOutput {
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
}

export async function generateDeepSmartAnalysis(
  analytics: DeterministicLedgerAnalytics
): Promise<{ aiAnalysis: DeepSmartAnalysisAiOutput; modelUsed: string }> {
  const snapshot = buildCompactLedgerSnapshot(analytics);

  const prompt = `You are the chief Financial Intelligence analyst for "AI Money Manager".
Analyze ONLY the following real, server-computed ledger data for scope "${analytics.scopeLabel}" (${analytics.preferredCurrency}).
Do NOT invent any numbers, categories, transactions, or subscriptions that are not in the data.
If unusualExpenses or recurringExpenses are empty, state clearly that no unusual spikes or recurring charges were detected in the current ledger records.
Never recommend monthly savings higher than ${analytics.availableSavingsCapacity} ${analytics.preferredCurrency}.

LEDGER DATA:
${JSON.stringify(snapshot, null, 2)}

Produce a comprehensive JSON report covering:
- executiveSummary (2-3 punchy sentences summarizing net balance, monthly income vs expense, savings rate)
- healthScoreExplanation (why health score is ${analytics.healthScore}/100)
- spendingTrendSummary (comparing this month vs last month and 6-month trajectory)
- unusualExpenseAnalysis (grounded in unusualExpenses array)
- recurringExpenseAnalysis (grounded in recurringExpenses array)
- riskExplanations (1-4 grounded risks matching riskWarnings or low-risk reassurance)
- savingOpportunities (2-4 realistic, data-backed saving opportunities referencing real categories)
- recommendedNextActions (3 concrete step-by-step actions for the user)`;

  const { text, modelUsed } = await generateContentWithResilience({
    contents: prompt,
    config: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          executiveSummary: { type: Type.STRING },
          healthScoreExplanation: { type: Type.STRING },
          spendingTrendSummary: { type: Type.STRING },
          unusualExpenseAnalysis: { type: Type.STRING },
          recurringExpenseAnalysis: { type: Type.STRING },
          riskExplanations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                severity: { type: Type.STRING },
                explanation: { type: Type.STRING },
                impact: { type: Type.STRING },
              },
              required: ['title', 'severity', 'explanation', 'impact'],
            },
          },
          savingOpportunities: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                category: { type: Type.STRING },
                action: { type: Type.STRING },
                potentialMonthlySavings: { type: Type.NUMBER },
                basis: { type: Type.STRING },
              },
              required: ['title', 'category', 'action', 'potentialMonthlySavings', 'basis'],
            },
          },
          recommendedNextActions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                priority: { type: Type.STRING },
                title: { type: Type.STRING },
                detail: { type: Type.STRING },
                targetMetric: { type: Type.STRING },
              },
              required: ['priority', 'title', 'detail', 'targetMetric'],
            },
          },
        },
        required: [
          'executiveSummary',
          'healthScoreExplanation',
          'spendingTrendSummary',
          'unusualExpenseAnalysis',
          'recurringExpenseAnalysis',
          'riskExplanations',
          'savingOpportunities',
          'recommendedNextActions',
        ],
      },
    },
    timeoutMs: 22_000,
    maxRetries: 2,
  });

  const parsed = parseStrictJson<DeepSmartAnalysisAiOutput>(text);
  if (!parsed.executiveSummary || !Array.isArray(parsed.recommendedNextActions)) {
    throw new GeminiServiceError('Invalid Smart Analysis payload from Gemini.', 502, 'GEMINI_INVALID_OUTPUT', true);
  }

  const normalized: DeepSmartAnalysisAiOutput = {
    executiveSummary: String(parsed.executiveSummary).trim(),
    healthScoreExplanation: String(parsed.healthScoreExplanation || '').trim(),
    spendingTrendSummary: String(parsed.spendingTrendSummary || '').trim(),
    unusualExpenseAnalysis: String(parsed.unusualExpenseAnalysis || '').trim(),
    recurringExpenseAnalysis: String(parsed.recurringExpenseAnalysis || '').trim(),
    riskExplanations: (parsed.riskExplanations || []).slice(0, 6).map((r) => ({
      title: String(r.title || 'Risk Note'),
      severity: r.severity === 'high' || r.severity === 'medium' || r.severity === 'low' ? r.severity : 'medium',
      explanation: String(r.explanation || ''),
      impact: String(r.impact || ''),
    })),
    savingOpportunities: (parsed.savingOpportunities || []).slice(0, 5).map((s) => ({
      title: String(s.title || 'Saving Opportunity'),
      category: String(s.category || 'General'),
      action: String(s.action || ''),
      potentialMonthlySavings: round2(
        Math.max(0, Math.min(analytics.availableSavingsCapacity || 0, Number(s.potentialMonthlySavings) || 0))
      ),
      basis: String(s.basis || ''),
    })),
    recommendedNextActions: (parsed.recommendedNextActions || []).slice(0, 5).map((a) => ({
      priority: a.priority === 'High' || a.priority === 'Medium' || a.priority === 'Low' ? a.priority : 'Medium',
      title: String(a.title || 'Action'),
      detail: String(a.detail || ''),
      targetMetric: String(a.targetMetric || ''),
    })),
  };

  return { aiAnalysis: normalized, modelUsed };
}

// ---------------------------------------------------------------------------
// 3. Daily AI Insights (Independent of Chat Quota + Strictly Grounded)
// ---------------------------------------------------------------------------
export interface DailyInsightCardItem {
  category: string;
  amountSpent: number;
  percentageOfExpenses: number | null;
  reason: string;
  recommendedAction: string;
  estimatedPotentialSavings: number | null;
  priority: 'High' | 'Medium' | 'Low';
}

export interface DailyInsightsAiOutput {
  summary: string;
  insights: DailyInsightCardItem[];
}

export async function generateDailyInsights(
  analytics: DeterministicLedgerAnalytics
): Promise<{ result: DailyInsightsAiOutput; modelUsed: string }> {
  const snapshot = buildCompactLedgerSnapshot(analytics);

  const prompt = `You are generating Daily AI Insights for "AI Money Manager".
CURRENCY: ${analytics.preferredCurrency}
CRITICAL STRICTNESS:
- Ground EVERY insight strictly in real transactions, categories, and budgets in LEDGER DATA below.
- For each insight:
  1. category: exact category or account/cashflow area from the ledger
  2. amountSpent: exact amount from the ledger (0 if general cashflow/income)
  3. percentageOfExpenses: exact percentage of monthly expense when monthlyExpense > 0, otherwise null
  4. reason: concise factual explanation citing actual ledger figures
  5. recommendedAction: specific practical step the user can take today
  6. estimatedPotentialSavings: realistic numeric monthly savings in ${analytics.preferredCurrency} ONLY when supported by actual expenses in that category (max 50% of category spend and <= ${analytics.availableSavingsCapacity}), otherwise null
  7. priority: 'High' | 'Medium' | 'Low'
- NEVER fabricate fake weekend trends, fake subscriptions, or invented figures.
- Generate 2 to 4 high-signal insights (if ledger has no transactions yet, return 1 onboarding High/Medium insight with amountSpent: 0 explaining that logging transactions unlocks category audits).

LEDGER DATA:
${JSON.stringify(snapshot, null, 2)}`;

  const { text, modelUsed } = await generateContentWithResilience({
    contents: prompt,
    config: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          insights: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING },
                amountSpent: { type: Type.NUMBER },
                percentageOfExpenses: { type: Type.NUMBER, nullable: true },
                reason: { type: Type.STRING },
                recommendedAction: { type: Type.STRING },
                estimatedPotentialSavings: { type: Type.NUMBER, nullable: true },
                priority: { type: Type.STRING },
              },
              required: ['category', 'amountSpent', 'reason', 'recommendedAction', 'priority'],
            },
          },
        },
        required: ['summary', 'insights'],
      },
    },
    timeoutMs: 20_000,
    maxRetries: 2,
  });

  const parsed = parseStrictJson<DailyInsightsAiOutput>(text);
  if (!parsed.summary || !Array.isArray(parsed.insights) || parsed.insights.length === 0) {
    throw new GeminiServiceError('Gemini AI returned empty Daily Insights.', 502, 'GEMINI_INVALID_OUTPUT', true);
  }

  // Grounding & sanity verification against real ledger categories
  const realCatMap = new Map(
    analytics.allCategoriesThisMonth.map((c) => [c.category.toLowerCase(), c])
  );

  const validatedInsights: DailyInsightCardItem[] = parsed.insights.slice(0, 5).map((item) => {
    const catName = String(item.category || 'General').trim();
    const matchedCat = realCatMap.get(catName.toLowerCase());

    const amountSpent = matchedCat
      ? matchedCat.amount
      : round2(Math.max(0, Number(item.amountSpent) || 0));

    const pct = matchedCat
      ? matchedCat.percentageOfExpenses
      : analytics.thisMonth.expense > 0 && item.percentageOfExpenses != null && isFinite(Number(item.percentageOfExpenses))
      ? round2(Math.max(0, Math.min(100, Number(item.percentageOfExpenses))))
      : null;

    let savings: number | null = null;
    if (item.estimatedPotentialSavings !== null && item.estimatedPotentialSavings !== undefined) {
      const rawSav = Number(item.estimatedPotentialSavings);
      if (isFinite(rawSav) && rawSav > 0) {
        const cap = matchedCat
          ? Math.min(matchedCat.amount, analytics.availableSavingsCapacity || matchedCat.amount)
          : analytics.availableSavingsCapacity;
        savings = cap > 0 ? round2(Math.min(rawSav, cap)) : null;
      }
    }

    const p = String(item.priority || 'Medium');
    const priority: 'High' | 'Medium' | 'Low' = p === 'High' || p === 'Low' || p === 'Medium' ? p : 'Medium';

    return {
      category: matchedCat ? matchedCat.category : catName,
      amountSpent,
      percentageOfExpenses: pct,
      reason: String(item.reason || '').trim(),
      recommendedAction: String(item.recommendedAction || '').trim(),
      estimatedPotentialSavings: savings,
      priority,
    };
  });

  return {
    result: {
      summary: String(parsed.summary).trim(),
      insights: validatedInsights,
    },
    modelUsed,
  };
}

// ---------------------------------------------------------------------------
// 4. Budget Planning AI (Independent of Chat Quota + Never Auto-Mutates DB)
// ---------------------------------------------------------------------------
export interface BudgetCategoryRecommendation {
  category: string;
  currentMonthlySpend: number;
  existingLimit: number | null;
  recommendedLimit: number;
  suggestedMonthlySavings: number;
  reasoning: string;
  priority: 'High' | 'Medium' | 'Low';
}

export interface BudgetPlanAiOutput {
  monthlyIncome: number;
  monthlyExpense: number;
  availableSavingsCapacity: number;
  recommendedMonthlySavings: number;
  overallStrategy: string;
  categoryRecommendations: BudgetCategoryRecommendation[];
}

export async function generateBudgetPlan(
  analytics: DeterministicLedgerAnalytics
): Promise<{ plan: BudgetPlanAiOutput; modelUsed: string }> {
  const snapshot = buildCompactLedgerSnapshot(analytics);

  const prompt = `You are the Budget Planning AI for "AI Money Manager".
Analyze the user's real monthly income (${analytics.thisMonth.income} ${analytics.preferredCurrency}), monthly expenses (${analytics.thisMonth.expense} ${analytics.preferredCurrency}), available balance (${analytics.totalBalance} ${analytics.preferredCurrency}), existing budgets, and historical spending patterns.

STRICT MATHEMATICAL & FEASIBILITY RULES:
1. NEVER recommend total monthly savings higher than availableSavingsCapacity (${analytics.availableSavingsCapacity} ${analytics.preferredCurrency}).
2. Base category recommendations on actual categories in allCategoriesThisMonth, lastMonthCategories, or budgetUtilization.
3. Each recommendedLimit must be a realistic positive number in ${analytics.preferredCurrency} that gives the user clear headroom or reasonable reduction.
4. Keep reasoning concise and grounded in actual spend vs budget figures.

LEDGER DATA:
${JSON.stringify(snapshot, null, 2)}`;

  const { text, modelUsed } = await generateContentWithResilience({
    contents: prompt,
    config: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          recommendedMonthlySavings: { type: Type.NUMBER },
          overallStrategy: { type: Type.STRING },
          categoryRecommendations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING },
                currentMonthlySpend: { type: Type.NUMBER },
                existingLimit: { type: Type.NUMBER, nullable: true },
                recommendedLimit: { type: Type.NUMBER },
                suggestedMonthlySavings: { type: Type.NUMBER },
                reasoning: { type: Type.STRING },
                priority: { type: Type.STRING },
              },
              required: [
                'category',
                'currentMonthlySpend',
                'recommendedLimit',
                'suggestedMonthlySavings',
                'reasoning',
                'priority',
              ],
            },
          },
        },
        required: ['recommendedMonthlySavings', 'overallStrategy', 'categoryRecommendations'],
      },
    },
    timeoutMs: 20_000,
    maxRetries: 2,
  });

  const parsed = parseStrictJson<{
    recommendedMonthlySavings: number;
    overallStrategy: string;
    categoryRecommendations: BudgetCategoryRecommendation[];
  }>(text);

  if (!parsed.overallStrategy || !Array.isArray(parsed.categoryRecommendations)) {
    throw new GeminiServiceError('Gemini AI returned invalid Budget Plan output.', 502, 'GEMINI_INVALID_OUTPUT', true);
  }

  const spendByCat = new Map(analytics.allCategoriesThisMonth.map((c) => [c.category.toLowerCase(), c.amount]));
  const existingBudgetByCat = new Map(
    analytics.budgetUtilization.map((b) => [b.category.toLowerCase(), b.limitConverted])
  );

  // Enforce strict feasibility ceiling on total savings
  const maxSavingsCap = Math.max(0, analytics.availableSavingsCapacity);
  const clampedTotalSavings = round2(
    Math.max(0, Math.min(maxSavingsCap, Number(parsed.recommendedMonthlySavings) || 0))
  );

  const recs: BudgetCategoryRecommendation[] = parsed.categoryRecommendations.slice(0, 8).map((r) => {
    const cat = String(r.category || 'General').trim();
    const realSpend = spendByCat.get(cat.toLowerCase());
    const realBudget = existingBudgetByCat.get(cat.toLowerCase());
    const currentMonthlySpend = realSpend !== undefined ? realSpend : round2(Math.max(0, Number(r.currentMonthlySpend) || 0));
    const existingLimit = realBudget !== undefined ? realBudget : r.existingLimit ?? null;
    const recommendedLimit = round2(Math.max(100, Number(r.recommendedLimit) || Math.max(500, currentMonthlySpend)));
    const rawSav = Math.max(0, Number(r.suggestedMonthlySavings) || 0);
    const suggestedMonthlySavings = round2(Math.min(rawSav, maxSavingsCap));
    const p = String(r.priority || 'Medium');
    const priority: 'High' | 'Medium' | 'Low' = p === 'High' || p === 'Medium' || p === 'Low' ? p : 'Medium';

    return {
      category: cat,
      currentMonthlySpend,
      existingLimit,
      recommendedLimit,
      suggestedMonthlySavings,
      reasoning: String(r.reasoning || '').trim(),
      priority,
    };
  });

  return {
    plan: {
      monthlyIncome: analytics.thisMonth.income,
      monthlyExpense: analytics.thisMonth.expense,
      availableSavingsCapacity: maxSavingsCap,
      recommendedMonthlySavings: clampedTotalSavings,
      overallStrategy: String(parsed.overallStrategy).trim(),
      categoryRecommendations: recs,
    },
    modelUsed,
  };
}
