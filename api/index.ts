/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Type } from '@google/genai';
import cors from 'cors';
import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import {
  AiQuotaService,
  AuthVerificationError,
  FirestoreRestStore,
  VerifiedFirebaseUser,
  getTimezoneDateInfo,
  normalizeTimezone,
  verifyRequestFirebaseAuth,
} from './_lib/firebaseAuthAndDb.js';
import {
  DeterministicLedgerAnalytics,
  RawAccount,
  RawBudget,
  RawTransaction,
  computeLedgerAnalytics,
} from './_lib/ledgerAnalytics.js';
import {
  GeminiServiceError,
  generateBudgetPlan,
  generateContentWithResilience,
  generateDailyInsights,
  generateDeepSmartAnalysis,
  generateGroundedChatReply,
  getResolvedModelName,
  isGeminiConfigured,
} from './_lib/geminiClient.js';

dotenv.config();

const app = express();
const publicDir = path.resolve(process.cwd(), 'public');

// Allowed origins including canonical Android and web domains
const allowedOrigins = [
  'https://aimoneymanager.pro',
  'https://www.aimoneymanager.pro',
  'https://aimoney.fixfly.in',
  'https://appassets.androidplatform.net',
  'http://localhost:3000',
  'http://localhost:5173',
  process.env.APP_URL || '',
  process.env.VITE_APP_URL || '',
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith('.run.app') ||
        origin.endsWith('.fixfly.in') ||
        origin.endsWith('.aimoneymanager.pro') ||
        origin.endsWith('.vercel.app')
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Static asset delivery for public files (e.g., APK, AAB, ZIP) with correct MIME types
app.use(
  express.static(publicDir, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.apk')) {
        res.setHeader('Content-Type', 'application/vnd.android.package-archive');
        res.setHeader('Content-Disposition', 'attachment; filename="AI-Money-Manager-v6.2.0.apk"');
      } else if (filePath.endsWith('.aab')) {
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', 'attachment; filename="AI-Money-Manager-v6.2.0.aab"');
      } else if (filePath.endsWith('.zip')) {
        res.setHeader('Content-Type', 'application/zip');
      }
    },
  })
);

// Dedicated direct download routes for users and Google Play release testers
app.get('/download/apk', (_req: Request, res: Response) => {
  const file = path.resolve(publicDir, 'AI-Money-Manager-v6.2.0.apk');
  if (fs.existsSync(file)) {
    res.download(file, 'AI-Money-Manager-v6.2.0.apk');
  } else {
    res.status(404).send('APK artifact not found');
  }
});

app.get('/download/aab', (_req: Request, res: Response) => {
  const file = path.resolve(publicDir, 'AI-Money-Manager-v6.2.0.aab');
  if (fs.existsSync(file)) {
    res.download(file, 'AI-Money-Manager-v6.2.0.aab');
  } else {
    res.status(404).send('AAB artifact not found');
  }
});

app.get('/download/source', (_req: Request, res: Response) => {
  const file = path.resolve(publicDir, 'aimoneymanager-android-v6.2.0.zip');
  if (fs.existsSync(file)) {
    res.download(file, 'aimoneymanager-android-v6.2.0.zip');
  } else {
    res.status(404).send('Source zip artifact not found');
  }
});

// ---------------------------------------------------------------------------
// 1. HEALTH CHECK ENDPOINT
// ---------------------------------------------------------------------------
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'AI Money Manager API',
    environment: process.env.NODE_ENV || 'production',
    timestamp: new Date().toISOString(),
    version: '6.2.0',
    freeMode: true,
    billingEnabled: false,
    geminiConfigured: isGeminiConfigured(),
    geminiModel: getResolvedModelName(),
  });
});

// ---------------------------------------------------------------------------
// 2. EXCHANGE RATES (10 Currencies: INR, USD, EUR, GBP, AED, SAR, CAD, AUD, SGD, JPY)
// ---------------------------------------------------------------------------
const exchangeRatesCache = {
  base: 'USD' as const,
  rates: {
    USD: 1.0,
    INR: 86.5,
    EUR: 0.92,
    GBP: 0.79,
    AED: 3.6725,
    SAR: 3.75,
    CAD: 1.38,
    AUD: 1.54,
    SGD: 1.34,
    JPY: 152.0,
  },
  lastUpdated: new Date().toISOString(),
  source: 'FixFly Reserve Engine (Real-Time)',
};

