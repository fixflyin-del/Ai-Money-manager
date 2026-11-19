/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import {
  AiQuotaService,
  FirestoreDataStore,
  FirestoreRestStore,
  getTimezoneDateInfo,
  isActivePaidProUser,
  normalizeTimezone,
} from '../api/_lib/firebaseAuthAndDb';
import { computeLedgerAnalytics, RawAccount, RawBudget, RawTransaction } from '../api/_lib/ledgerAnalytics';
import { AndroidBridge } from '../src/services/androidBridge';
import { EntitlementService } from '../src/services/entitlementService';

// Simulated persistent Firestore store supporting ACID transactional contention checks & instance restarts
class PersistentInMemoryFirestore implements FirestoreDataStore {
  private docs = new Map<string, Record<string, any>>();
  private txMutex = Promise.resolve();

  constructor(initialDocs?: Map<string, Record<string, any>>) {
    if (initialDocs) this.docs = initialDocs;
  }

  snapshotDocs(): Map<string, Record<string, any>> {
    return this.docs;
  }

  async getDocument(docPath: string): Promise<Record<string, any> | null> {
    const found = this.docs.get(docPath);
    return found ? JSON.parse(JSON.stringify(found)) : null;
  }

  async setDocument(docPath: string, data: Record<string, any>): Promise<void> {
    this.docs.set(docPath, JSON.parse(JSON.stringify(data)));
  }

  async listCollection(collectionPath: string): Promise<Record<string, any>[]> {
    const prefix = `${collectionPath}/`;
    const out: Record<string, any>[] = [];
    for (const [k, v] of this.docs.entries()) {
      if (k.startsWith(prefix) && !k.slice(prefix.length).includes('/')) {
        out.push(JSON.parse(JSON.stringify(v)));
      }
    }
    return out;
  }

  async runQuotaTransaction<T>(
    docPath: string,
    handler: (existing: Record<string, any> | null) => { writeData?: Record<string, any>; result: T }
  ): Promise<T> {
    let release!: () => void;
    const prev = this.txMutex;
    this.txMutex = new Promise<void>((res) => {
      release = res;
    });
    await prev;
    try {
      // Simulate realistic network/storage roundtrip delay so parallel callers truly race without mutex
      await new Promise((r) => setTimeout(r, 15));
      const existing = await this.getDocument(docPath);
      const outcome = handler(existing);
      if (outcome.writeData) {
        await this.setDocument(docPath, outcome.writeData);
      }
      return outcome.result;
    } finally {
      release();
    }
  }
}

let passed = 0;
let failed = 0;