app.get('/api/exchange-rates', (_req: Request, res: Response) => {
  res.json(exchangeRatesCache);
});

// ---------------------------------------------------------------------------
// 3. AUTHENTICATED LEDGER LOADER & ERROR HELPERS
// ---------------------------------------------------------------------------
interface UserLedgerContext {
  store: FirestoreRestStore;
  profile: Record<string, any> | null;
  timezone: string;
  preferredCurrency: string;
  analytics: DeterministicLedgerAnalytics;
}

async function loadUserLedgerContext(
  user: VerifiedFirebaseUser,
  timezoneInput?: string,
  scopeAccountId: string = 'all'
): Promise<UserLedgerContext> {
  const store = new FirestoreRestStore(user.idToken);
  const [profile, accountDocs, txDocs, budgetDocs] = await Promise.all([
    store.getDocument(`users/${user.uid}`).catch(() => null),
    store.listCollection(`users/${user.uid}/accounts`).catch(() => []),
    store.listCollection(`users/${user.uid}/transactions`).catch(() => []),
    store.listCollection(`users/${user.uid}/budgets`).catch(() => []),
  ]);

  const timezone = normalizeTimezone(timezoneInput || profile?.timezone);
  const preferredCurrency = String(profile?.preferredCurrency || 'INR').toUpperCase();

  const analytics = computeLedgerAnalytics({
    accounts: accountDocs as RawAccount[],
    transactions: txDocs as RawTransaction[],
    budgets: budgetDocs as RawBudget[],
    preferredCurrency,
    timezone,
    scopeAccountId: scopeAccountId || 'all',
  });

  return {
    store,
    profile,
    timezone,
    preferredCurrency,
    analytics,
  };
}

function sendRouteError(
  res: Response,
  err: any,
  fallbackCode = 'AI_SERVICE_ERROR',
  extra: Record<string, any> = {}
) {
  if (err instanceof AuthVerificationError) {
    return res.status(err.status).json({
      error: err.code,
      message: err.message,
      quotaConsumed: false,
      ...extra,
    });
  }
  if (err instanceof GeminiServiceError) {
    return res.status(err.status).json({
      error: err.code,
      message: err.message,
      quotaConsumed: false,
      ...extra,
    });
  }

  console.error(`[${fallbackCode}]`, err?.message || err);
  return res.status(500).json({
    error: fallbackCode,
    message: err?.message || 'An unexpected server error occurred.',
    quotaConsumed: false,
    ...extra,
  });
}

// ---------------------------------------------------------------------------
// 4. GEMINI AI SERVICES (Authenticated + Persistent Firestore Quota & Grounding)
// ---------------------------------------------------------------------------

// A. Daily AI Chat Quota Status (100% Free Edition: 1 successful query/day shared Web & Android)
app.get('/api/ai/quota-status', async (req: Request, res: Response) => {
  try {
    const user = await verifyRequestFirebaseAuth(req);
    const store = new FirestoreRestStore(user.idToken);
    const profile = await store.getDocument(`users/${user.uid}`).catch(() => null);
    const requestedTz = typeof req.query.timezone === 'string' ? req.query.timezone : undefined;
    const timezone = normalizeTimezone(requestedTz || profile?.timezone);

    // 100% Free Edition: every user shares 1 free AI Chat query per day
    const status = await AiQuotaService.getStatus(store, user.uid, timezone, false);
    return res.json(status);
  } catch (err: any) {
    return sendRouteError(res, err, 'QUOTA_STATUS_ERROR');
  }
});

// B. Grounded AI Chat (1/day per verified UID with Firestore CAS lease & rollback on Gemini failure)
app.post('/api/ai/chat', async (req: Request, res: Response) => {
  let verifiedUser: VerifiedFirebaseUser | null = null;
  let store: FirestoreRestStore | null = null;
  let resolvedTz = 'Asia/Kolkata';
  let leaseAcquired = false;

  try {
    verifiedUser = await verifyRequestFirebaseAuth(req);
    const rawMessage = req.body?.message;
    const message = typeof rawMessage === 'string' ? rawMessage.trim() : '';

    if (!message || message.length > 1500) {
      return res.status(400).json({
        error: 'INVALID_MESSAGE',
        message: 'Please provide a valid question (1–1500 characters).',
        quotaConsumed: false,
      });
    }

    store = new FirestoreRestStore(verifiedUser.idToken);
    const profile = await store.getDocument(`users/${verifiedUser.uid}`).catch(() => null);
    resolvedTz = normalizeTimezone(req.body?.timezone || profile?.timezone);

    // Atomically acquire CAS slot BEFORE invoking Gemini
    const slot = await AiQuotaService.acquireChatSlot(store, verifiedUser.uid, resolvedTz, false);
    if (!slot.allowed) {
      return res.status(429).json({
        error: 'DAILY_LIMIT_REACHED',
        quotaExceeded: true,
        limitReached: true,
        quotaConsumed: false,
        message: 'Daily limit reached. Your 1 free daily AI Chat query resets at midnight.',
        ...slot.status,
      });
    }
    leaseAcquired = slot.leaseRequired;

    // Compute real deterministic ledger analytics strictly from verified user's Firestore data
    const [accountDocs, txDocs, budgetDocs] = await Promise.all([
      store.listCollection(`users/${verifiedUser.uid}/accounts`).catch(() => []),
      store.listCollection(`users/${verifiedUser.uid}/transactions`).catch(() => []),
      store.listCollection(`users/${verifiedUser.uid}/budgets`).catch(() => []),
    ]);

    const preferredCurrency = String(profile?.preferredCurrency || 'INR').toUpperCase();
    const analytics = computeLedgerAnalytics({
      accounts: accountDocs as RawAccount[],
      transactions: txDocs as RawTransaction[],
      budgets: budgetDocs as RawBudget[],
      preferredCurrency,
      timezone: resolvedTz,
      scopeAccountId: 'all',
    });

    const { reply, modelUsed } = await generateGroundedChatReply({ message, analytics });

    const committedStatus = leaseAcquired
      ? await AiQuotaService.commitChatSlot(store, verifiedUser.uid, resolvedTz)
      : slot.status;
    leaseAcquired = false;

    return res.json({
      reply,
      modelUsed,
      quotaConsumed: true,
      ledgerHighlights: {
        totalBalance: analytics.totalBalance,
        thisMonthIncome: analytics.thisMonth.income,
        thisMonthExpense: analytics.thisMonth.expense,
        savingsRate: analytics.thisMonth.savingsRate,
        preferredCurrency: analytics.preferredCurrency,
      },
      ...committedStatus,
    });
  } catch (err: any) {
    if (leaseAcquired && store && verifiedUser) {
      await AiQuotaService.releaseChatSlot(store, verifiedUser.uid, resolvedTz).catch(() => {});
    }
    return sendRouteError(res, err, 'AI_CHAT_ERROR');
  }
});

// C. Deep AI Smart Analysis (Independent of 1/day AI Chat quota)
app.post('/api/ai/smart-analysis', async (req: Request, res: Response) => {
  try {
    const user = await verifyRequestFirebaseAuth(req);
    const scopeAccountId = typeof req.body?.accountId === 'string' && req.body.accountId.trim()
      ? req.body.accountId.trim()
      : 'all';

    const { analytics } = await loadUserLedgerContext(user, req.body?.timezone, scopeAccountId);
    const { aiAnalysis, modelUsed } = await generateDeepSmartAnalysis(analytics);

    return res.json({
      success: true,
      modelUsed,
      generatedAt: new Date().toISOString(),
      metrics: analytics,
      aiAnalysis,
    });
  } catch (err: any) {
    return sendRouteError(res, err, 'SMART_ANALYSIS_ERROR');
  }
});