function check(cond: boolean, label: string) {
  if (cond) {
    console.log(`  ✅ PASS: ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

async function runUnitAndScenarioTests() {
  console.log('🧪 Running 13-Scenario AI System Verification Suite...\n');

  const backingStore = new Map<string, Record<string, any>>();
  const store = new PersistentInMemoryFirestore(backingStore);
  const userA = 'uid_user_alpha';
  const userB = 'uid_user_beta';
  const proUser = 'uid_user_pro';
  const fixedNow = new Date('2026-11-15T10:00:00.000Z'); // 15:30 IST

  // -------------------------------------------------------------------------
  // Scenario 1 & 2: Free user allowed 1 AI Chat query/day, 2nd blocked
  // -------------------------------------------------------------------------
  console.log('📌 Scenarios 1 & 2: Free User Daily Quota (1 allowed, 2nd blocked)...');
  const statusInit = await AiQuotaService.getStatus(store, userA, 'Asia/Kolkata', false, fixedNow);
  check(statusInit.questionsRemaining === 1 && !statusInit.dailyLimitReached, 'Free user starts with 1/1 remaining');

  const slot1 = await AiQuotaService.acquireChatSlot(store, userA, 'Asia/Kolkata', false, fixedNow);
  check(slot1.allowed === true && slot1.leaseRequired === true, '1st AI Chat request acquires slot');

  const committed1 = await AiQuotaService.commitChatSlot(store, userA, 'Asia/Kolkata', fixedNow);
  check(committed1.questionsRemaining === 0 && committed1.dailyLimitReached === true, 'Commit consumes daily slot (0/1 left)');

  const slot2 = await AiQuotaService.acquireChatSlot(store, userA, 'Asia/Kolkata', false, fixedNow);
  check(slot2.allowed === false && slot2.status.dailyLimitReached === true, '2nd AI Chat on same day is blocked');

  // -------------------------------------------------------------------------
  // Scenario 3: Separate user still has their own 1 free query
  // -------------------------------------------------------------------------
  console.log('\n📌 Scenario 3: Independent Per-User Quota Isolation...');
  const slotB = await AiQuotaService.acquireChatSlot(store, userB, 'Asia/Kolkata', false, fixedNow);
  check(slotB.allowed === true, 'Separate User B retains independent 1/1 quota');
  await AiQuotaService.releaseChatSlot(store, userB, 'Asia/Kolkata', fixedNow);

  // -------------------------------------------------------------------------
  // Scenario 4: Midnight timezone reset restores quota
  // -------------------------------------------------------------------------
  console.log('\n📌 Scenario 4: Midnight Timezone Reset (Asia/Kolkata)...');
  const beforeMidnightIst = new Date('2026-11-15T18:25:00.000Z'); // 23:55 IST Nov 15
  const afterMidnightIst = new Date('2026-11-15T18:35:00.000Z'); // 00:05 IST Nov 16
  const istBefore = getTimezoneDateInfo('Asia/Kolkata', beforeMidnightIst);
  const istAfter = getTimezoneDateInfo('Asia/Kolkata', afterMidnightIst);
  check(istBefore.dateKey === '2026-11-15' && istAfter.dateKey === '2026-11-16', `IST date rolls over cleanly (${istBefore.dateKey} -> ${istAfter.dateKey})`);
  const resetStatus = await AiQuotaService.getStatus(store, userA, 'Asia/Kolkata', false, afterMidnightIst);
  check(resetStatus.questionsRemaining === 1 && !resetStatus.dailyLimitReached, 'User A quota automatically resets to 1/1 after IST midnight');

  // -------------------------------------------------------------------------
  // Scenario 5: Server restart / multi-instance persistence
  // -------------------------------------------------------------------------
  console.log('\n📌 Scenario 5: Server Restart Persistence...');
  const restartedInstanceStore = new PersistentInMemoryFirestore(backingStore);
  const statusAfterRestart = await AiQuotaService.getStatus(restartedInstanceStore, userA, 'Asia/Kolkata', false, fixedNow);
  check(statusAfterRestart.questionsRemaining === 0 && statusAfterRestart.dailyLimitReached, 'Exhausted Nov 15 quota persists across backend instance restarts');

  // -------------------------------------------------------------------------
  // Scenario 6: Two simultaneous requests cannot bypass daily quota limit
  // -------------------------------------------------------------------------
  console.log('\n📌 Scenario 6: Concurrent Simultaneous Request Race Protection...');
  const raceUser = 'uid_user_race';
  const [race1, race2, race3] = await Promise.all([
    AiQuotaService.acquireChatSlot(store, raceUser, 'Asia/Kolkata', false, fixedNow),
    AiQuotaService.acquireChatSlot(store, raceUser, 'Asia/Kolkata', false, fixedNow),
    AiQuotaService.acquireChatSlot(store, raceUser, 'Asia/Kolkata', false, fixedNow),
  ]);
  const allowedCount = [race1, race2, race3].filter((r) => r.allowed).length;
  check(allowedCount === 1, `Exactly 1 of 3 concurrent requests acquired lease (got ${allowedCount})`);

  // -------------------------------------------------------------------------
  // Scenario 7: Gemini failure/timeout does NOT consume user's daily free quota
  // -------------------------------------------------------------------------
  console.log('\n📌 Scenario 7: Gemini Failure Releases Lease Without Consuming Quota...');
  const failUser = 'uid_user_gemini_fail';
  const failAcquire = await AiQuotaService.acquireChatSlot(store, failUser, 'Asia/Kolkata', false, fixedNow);
  check(failAcquire.allowed, 'Lease acquired prior to Gemini call');
  // Simulate Gemini throwing error -> release slot
  const afterFail = await AiQuotaService.releaseChatSlot(store, failUser, 'Asia/Kolkata', fixedNow);
  check(afterFail.questionsRemaining === 1 && afterFail.questionsUsed === 0, 'Quota remains 1/1 after Gemini failure release');
  const retryAcquire = await AiQuotaService.acquireChatSlot(store, failUser, 'Asia/Kolkata', false, fixedNow);
  check(retryAcquire.allowed, 'User can immediately retry AI Chat after failed Gemini call');

  // -------------------------------------------------------------------------
  // Scenario 8: Pro entitlement unlimited access
  // -------------------------------------------------------------------------
  console.log('\n📌 Scenario 8: Active Paid Pro vs Expired/Cancelled Entitlement...');
  check(
    isActivePaidProUser({ isPro: true, subscriptionStatus: 'active' }) === true,
    'Active Pro user recognized on backend'
  );
  check(
    isActivePaidProUser({ isPro: true, expiryDate: '2020-01-01T00:00:00.000Z' }) === false,
    'Expired Pro subscription downgraded on backend'
  );
  check(
    EntitlementService.hasPaidProChatEntitlement({
      subscription: {
        isPro: true,
        billingRegion: 'IN',
        billingCurrency: 'INR',
        amountPaid: 0,
        gateway: 'Free',
        status: 'active',
      },
    } as any) === false,
    'Client EntitlementService keeps 100% Free Edition users on shared 1/day AI Chat quota'
  );
  check(
    EntitlementService.isPro({
      subscription: {
        isPro: false,
        billingRegion: 'IN',
        billingCurrency: 'INR',
        amountPaid: 0,
        gateway: 'Free',
        status: 'active',
      },
    } as any) === true &&
      EntitlementService.canAccess({} as any, 'advanced_charts') === true,
    'Client EntitlementService unlocks all analytics & charts for 100% Free Edition'
  );

  const proSlot1 = await AiQuotaService.acquireChatSlot(store, proUser, 'Asia/Kolkata', true, fixedNow);
  const proSlot2 = await AiQuotaService.acquireChatSlot(store, proUser, 'Asia/Kolkata', true, fixedNow);
  check(proSlot1.allowed && proSlot2.allowed && proSlot1.isPro && !proSlot1.leaseRequired, 'Pro user bypasses 1/day chat limit');

  // -------------------------------------------------------------------------
  // Scenario 9 & 10 & 11: Analytics, Insights, Budget independent + Ledger Math Accuracy
  // -------------------------------------------------------------------------
  console.log('\n📌 Scenarios 9, 10 & 11: Deterministic Ledger Accuracy (Transfers, Duplicates, Soft Deletes, Budgets)...');
  const accounts: RawAccount[] = [
    { id: 'acc_hdfc', name: 'HDFC Bank', type: 'bank', openingPosition: 10000, adjustments: 0, currency: 'INR', sortOrder: 0 },
    { id: 'acc_cash', name: 'Cash Wallet', type: 'cash', openingPosition: 2000, adjustments: 0, currency: 'INR', sortOrder: 1 },
  ];
  const transactions: RawTransaction[] = [
    { id: 'tx_1', type: 'income', amount: 50000, currency: 'INR', category: 'Salary', description: 'Monthly Salary', date: '2026-11-01', accountId: 'acc_hdfc' },
    { id: 'tx_2', type: 'expense', amount: 1500, currency: 'INR', category: 'Food & Dining', description: 'Lunch Cafe', date: '2026-11-05', accountId: 'acc_hdfc' },
    { id: 'tx_3', type: 'expense', amount: 500, currency: 'INR', category: 'Food & Dining', description: 'Coffee', date: '2026-11-06', accountId: 'acc_hdfc' },
    { id: 'tx_4', type: 'expense', amount: 6000, currency: 'INR', category: 'Food & Dining', description: 'Big Family Dinner', date: '2026-11-08', accountId: 'acc_hdfc' },
    // Duplicate ID entry (must be deduplicated)
    { id: 'tx_4', type: 'expense', amount: 6000, currency: 'INR', category: 'Food & Dining', description: 'Big Family Dinner', date: '2026-11-08', accountId: 'acc_hdfc' },
    // Soft-deleted entry (must be excluded)
    { id: 'tx_del', type: 'expense', amount: 99999, currency: 'INR', category: 'Shopping', description: 'Deleted', date: '2026-11-09', accountId: 'acc_hdfc', isDeleted: true },
    // Transfer between accounts (must NEVER inflate income/expense!)
    { id: 'tx_tr', type: 'transfer', amount: 3000, currency: 'INR', category: 'Transfer', description: 'ATM Withdrawal', date: '2026-11-10', accountId: 'acc_hdfc', toAccountId: 'acc_cash' },
    // Recurring Netflix subscription across 2 dates
    { id: 'tx_rec1', type: 'expense', amount: 649, currency: 'INR', category: 'Subscriptions', description: 'Netflix Plan', date: '2026-10-12', accountId: 'acc_hdfc' },
    { id: 'tx_rec2', type: 'expense', amount: 649, currency: 'INR', category: 'Subscriptions', description: 'Netflix Plan', date: '2026-11-12', accountId: 'acc_hdfc' },
  ];
  const budgets: RawBudget[] = [
    { id: 'b1', category: 'Food & Dining', monthlyLimit: 5000, currency: 'INR', alertThreshold: 80 },
  ];

  const analytics = computeLedgerAnalytics({
    accounts,
    transactions,
    budgets,
    preferredCurrency: 'INR',
    timezone: 'Asia/Kolkata',
    scopeAccountId: 'all',
    now: fixedNow,
  });

  // HDFC = 10000 + 50000 - (1500+500+6000+649) - 649 (Oct) - 3000 = 47702
  // Cash = 2000 + 3000 = 5000
  // Total = 52702
  check(analytics.totalBalance === 52702, `Consolidated balance exact (Expected 52702, Got ${analytics.totalBalance})`);
  check(analytics.thisMonth.income === 50000, `Income excludes transfers & deleted tx (Expected 50000, Got ${analytics.thisMonth.income})`);
  check(analytics.thisMonth.expense === 8649, `Expense excludes transfer & deduplicates duplicate tx_4 (Expected 8649, Got ${analytics.thisMonth.expense})`);
  check(analytics.thisMonth.netSavings === 41351, `Net savings accurate (Expected 41351, Got ${analytics.thisMonth.netSavings})`);
  check(analytics.budgetUtilization[0].status === 'overbudget' && analytics.budgetUtilization[0].spentConverted === 8000, 'Overbudget status accurately flagged for Food & Dining (8000 / 5000)');
  check(analytics.unusualExpenses.some((u) => u.transactionId === 'tx_4'), 'Unusual expense outlier (Big Family Dinner 6000) detected');
  check(analytics.recurringExpenses.some((r) => r.label === 'Netflix Plan' && r.occurrences === 2), 'Recurring expense (Netflix Plan) detected cleanly');

  // -------------------------------------------------------------------------
  // Scenario 12: AndroidBridge Web + Android API URL compatibility
  // -------------------------------------------------------------------------
  console.log('\n📌 Scenario 12: Web & Android WebView Compatibility...');
  (globalThis as any).window = {};
  check(AndroidBridge.getApiUrl('/api/ai/chat') === '/api/ai/chat', 'Web runtime resolves relative /api/ai/chat');
  (globalThis as any).window = {
    MoneyFlowNative: {
      isAndroidApk: () => true,
      getCloudUrl: () => 'https://aimoneymanager.pro/',
    },
  };
  check(
    AndroidBridge.getApiUrl('/api/ai/chat') === 'https://aimoneymanager.pro/api/ai/chat',
    'Android WebView bridge resolves canonical https://aimoneymanager.pro/api/ai/chat'
  );
  delete (globalThis as any).window;
}

async function runLiveServerChecks() {
  console.log('\n📌 Scenario 13: Live Server Auth Guard + Real Gemini Model Check (http://127.0.0.1:3000)...');

  const healthRes = await fetch('http://127.0.0.1:3000/api/health');
  const health = (await healthRes.json()) as any;
  check(healthRes.ok && health.status === 'ok', 'Live server /api/health returns 200 OK');
  check(health.geminiConfigured === true, `Live server GEMINI_API_KEY configured (model: ${health.geminiModel})`);

  // Verify ALL AI endpoints reject missing Bearer token with 401
  const endpoints = [
    { method: 'GET', path: '/api/ai/quota-status' },
    { method: 'POST', path: '/api/ai/chat', body: { message: 'test' } },
    { method: 'POST', path: '/api/ai/smart-analysis', body: { accountId: 'all' } },
    { method: 'POST', path: '/api/ai/insights', body: { accountId: 'all' } },
    { method: 'POST', path: '/api/ai/budget-plan', body: {} },
  ];
  for (const ep of endpoints) {
    const res = await fetch(`http://127.0.0.1:3000${ep.path}`, {
      method: ep.method,
      headers: { 'Content-Type': 'application/json' },
      ...(ep.body ? { body: JSON.stringify(ep.body) } : {}),
    });
    check(res.status === 401, `Unauthenticated ${ep.method} ${ep.path} rejected with HTTP 401`);
  }

  // Test invalid JWT is strictly rejected with 401
  const spoofRes = await fetch('http://127.0.0.1:3000/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer fake.jwt.token' },
    body: JSON.stringify({ message: 'test', userId: 'victim_uid' }),
  });
  check(spoofRes.status === 401, 'Forged Bearer JWT rejected with HTTP 401');

  // Test real Firebase Email/Password ephemeral test user -> Live Firestore -> Live Gemini end-to-end!
  const fbConfig = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'firebase-applet-config.json'), 'utf8'));
  const tempEmail = `ai_verify_${Date.now()}@aimoneymanager.test`;
  const signUpRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${fbConfig.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: tempEmail,
        password: 'VerifyAiSystem#2026!',
        returnSecureToken: true,
      }),
    }
  );

  if (!signUpRes.ok) {
    const errBody = await signUpRes.text().catch(() => '');
    console.log(`  ℹ️ Skipping ephemeral Firebase token check (${signUpRes.status}): ${errBody}`);
    return;
  }

  const fbUser = (await signUpRes.json()) as { idToken: string; localId: string };
  const uid = fbUser.localId;
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${fbUser.idToken}`,
  };

  try {
    // Seed a real account & expense into live Firestore via REST store as the authenticated test user
    const liveStore = new FirestoreRestStore(fbUser.idToken);
    await liveStore.setDocument(`users/${uid}`, {
      id: uid,
      name: 'AI Verify Bot',
      email: 'verify@example.com',
      preferredCurrency: 'INR',
      timezone: 'Asia/Kolkata',
      isPro: false,
    });
    await liveStore.setDocument(`users/${uid}/accounts/acc_verify_1`, {
      id: 'acc_verify_1',
      userId: uid,
      name: 'HDFC Test Bank',
      type: 'bank',
      currency: 'INR',
      openingPosition: 25000,
      adjustments: 0,
      balance: 23500,
    });
    const todayIso = getTimezoneDateInfo('Asia/Kolkata').dateKey;
    await liveStore.setDocument(`users/${uid}/transactions/tx_verify_1`, {
      id: 'tx_verify_1',
      userId: uid,
      accountId: 'acc_verify_1',
      type: 'expense',
      amount: 1500,
      currency: 'INR',
      category: 'Food & Dining',
      description: 'Verification Cafe',
      date: todayIso,
      paymentMode: 'UPI',
    });

    // 1. Live Quota Status check
    const q1Res = await fetch('http://127.0.0.1:3000/api/ai/quota-status?timezone=Asia/Kolkata', {
      headers: authHeaders,
    });
    const q1 = (await q1Res.json()) as any;
    check(q1Res.ok && q1.questionsRemaining === 1 && q1.isPro === false, `Live Firestore quota-status returns 1/1 for new user`);

    // 2. Live AI Chat 1st query -> Live Gemini response OR clean lease-rollback if key invalid in sandbox
    const chat1Res = await fetch('http://127.0.0.1:3000/api/ai/chat', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ message: 'Mera total balance aur is mahine ka kharcha batao?', timezone: 'Asia/Kolkata' }),
    });
    const chat1 = (await chat1Res.json()) as any;

    if (chat1Res.status === 503 && (chat1.error === 'GEMINI_API_KEY_INVALID' || chat1.error === 'GEMINI_NOT_CONFIGURED')) {
      console.warn(`  ⚠️ NOTICE: Server GEMINI_API_KEY rejected by Google API (${chat1.error}). Verifying live Firestore lease rollback & CAS concurrency directly...`);
      check(chat1.quotaConsumed === false, 'Failed Gemini call cleanly returns quotaConsumed=false');
      const qAfterFailRes = await fetch('http://127.0.0.1:3000/api/ai/quota-status?timezone=Asia/Kolkata', {
        headers: authHeaders,
      });
      const qAfterFail = (await qAfterFailRes.json()) as any;
      check(
        qAfterFailRes.ok && qAfterFail.questionsRemaining === 1 && qAfterFail.dailyLimitReached === false,
        'Live Firestore CAS lease rollback preserved 1/1 free query after Gemini failure'
      );

      // Test true multi-caller CAS contention directly against live Firestore REST API
      const [liveRace1, liveRace2] = await Promise.all([
        AiQuotaService.acquireChatSlot(liveStore, uid, 'Asia/Kolkata', false),
        AiQuotaService.acquireChatSlot(liveStore, uid, 'Asia/Kolkata', false),
      ]);
      const liveAllowed = [liveRace1, liveRace2].filter((r) => r.allowed).length;
      check(liveAllowed === 1, `Live Firestore CAS atomic transaction allowed strictly 1 of 2 concurrent callers (got ${liveAllowed})`);
      const committedLive = await AiQuotaService.commitChatSlot(liveStore, uid, 'Asia/Kolkata');
      check(committedLive.questionsRemaining === 0 && committedLive.dailyLimitReached === true, 'Live Firestore CAS commit persisted 0/1 remaining');

      const blockedLiveRes = await fetch('http://127.0.0.1:3000/api/ai/chat', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ message: 'Second query after exhaustion', timezone: 'Asia/Kolkata' }),
      });
      const blockedLive = (await blockedLiveRes.json()) as any;
      check(blockedLiveRes.status === 429 && blockedLive.limitReached === true, 'Live 2nd AI Chat query blocked with HTTP 429 Daily limit reached');
    } else {
      check(
        chat1Res.ok && typeof chat1.reply === 'string' && chat1.reply.length > 20 && chat1.questionsRemaining === 0,
        `Live Gemini Chat succeeded (modelUsed=${chat1.modelUsed}, balance in reply=${/23[,.]?500|1[,.]?500/.test(chat1.reply || '')})`
      );

      // 3. Live AI Chat 2nd query -> strictly blocked with HTTP 429
      const chat2Res = await fetch('http://127.0.0.1:3000/api/ai/chat', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ message: 'Second query test', timezone: 'Asia/Kolkata' }),
      });
      const chat2 = (await chat2Res.json()) as any;
      check(chat2Res.status === 429 && chat2.limitReached === true, 'Live 2nd AI Chat query blocked with HTTP 429 Daily limit reached');

      // 4. Deep Smart Analysis still works AFTER daily chat quota exhausted!
      const smartRes = await fetch('http://127.0.0.1:3000/api/ai/smart-analysis', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ accountId: 'all', timezone: 'Asia/Kolkata' }),
      });
      const smart = (await smartRes.json()) as any;
      check(
        smartRes.ok &&
          smart.metrics?.totalBalance === 23500 &&
          smart.metrics?.thisMonth?.expense === 1500 &&
          typeof smart.aiAnalysis?.executiveSummary === 'string',
        `Live Deep Smart Analysis works after chat quota exhausted (model=${smart.modelUsed}, balance=23500)`
      );

      // 5. Daily AI Insights (1st call fresh -> 2nd call smart cached in Firestore!) still works AFTER chat quota exhausted!
      const ins1Res = await fetch('http://127.0.0.1:3000/api/ai/insights', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ accountId: 'all', timezone: 'Asia/Kolkata' }),
      });
      const ins1 = (await ins1Res.json()) as any;
      check(
        ins1Res.ok && ins1.cached === false && Array.isArray(ins1.insights) && ins1.insights.length > 0,
        `Live Daily AI Insights generated grounded insights (model=${ins1.modelUsed}, count=${ins1.insights?.length})`
      );

      const ins2Res = await fetch('http://127.0.0.1:3000/api/ai/insights', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ accountId: 'all', timezone: 'Asia/Kolkata' }),
      });
      const ins2 = (await ins2Res.json()) as any;
      check(ins2Res.ok && ins2.cached === true && ins2.ledgerHash === ins1.ledgerHash, 'Daily AI Insights returns smart Firestore cache when ledger unchanged');

      // 6. Budget Planning AI still works AFTER daily chat quota exhausted!
      const bgtRes = await fetch('http://127.0.0.1:3000/api/ai/budget-plan', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ timezone: 'Asia/Kolkata' }),
      });
      const bgt = (await bgtRes.json()) as any;
      check(
        bgtRes.ok &&
          bgt.plan &&
          bgt.plan.recommendedMonthlySavings <= bgt.plan.availableSavingsCapacity &&
          Array.isArray(bgt.plan.categoryRecommendations),
        `Live Budget Planning AI works & respects savings capacity (${bgt.plan?.recommendedMonthlySavings} <= ${bgt.plan?.availableSavingsCapacity})`
      );
    }
  } finally {
    // Clean up temporary Firebase Auth test account
    await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${fbConfig.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: fbUser.idToken }),
    }).catch(() => {});
  }
}

(async () => {
  await runUnitAndScenarioTests();
  await runLiveServerChecks();

  console.log('\n======================================================');
  console.log(`🎉 AI VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================');
  if (failed > 0) process.exit(1);
})();