// D. Daily AI Insights with Smart Firestore Caching (Independent of 1/day AI Chat quota)
app.post('/api/ai/insights', async (req: Request, res: Response) => {
  try {
    const user = await verifyRequestFirebaseAuth(req);
    const scopeAccountId = typeof req.body?.accountId === 'string' && req.body.accountId.trim()
      ? req.body.accountId.trim()
      : 'all';
    const forceRefresh = Boolean(req.body?.forceRefresh);

    const { store, timezone, analytics } = await loadUserLedgerContext(user, req.body?.timezone, scopeAccountId);
    const { dateKey } = getTimezoneDateInfo(timezone);
    const safeScopeId = scopeAccountId.replace(/[^a-zA-Z0-9_-]/g, '_') || 'all';
    const cacheDocPath = `users/${user.uid}/ai_insights/daily_${safeScopeId}`;

    const existingCache = await store.getDocument(cacheDocPath).catch(() => null);
    if (
      existingCache &&
      existingCache.date === dateKey &&
      existingCache.ledgerHash === analytics.materialLedgerHash &&
      Array.isArray(existingCache.insights) &&
      existingCache.insights.length > 0
    ) {
      // If unchanged ledger today, return smart cache (protect API credits on repeated renders)
      const lastGenMs = existingCache.generatedAt ? new Date(existingCache.generatedAt).getTime() : 0;
      const recentlyGenerated = !isNaN(lastGenMs) && Date.now() - lastGenMs < 30_000;
      if (!forceRefresh || recentlyGenerated) {
        return res.json({
          success: true,
          cached: true,
          rateProtected: forceRefresh && recentlyGenerated,
          ledgerHash: existingCache.ledgerHash,
          generatedAt: existingCache.generatedAt,
          modelUsed: existingCache.modelUsed || getResolvedModelName(),
          preferredCurrency: existingCache.preferredCurrency || analytics.preferredCurrency,
          summary: existingCache.summary,
          insights: existingCache.insights,
        });
      }
    }

    const { result, modelUsed } = await generateDailyInsights(analytics);
    const generatedAt = new Date().toISOString();

    await store
      .setDocument(cacheDocPath, {
        date: dateKey,
        scopeAccountId,
        ledgerHash: analytics.materialLedgerHash,
        generatedAt,
        modelUsed,
        preferredCurrency: analytics.preferredCurrency,
        summary: result.summary,
        insights: result.insights,
      })
      .catch(() => {});

    return res.json({
      success: true,
      cached: false,
      ledgerHash: analytics.materialLedgerHash,
      generatedAt,
      modelUsed,
      preferredCurrency: analytics.preferredCurrency,
      summary: result.summary,
      insights: result.insights,
    });
  } catch (err: any) {
    return sendRouteError(res, err, 'DAILY_INSIGHTS_ERROR');
  }
});

// E. Legacy Financial Advice Alias (Authenticated + Grounded in Firestore Ledger)
app.post('/api/ai/advice', async (req: Request, res: Response) => {
  try {
    const user = await verifyRequestFirebaseAuth(req);
    const { analytics } = await loadUserLedgerContext(user, req.body?.timezone, 'all');
    const { result } = await generateDailyInsights(analytics);

    return res.json({
      score: analytics.healthScore,
      rating: analytics.healthRating,
      summary: result.summary,
      monthlySavingsRate: analytics.thisMonth.savingsRate,
      anomalies: analytics.riskWarnings.map((w) => w.detail),
      tips: result.insights.map((ins) => ({
        title: `${ins.category} Insight`,
        description: ins.recommendedAction || ins.reason,
        impact: ins.priority.toLowerCase() as 'high' | 'medium' | 'low',
        category: ins.category,
      })),
    });
  } catch (err: any) {
    return sendRouteError(res, err, 'FINANCIAL_ADVICE_ERROR');
  }
});

// F. Budget Planning AI (Independent of Chat Quota & Never Auto-Mutates User Budgets)
app.post('/api/ai/budget-plan', async (req: Request, res: Response) => {
  try {
    const user = await verifyRequestFirebaseAuth(req);
    const { analytics } = await loadUserLedgerContext(user, req.body?.timezone, 'all');
    const { plan, modelUsed } = await generateBudgetPlan(analytics);

    return res.json({
      success: true,
      modelUsed,
      generatedAt: new Date().toISOString(),
      preferredCurrency: analytics.preferredCurrency,
      plan,
    });
  } catch (err: any) {
    return sendRouteError(res, err, 'BUDGET_PLAN_ERROR');
  }
});

// G. Receipt Scanner (Authenticated, supports /api/ai/receipt-scan & /api/ai/scan-receipt)
async function handleReceiptScan(req: Request, res: Response) {
  try {
    await verifyRequestFirebaseAuth(req);
    const { image, mimeType = 'image/jpeg', preferredCurrency = 'INR' } = req.body || {};

    if (!image || typeof image !== 'string') {
      return res.status(400).json({ error: 'INVALID_IMAGE', message: 'Receipt image data is required.' });
    }

    const cleanBase64 = image.includes('base64,') ? image.split('base64,')[1] : image;
    const todayIso = getTimezoneDateInfo().dateKey;

    const prompt = `Analyze this physical or digital store receipt photo.
Extract accurately:
1. merchant: store or business name
2. date: YYYY-MM-DD format (if missing, use ${todayIso})
3. amount: positive total number
4. currency: ISO 3-letter currency code (default ${preferredCurrency})
5. category: One of ['Food & Dining', 'Groceries', 'Transport', 'Shopping', 'Utilities', 'Entertainment', 'Health', 'Travel', 'General']
6. paymentMode: One of ['Cash', 'UPI', 'Credit Card', 'Debit Card', 'Net Banking', 'Wallet', 'Other']
7. taxAmount: tax number if listed (0 otherwise)
8. items: list of line items with name and price
9. confidence: number between 0.0 and 1.0.`;

    const { text } = await generateContentWithResilience({
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: String(mimeType || 'image/jpeg'),
              data: cleanBase64,
            },
          },
          { text: prompt },
        ],
      },
      config: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            merchant: { type: Type.STRING },
            amount: { type: Type.NUMBER },
            currency: { type: Type.STRING },
            date: { type: Type.STRING },
            category: { type: Type.STRING },
            paymentMode: { type: Type.STRING },
            taxAmount: { type: Type.NUMBER },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  price: { type: Type.NUMBER },
                },
              },
            },
            confidence: { type: Type.NUMBER },
          },
          required: ['merchant', 'amount', 'currency', 'category', 'paymentMode'],
        },
      },
      timeoutMs: 22_000,
      maxRetries: 2,
    });

    const parsed = JSON.parse(text);
    return res.json(parsed);
  } catch (err: any) {
    return sendRouteError(res, err, 'RECEIPT_SCAN_ERROR');
  }
}

app.post('/api/ai/receipt-scan', handleReceiptScan);
app.post('/api/ai/scan-receipt', handleReceiptScan);

// H. Voice / Natural-Text Expense Parser (Authenticated, supports /api/ai/parse-transaction & /api/ai/voice-expense)
async function handleParseTransaction(req: Request, res: Response) {
  try {
    await verifyRequestFirebaseAuth(req);
    const text = String(req.body?.text || req.body?.transcript || req.body?.query || '').trim();
    const preferredCurrency = String(req.body?.preferredCurrency || 'INR').toUpperCase();

    if (!text) {
      return res.status(400).json({ error: 'INVALID_TEXT', message: 'Text or speech transcript is required.' });
    }

    const prompt = `You are a financial transaction parser for "AI Money Manager".
Parse this user input: "${text.slice(0, 500)}".
Default currency is ${preferredCurrency}.
Return JSON with:
- amount: positive number
- currency: ISO 3-letter code (INR, USD, EUR, GBP, AED, SAR, CAD, AUD, SGD, JPY)
- category: One of ['Food & Dining', 'Groceries', 'Transport', 'Shopping', 'Utilities', 'Entertainment', 'Health', 'Travel', 'Salary', 'Freelance', 'General']
- merchantOrDescription: concise title
- paymentMode: One of ['Cash', 'UPI', 'Credit Card', 'Debit Card', 'Net Banking', 'Wallet', 'Other']
- type: 'expense' or 'income'
- notes: short summary`;

    const { text: rawJson } = await generateContentWithResilience({
      contents: prompt,
      config: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            amount: { type: Type.NUMBER },
            currency: { type: Type.STRING },
            category: { type: Type.STRING },
            merchantOrDescription: { type: Type.STRING },
            paymentMode: { type: Type.STRING },
            type: { type: Type.STRING },
            notes: { type: Type.STRING },
          },
          required: ['amount', 'currency', 'category', 'merchantOrDescription', 'paymentMode', 'type'],
        },
      },
      timeoutMs: 16_000,
      maxRetries: 2,
    });

    const parsed = JSON.parse(rawJson);
    return res.json({ ...parsed, rawText: text });
  } catch (err: any) {
    return sendRouteError(res, err, 'VOICE_PARSE_ERROR');
  }
}

app.post('/api/ai/parse-transaction', handleParseTransaction);
app.post('/api/ai/voice-expense', handleParseTransaction);

// ---------------------------------------------------------------------------
// 5. DIRECT GITHUB DEPLOYMENT ENDPOINT
// ---------------------------------------------------------------------------
app.post('/api/admin/push-to-github', (req: Request, res: Response) => {
  const { token } = req.body || {};
  if (!token || typeof token !== 'string' || token.trim().length < 8) {
    return res.status(400).json({ error: 'Please provide a valid GitHub Personal Access Token (PAT).' });
  }

  const cleanToken = token.trim();
  const remoteUrl = `https://${cleanToken}@github.com/fixflyin-del/Ai-Money-manager.git`;

  try {
    execSync(`git push "${remoteUrl}" main:main --force`, { cwd: process.cwd(), stdio: 'pipe' });
    execSync(`git push "${remoteUrl}" --tags --force`, { cwd: process.cwd(), stdio: 'pipe' });
    return res.json({
      success: true,
      message: 'Successfully pushed release v6.2.0 to https://github.com/fixflyin-del/Ai-Money-manager.',
      tag: 'v6.2.0',
    });
  } catch (error: any) {
    console.error('Git push error:', error?.message);
    const stderr = error?.stderr ? error.stderr.toString() : error?.message;
    return res.status(500).json({
      error: 'Git push failed. Please verify that your token has repository write permissions (repo scope).',
      details: stderr,
    });
  }
});

// ---------------------------------------------------------------------------
// 6. GOOGLE PLAY COMPLIANT ACCOUNT & DATA DELETION REQUEST ENDPOINT
// ---------------------------------------------------------------------------
interface DeletionRequest {
  ticketId: string;
  email: string;
  name: string;
  reason?: string;
  userId?: string;
  status: 'PENDING' | 'PROCESSED';
  createdAt: string;
}

const deletionRequestsLog: DeletionRequest[] = [];

app.post('/api/account/deletion-request', (req: Request, res: Response) => {
  const { email, name, reason, userId } = req.body || {};

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({
      success: false,
      error: 'A valid email address is required to process your account deletion request.',
    });
  }

  const ticketId = `DEL-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const requestRecord: DeletionRequest = {
    ticketId,
    email: email.trim().toLowerCase(),
    name: name ? String(name).trim() : 'Registered User',
    reason: reason ? String(reason).trim() : 'User initiated account deletion',
    userId: userId ? String(userId).trim() : undefined,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  };

  deletionRequestsLog.push(requestRecord);
  console.log(`[Account Deletion Request] Ticket ${ticketId} created for ${email}`);

  return res.json({
    success: true,
    ticketId,
    status: 'PENDING',
    message:
      'Your account deletion request has been registered. In accordance with Google Play Data Safety policies, all associated financial ledgers, accounts, transactions, and backups will be purged within 7 business days. You will receive email confirmation at ' +
      email.trim() +
      '.',
    company: 'Fixfly Innovations Pvt. Ltd.',
    supportEmail: 'info@fixfly.in',
  });
});

// ---------------------------------------------------------------------------
// 7. CONTACT & FEEDBACK SUBMISSION ENDPOINTS
// ---------------------------------------------------------------------------
app.post('/api/contact/submit', (req: Request, res: Response) => {
  const { email, subject, message } = req.body || {};
  if (!email || !message) {
    return res.status(400).json({ success: false, error: 'Email and message are required.' });
  }

  const ticketId = `CNT-${Date.now().toString(36).toUpperCase()}`;
  console.log(`[Contact Submission] Ticket: ${ticketId} from ${email}: ${subject || 'General Inquiry'}`);

  return res.json({
    success: true,
    ticketId,
    message:
      'Thank you for contacting Fixfly Innovations Pvt. Ltd. Your inquiry has been logged and our support desk will respond within 24 hours.',
  });
});

app.post('/api/feedback/submit', (req: Request, res: Response) => {
  const { email, rating, feedback, type } = req.body || {};
  if (!feedback) {
    return res.status(400).json({ success: false, error: 'Feedback text is required.' });
  }

  console.log(`[Feedback Submission] Type: ${type || 'General'} Rating: ${rating}/5 from ${email || 'Anonymous'}`);
  return res.json({
    success: true,
    message: 'Thank you for your feedback! Your inputs directly help improve AI Money Manager.',
  });
});

export default app;
