/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import { getTimezoneDateInfo } from './firebaseAuthAndDb.js';

export const CURRENCY_RATES_USD_BASE: Record<string, number> = {
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
};

export interface RawAccount {
  id: string;
  name: string;
  type?: string;
  balance?: number;
  openingPosition?: number;
  adjustments?: number;
  netTransfers?: number;
  currency?: string;
  archived?: boolean;
  sortOrder?: number;
}

export interface RawTransaction {
  id: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  currency?: string;
  category?: string;
  description?: string;
  notes?: string;
  date: string;
  accountId: string;
  toAccountId?: string;
  paymentMode?: string;
  exchangeRateAtTransaction?: number;
  isDeleted?: boolean;
  createdAt?: string;
}

export interface RawBudget {
  id: string;
  category: string;
  monthlyLimit: number;
  currency?: string;
  alertThreshold?: number;
}

export interface CategoryBreakdownItem {
  category: string;
  amount: number;
  count: number;
  percentageOfExpenses: number;
  lastMonthAmount: number;
  momChangePercent: number | null;
}

export interface AccountPositionItem {
  id: string;
  name: string;
  type: string;
  currency: string;
  nativeBalance: number;
  convertedBalance: number;
  thisMonthIncome: number;
  thisMonthExpense: number;
  thisMonthTransferIn: number;
  thisMonthTransferOut: number;
  sharePercent: number;
}

export interface UnusualExpenseItem {
  transactionId: string;
  date: string;
  category: string;
  description: string;
  amountConverted: number;
  reason: string;
}

export interface RecurringExpenseItem {
  label: string;
  category: string;
  occurrences: number;
  averageAmountConverted: number;
  totalAmountConverted: number;
  lastDate: string;
}

export interface BudgetUtilizationItem {
  id: string;
  category: string;
  limitConverted: number;
  spentConverted: number;
  remainingConverted: number;
  percentUsed: number;
  projectedMonthSpend: number;
  status: 'ok' | 'warning' | 'overbudget';
}

export interface RiskWarningItem {
  code: string;
  title: string;
  severity: 'high' | 'medium' | 'low';
  detail: string;
}

export interface DeterministicLedgerAnalytics {
  preferredCurrency: string;
  timezone: string;
  scopeAccountId: string;
  scopeLabel: string;
  currentMonth: string;
  lastMonth: string;
  currentDayOfMonth: number;
  totalDaysInMonth: number;
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
  trailing3MonthsAvg: {
    income: number;
    expense: number;
    netSavings: number;
  };
  healthScore: number;
  healthRating: 'Excellent' | 'Good' | 'Needs Attention' | 'Critical';
  topCategories: CategoryBreakdownItem[];
  allCategoriesThisMonth: CategoryBreakdownItem[];
  lastMonthCategories: CategoryBreakdownItem[];
  accountPositions: AccountPositionItem[];
  last6MonthsTrend: { key: string; label: string; income: number; expense: number; netSavings: number }[];
  unusualExpenses: UnusualExpenseItem[];
  recurringExpenses: RecurringExpenseItem[];
  budgetUtilization: BudgetUtilizationItem[];
  riskWarnings: RiskWarningItem[];
  discretionaryTotal: number;
  availableSavingsCapacity: number;
  recentTransactionsSnippet: {
    id: string;
    date: string;
    type: string;
    category: string;
    description: string;
    amountConverted: number;
    accountName: string;
  }[];
  materialLedgerHash: string;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function convertCurrencyServer(
  amount: number,
  fromCurrency = 'INR',
  toCurrency = 'INR',
  customSourceUsdRate?: number
): number {
  const num = Number(amount);
  if (!isFinite(num)) return 0;
  const from = (fromCurrency || 'INR').toUpperCase();
  const to = (toCurrency || 'INR').toUpperCase();
  if (from === to) return round2(num);

  const fromRate =
    typeof customSourceUsdRate === 'number' && isFinite(customSourceUsdRate) && customSourceUsdRate > 0
      ? customSourceUsdRate
      : CURRENCY_RATES_USD_BASE[from] || 1;
  const toRate = CURRENCY_RATES_USD_BASE[to] || 1;

  const inUsd = num / fromRate;
  return round2(inUsd * toRate);
}

function deduplicateAccounts(accounts: RawAccount[]): RawAccount[] {
  const map = new Map<string, RawAccount>();
  for (const acc of accounts) {
    if (acc && typeof acc.id === 'string' && acc.id.trim()) {
      map.set(acc.id, acc);
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    const sa = typeof a.sortOrder === 'number' && isFinite(a.sortOrder) ? a.sortOrder : Number.MAX_SAFE_INTEGER;
    const sb = typeof b.sortOrder === 'number' && isFinite(b.sortOrder) ? b.sortOrder : Number.MAX_SAFE_INTEGER;
    return sa - sb;
  });
}

function deduplicateTransactions(transactions: RawTransaction[]): RawTransaction[] {
  const map = new Map<string, RawTransaction>();
  for (const tx of transactions) {
    if (!tx || typeof tx.id !== 'string' || !tx.id.trim()) continue;
    if (tx.isDeleted === true) continue;
    const amt = Number(tx.amount);
    if (!isFinite(amt) || amt <= 0) continue;
    if (tx.type !== 'income' && tx.type !== 'expense' && tx.type !== 'transfer') continue;
    map.set(tx.id, { ...tx, amount: amt });
  }
  return Array.from(map.values()).sort((a, b) => {
    const dCmp = String(b.date || '').localeCompare(String(a.date || ''));
    if (dCmp !== 0) return dCmp;
    return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
  });
}

function computeDeterministicNativeAccountBalance(acc: RawAccount, txs: RawTransaction[]): number {
  const accTxs = txs.filter((tx) => tx.accountId === acc.id || (tx.type === 'transfer' && tx.toAccountId === acc.id));

  // If openingPosition isn't persisted on the doc, trust authoritative stored balance if no transactions exist
  if (typeof acc.openingPosition !== 'number' && accTxs.length === 0) {
    return round2(Number(acc.balance || 0));
  }

  // If openingPosition is 0 and adjustments is 0 and stored balance is non-zero with 0 transactions, preserve stored balance
  if (
    accTxs.length === 0 &&
    Number(acc.openingPosition || 0) === 0 &&
    Number(acc.adjustments || 0) === 0 &&
    Number(acc.balance || 0) !== 0
  ) {
    return round2(Number(acc.balance || 0));
  }

  const accCurrency = acc.currency || 'INR';
  let balance = Number(acc.openingPosition || 0) + Number(acc.adjustments || 0);

  for (const tx of accTxs) {
    const amtInAccCurrency = convertCurrencyServer(
      tx.amount,
      tx.currency || accCurrency,
      accCurrency,
      tx.exchangeRateAtTransaction
    );

    if (tx.type === 'income' && tx.accountId === acc.id) {
      balance += amtInAccCurrency;
    } else if (tx.type === 'expense' && tx.accountId === acc.id) {
      balance -= amtInAccCurrency;
    } else if (tx.type === 'transfer') {
      if (tx.accountId === acc.id) balance -= amtInAccCurrency;
      else if (tx.toAccountId === acc.id) balance += amtInAccCurrency;
    }
  }

  return round2(balance);
}

function shiftMonthKey(monthKey: string, deltaMonths: number): string {
  const [yStr, mStr] = monthKey.split('-');
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  const d = new Date(Date.UTC(y, m - 1 + deltaMonths, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function formatMonthShort(monthKey: string): string {
  const [yStr, mStr] = monthKey.split('-');
  const d = new Date(Date.UTC(parseInt(yStr, 10), parseInt(mStr, 10) - 1, 1));
  return d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
}

export function computeLedgerAnalytics(params: {
  accounts: RawAccount[];
  transactions: RawTransaction[];
  budgets?: RawBudget[];
  preferredCurrency?: string;
  timezone?: string;
  scopeAccountId?: string;
  now?: Date;
}): DeterministicLedgerAnalytics {
  const preferredCurrency = (params.preferredCurrency || 'INR').toUpperCase();
  const now = params.now || new Date();
  const { timezone, dateKey } = getTimezoneDateInfo(params.timezone, now);
  const currentMonth = dateKey.slice(0, 7);
  const lastMonth = shiftMonthKey(currentMonth, -1);
  const currentDayOfMonth = Math.max(1, parseInt(dateKey.slice(8, 10), 10));
  const [curY, curM] = currentMonth.split('-').map((v) => parseInt(v, 10));
  const totalDaysInMonth = new Date(Date.UTC(curY, curM, 0)).getUTCDate();

  const allAccounts = deduplicateAccounts(params.accounts || []);
  const activeAccounts = allAccounts.filter((a) => !a.archived);
  const allTxs = deduplicateTransactions(params.transactions || []);
  const budgets = (params.budgets || []).filter((b) => b && b.category && Number(b.monthlyLimit) > 0);

  const requestedScopeId = params.scopeAccountId && params.scopeAccountId !== 'all' ? params.scopeAccountId : 'all';
  const matchedScopeAcc =
    requestedScopeId !== 'all' ? activeAccounts.find((a) => a.id === requestedScopeId) : undefined;
  const scopeAccountId = matchedScopeAcc ? matchedScopeAcc.id : 'all';
  const scopeLabel = matchedScopeAcc ? matchedScopeAcc.name : 'All Accounts Overview';

  const accountNameById = new Map<string, string>();
  for (const a of allAccounts) accountNameById.set(a.id, a.name || a.id);

  // Per-account balances and monthly activity
  const accountPositionsRaw = activeAccounts.map((acc) => {
    const nativeBalance = computeDeterministicNativeAccountBalance(acc, allTxs);
    const convertedBalance = convertCurrencyServer(nativeBalance, acc.currency || 'INR', preferredCurrency);

    let mInc = 0;
    let mExp = 0;
    let mTIn = 0;
    let mTOut = 0;

    for (const tx of allTxs) {
      if (!String(tx.date || '').startsWith(currentMonth)) continue;
      const amtConv = convertCurrencyServer(
        tx.amount,
        tx.currency || 'INR',
        preferredCurrency,
        tx.exchangeRateAtTransaction
      );
      if (tx.type === 'income' && tx.accountId === acc.id) mInc += amtConv;
      else if (tx.type === 'expense' && tx.accountId === acc.id) mExp += amtConv;
      else if (tx.type === 'transfer') {
        if (tx.accountId === acc.id) mTOut += amtConv;
        if (tx.toAccountId === acc.id) mTIn += amtConv;
      }
    }

    return {
      id: acc.id,
      name: acc.name || 'Account',
      type: acc.type || 'bank',
      currency: acc.currency || 'INR',
      nativeBalance,
      convertedBalance,
      thisMonthIncome: round2(mInc),
      thisMonthExpense: round2(mExp),
      thisMonthTransferIn: round2(mTIn),
      thisMonthTransferOut: round2(mTOut),
      sharePercent: 0,
    };
  });

  const allAccountsTotalBal = round2(accountPositionsRaw.reduce((sum, a) => sum + a.convertedBalance, 0));
  const accountPositions: AccountPositionItem[] = accountPositionsRaw.map((a) => ({
    ...a,
    sharePercent:
      allAccountsTotalBal > 0 ? round2((Math.max(0, a.convertedBalance) / allAccountsTotalBal) * 100) : 0,
  }));

  const scopedAccounts =
    scopeAccountId === 'all' ? accountPositions : accountPositions.filter((a) => a.id === scopeAccountId);
  const totalBalance = round2(scopedAccounts.reduce((sum, a) => sum + a.convertedBalance, 0));

  // Filter transactions by scope
  const scopedTxs = allTxs.filter((tx) => {
    if (scopeAccountId === 'all') return true;
    return tx.accountId === scopeAccountId || (tx.type === 'transfer' && tx.toAccountId === scopeAccountId);
  });

  // Current month & last month aggregation (TRANSFERS NEVER COUNTED AS INCOME OR EXPENSE)
  let curIncome = 0;
  let curExpense = 0;
  let curTransferIn = 0;
  let curTransferOut = 0;
  let curTransferInternal = 0;
  let curTxCount = 0;

  let prevIncome = 0;
  let prevExpense = 0;

  const curCatMap = new Map<string, { amount: number; count: number }>();
  const prevCatMap = new Map<string, { amount: number; count: number }>();

  for (const tx of scopedTxs) {
    const txMonth = String(tx.date || '').slice(0, 7);
    const amtConv = convertCurrencyServer(
      tx.amount,
      tx.currency || 'INR',
      preferredCurrency,
      tx.exchangeRateAtTransaction
    );

    const isOwnerAccount = scopeAccountId === 'all' || tx.accountId === scopeAccountId;

    if (txMonth === currentMonth) {
      curTxCount++;
      if (tx.type === 'income' && isOwnerAccount) {
        curIncome += amtConv;
      } else if (tx.type === 'expense' && isOwnerAccount) {
        curExpense += amtConv;
        const cat = (tx.category || 'General').trim() || 'General';
        const cur = curCatMap.get(cat) || { amount: 0, count: 0 };
        cur.amount += amtConv;
        cur.count += 1;
        curCatMap.set(cat, cur);
      } else if (tx.type === 'transfer') {
        if (scopeAccountId === 'all') curTransferInternal += amtConv;
        else {
          if (tx.accountId === scopeAccountId) curTransferOut += amtConv;
          if (tx.toAccountId === scopeAccountId) curTransferIn += amtConv;
        }
      }
    } else if (txMonth === lastMonth) {
      if (tx.type === 'income' && isOwnerAccount) {
        prevIncome += amtConv;
      } else if (tx.type === 'expense' && isOwnerAccount) {
        prevExpense += amtConv;
        const cat = (tx.category || 'General').trim() || 'General';
        const prev = prevCatMap.get(cat) || { amount: 0, count: 0 };
        prev.amount += amtConv;
        prev.count += 1;
        prevCatMap.set(cat, prev);
      }
    }
  }

  curIncome = round2(curIncome);
  curExpense = round2(curExpense);
  prevIncome = round2(prevIncome);
  prevExpense = round2(prevExpense);
  const netSavings = round2(curIncome - curExpense);
  const savingsRate = curIncome > 0 ? round2((netSavings / curIncome) * 100) : 0;
  const lastNetSavings = round2(prevIncome - prevExpense);
  const lastSavingsRate = prevIncome > 0 ? round2((lastNetSavings / prevIncome) * 100) : 0;

  const dailyBurnRate = round2(curExpense / currentDayOfMonth);
  const projectedMonthExpense = round2(dailyBurnRate * totalDaysInMonth);
  const runwayDays = dailyBurnRate > 0 ? Math.max(0, Math.round(totalBalance / dailyBurnRate)) : 999;

  // Categories breakdown
  const allCategoriesThisMonth: CategoryBreakdownItem[] = Array.from(curCatMap.entries())
    .map(([category, info]) => {
      const prevAmt = round2(prevCatMap.get(category)?.amount || 0);
      const amt = round2(info.amount);
      const momChangePercent =
        prevAmt > 0 ? round2(((amt - prevAmt) / prevAmt) * 100) : null;
      return {
        category,
        amount: amt,
        count: info.count,
        percentageOfExpenses: curExpense > 0 ? round2((amt / curExpense) * 100) : 0,
        lastMonthAmount: prevAmt,
        momChangePercent,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const lastMonthCategories: CategoryBreakdownItem[] = Array.from(prevCatMap.entries())
    .map(([category, info]) => ({
      category,
      amount: round2(info.amount),
      count: info.count,
      percentageOfExpenses: prevExpense > 0 ? round2((info.amount / prevExpense) * 100) : 0,
      lastMonthAmount: 0,
      momChangePercent: null,
    }))
    .sort((a, b) => b.amount - a.amount);

  const topCategories = allCategoriesThisMonth.slice(0, 6);

  // Discretionary sum
  const discretionaryKeywords = [
    'entertainment',
    'shopping',
    'dining',
    'food & dining',
    'leisure',
    'games',
    'subscriptions',
    'travel',
  ];
  const discretionaryTotal = round2(
    allCategoriesThisMonth
      .filter((c) => discretionaryKeywords.some((kw) => c.category.toLowerCase().includes(kw)))
      .reduce((sum, c) => sum + c.amount, 0)
  );

  // 6-Month Cash Flow Trend
  const last6MonthsTrend: { key: string; label: string; income: number; expense: number; netSavings: number }[] = [];
  for (let i = -5; i <= 0; i++) {
    const key = shiftMonthKey(currentMonth, i);
    last6MonthsTrend.push({
      key,
      label: formatMonthShort(key),
      income: 0,
      expense: 0,
      netSavings: 0,
    });
  }

  for (const tx of scopedTxs) {
    const key = String(tx.date || '').slice(0, 7);
    const bucket = last6MonthsTrend.find((m) => m.key === key);
    if (!bucket) continue;
    const isOwner = scopeAccountId === 'all' || tx.accountId === scopeAccountId;
    if (!isOwner) continue;
    const amtConv = convertCurrencyServer(
      tx.amount,
      tx.currency || 'INR',
      preferredCurrency,
      tx.exchangeRateAtTransaction
    );
    if (tx.type === 'income') bucket.income += amtConv;
    else if (tx.type === 'expense') bucket.expense += amtConv;
  }

  for (const b of last6MonthsTrend) {
    b.income = round2(b.income);
    b.expense = round2(b.expense);
    b.netSavings = round2(b.income - b.expense);
  }

  const trailing3 = last6MonthsTrend.slice(-3);
  const activeMonths3 = trailing3.filter((m) => m.income > 0 || m.expense > 0);
  const denom3 = Math.max(1, activeMonths3.length);
  const trailing3MonthsAvg = {
    income: round2(activeMonths3.reduce((s, m) => s + m.income, 0) / denom3),
    expense: round2(activeMonths3.reduce((s, m) => s + m.expense, 0) / denom3),
    netSavings: round2(activeMonths3.reduce((s, m) => s + m.netSavings, 0) / denom3),
  };

  // Unusual Expense Detection (strictly grounded in real transactions)
  const expenseTxs = scopedTxs.filter(
    (tx) => tx.type === 'expense' && (scopeAccountId === 'all' || tx.accountId === scopeAccountId)
  );
  const catStats = new Map<string, { sum: number; count: number }>();
  for (const tx of expenseTxs) {
    const cat = (tx.category || 'General').trim() || 'General';
    const amt = convertCurrencyServer(
      tx.amount,
      tx.currency || 'INR',
      preferredCurrency,
      tx.exchangeRateAtTransaction
    );
    const entry = catStats.get(cat) || { sum: 0, count: 0 };
    entry.sum += amt;
    entry.count += 1;
    catStats.set(cat, entry);
  }

  const unusualExpenses: UnusualExpenseItem[] = [];
  const curMonthExpenses = expenseTxs.filter((tx) => String(tx.date || '').startsWith(currentMonth));
  for (const tx of curMonthExpenses) {
    const cat = (tx.category || 'General').trim() || 'General';
    const amt = convertCurrencyServer(
      tx.amount,
      tx.currency || 'INR',
      preferredCurrency,
      tx.exchangeRateAtTransaction
    );
    const stats = catStats.get(cat);
    const avg = stats && stats.count > 1 ? stats.sum / stats.count : 0;

    if (avg > 0 && amt >= avg * 1.9 && amt > 0) {
      unusualExpenses.push({
        transactionId: tx.id,
        date: tx.date,
        category: cat,
        description: tx.description || cat,
        amountConverted: amt,
        reason: `${round2(amt / avg)}x higher than your ${cat} transaction average (${round2(avg)} ${preferredCurrency})`,
      });
    } else if (curMonthExpenses.length >= 3 && curExpense > 0 && amt / curExpense >= 0.35) {
      unusualExpenses.push({
        transactionId: tx.id,
        date: tx.date,
        category: cat,
        description: tx.description || cat,
        amountConverted: amt,
        reason: `Single transaction accounts for ${round2((amt / curExpense) * 100)}% of this month's total expenses`,
      });
    }
  }
  unusualExpenses.sort((a, b) => b.amountConverted - a.amountConverted);

  // Recurring Expense Detection (strictly detected when >= 2 real transactions repeat)
  const recurringGroups = new Map<
    string,
    { label: string; category: string; amounts: number[]; dates: Set<string>; lastDate: string }
  >();

  for (const tx of expenseTxs) {
    const rawLabel = (tx.description || tx.category || '').trim();
    if (!rawLabel) continue;
    const normalized = rawLabel.toLowerCase().replace(/\d+/g, '').replace(/\s+/g, ' ').trim();
    if (!normalized || normalized === 'transaction' || normalized === 'expense') continue;
    const key = `${(tx.category || 'General').toLowerCase()}::${normalized}`;
    const amt = convertCurrencyServer(
      tx.amount,
      tx.currency || 'INR',
      preferredCurrency,
      tx.exchangeRateAtTransaction
    );
    const grp = recurringGroups.get(key) || {
      label: rawLabel,
      category: tx.category || 'General',
      amounts: [],
      dates: new Set<string>(),
      lastDate: tx.date,
    };
    grp.amounts.push(amt);
    grp.dates.add(tx.date);
    if (tx.date > grp.lastDate) grp.lastDate = tx.date;
    recurringGroups.set(key, grp);
  }

  const recurringExpenses: RecurringExpenseItem[] = [];
  for (const grp of recurringGroups.values()) {
    if (grp.amounts.length >= 2 && grp.dates.size >= 2) {
      const total = grp.amounts.reduce((s, v) => s + v, 0);
      const avg = total / grp.amounts.length;
      // Verify amounts are reasonably consistent (within 35% of mean) or at least repeated merchant
      const consistent = grp.amounts.every((a) => avg > 0 && Math.abs(a - avg) / avg <= 0.35);
      if (consistent) {
        recurringExpenses.push({
          label: grp.label,
          category: grp.category,
          occurrences: grp.amounts.length,
          averageAmountConverted: round2(avg),
          totalAmountConverted: round2(total),
          lastDate: grp.lastDate,
        });
      }
    }
  }
  recurringExpenses.sort((a, b) => b.totalAmountConverted - a.totalAmountConverted);

  // Budget Utilization
  const budgetUtilization: BudgetUtilizationItem[] = budgets.map((b) => {
    const spent = round2(
      curMonthExpenses
        .filter((tx) => (tx.category || '').trim().toLowerCase() === b.category.trim().toLowerCase())
        .reduce(
          (sum, tx) =>
            sum +
            convertCurrencyServer(tx.amount, tx.currency || 'INR', preferredCurrency, tx.exchangeRateAtTransaction),
          0
        )
    );
    const limitConverted = convertCurrencyServer(b.monthlyLimit, b.currency || 'INR', preferredCurrency);
    const remainingConverted = round2(Math.max(0, limitConverted - spent));
    const percentUsed = limitConverted > 0 ? Math.round((spent / limitConverted) * 100) : 0;
    const projectedMonthSpend = round2((spent / currentDayOfMonth) * totalDaysInMonth);
    const threshold = Number(b.alertThreshold || 80);
    const status: 'ok' | 'warning' | 'overbudget' =
      spent > limitConverted ? 'overbudget' : percentUsed >= threshold ? 'warning' : 'ok';

    return {
      id: b.id,
      category: b.category,
      limitConverted,
      spentConverted: spent,
      remainingConverted,
      percentUsed,
      projectedMonthSpend,
      status,
    };
  });

  // Financial Health Score (0-100)
  let healthScore = 70;
  if (curIncome > 0) {
    if (curIncome >= curExpense) {
      const sr = (curIncome - curExpense) / curIncome;
      healthScore += Math.round(sr * 25);
    } else {
      const deficitRatio = Math.min(1, (curExpense - curIncome) / curIncome);
      healthScore -= Math.round(15 + deficitRatio * 20);
    }
  } else if (curExpense > 0 && totalBalance <= curExpense) {
    healthScore -= 15;
  }

  if (runwayDays >= 90) healthScore += 10;
  else if (runwayDays < 30 && dailyBurnRate > 0) healthScore -= 15;

  if (curExpense > 0 && discretionaryTotal > curExpense * 0.5) healthScore -= 10;
  if (budgetUtilization.some((b) => b.status === 'overbudget')) healthScore -= 8;
  healthScore = Math.max(15, Math.min(99, Math.round(healthScore)));

  const healthRating: 'Excellent' | 'Good' | 'Needs Attention' | 'Critical' =
    healthScore >= 80 ? 'Excellent' : healthScore >= 65 ? 'Good' : healthScore >= 45 ? 'Needs Attention' : 'Critical';

  // Risk Warnings
  const riskWarnings: RiskWarningItem[] = [];
  if (curExpense > curIncome && curIncome > 0) {
    riskWarnings.push({
      code: 'DEFICIT_CASHFLOW',
      title: 'Monthly Deficit Cash Flow',
      severity: 'high',
      detail: `This month's expenses (${curExpense} ${preferredCurrency}) exceed income (${curIncome} ${preferredCurrency}) by ${round2(curExpense - curIncome)} ${preferredCurrency}.`,
    });
  }
  if (dailyBurnRate > 0 && runwayDays < 30) {
    riskWarnings.push({
      code: 'LOW_RUNWAY',
      title: 'Low Liquidity Runway',
      severity: 'high',
      detail: `At your current daily burn rate (${dailyBurnRate} ${preferredCurrency}/day), available balance covers roughly ${runwayDays} days.`,
    });
  }
  for (const b of budgetUtilization) {
    if (b.status === 'overbudget') {
      riskWarnings.push({
        code: 'OVER_BUDGET',
        title: `Over Budget: ${b.category}`,
        severity: 'high',
        detail: `Spent ${b.spentConverted} ${preferredCurrency} vs limit of ${b.limitConverted} ${preferredCurrency} (${b.percentUsed}%).`,
      });
    } else if (b.status === 'warning') {
      riskWarnings.push({
        code: 'NEAR_BUDGET_LIMIT',
        title: `Approaching Limit: ${b.category}`,
        severity: 'medium',
        detail: `${b.percentUsed}% of ${b.category} monthly budget used (${b.spentConverted} / ${b.limitConverted} ${preferredCurrency}).`,
      });
    }
  }
  if (curExpense > 0 && discretionaryTotal > curExpense * 0.4) {
    riskWarnings.push({
      code: 'HIGH_DISCRETIONARY',
      title: 'High Discretionary Spend Ratio',
      severity: 'medium',
      detail: `Discretionary categories make up ${Math.round((discretionaryTotal / curExpense) * 100)}% (${discretionaryTotal} ${preferredCurrency}) of monthly spending.`,
    });
  }
  if (topCategories[0] && topCategories[0].percentageOfExpenses >= 55 && allCategoriesThisMonth.length >= 2) {
    riskWarnings.push({
      code: 'CATEGORY_CONCENTRATION',
      title: `High Spend Concentration in ${topCategories[0].category}`,
      severity: 'low',
      detail: `${topCategories[0].category} represents ${topCategories[0].percentageOfExpenses}% of this month's total outflow.`,
    });
  }

  // Realistic Available Savings Capacity (Budget AI must never recommend impossible savings)
  const monthlySurplus = Math.max(0, curIncome - curExpense);
  const potentialTrimCap = round2(discretionaryTotal * 0.3 + Math.max(0, curExpense - discretionaryTotal) * 0.1);
  const incomeBoundedCap =
    curIncome > 0
      ? round2(Math.min(curIncome, monthlySurplus + Math.min(curExpense, potentialTrimCap)))
      : round2(Math.max(0, Math.min(totalBalance * 0.25, potentialTrimCap)));
  const availableSavingsCapacity = round2(Math.max(monthlySurplus, incomeBoundedCap));

  const recentTransactionsSnippet = scopedTxs.slice(0, 25).map((tx) => ({
    id: tx.id,
    date: tx.date,
    type: tx.type,
    category: tx.category || (tx.type === 'transfer' ? 'Transfer' : 'General'),
    description: tx.description || tx.category || '',
    amountConverted: convertCurrencyServer(
      tx.amount,
      tx.currency || 'INR',
      preferredCurrency,
      tx.exchangeRateAtTransaction
    ),
    accountName: accountNameById.get(tx.accountId) || 'Account',
  }));

  // Material Ledger Fingerprint for smart Daily AI Insights caching
  const hashPayload = JSON.stringify({
    preferredCurrency,
    currentMonth,
    scopeAccountId,
    accounts: allAccounts.map((a) => [a.id, a.name, a.currency, a.archived, computeDeterministicNativeAccountBalance(a, allTxs)]),
    txs: scopedTxs.map((t) => [t.id, t.type, t.amount, t.currency, t.category, t.date, t.accountId, t.toAccountId]),
    budgets: budgets.map((b) => [b.id, b.category, b.monthlyLimit, b.currency]),
  });
  const materialLedgerHash = crypto.createHash('sha256').update(hashPayload).digest('hex').slice(0, 32);

  return {
    preferredCurrency,
    timezone,
    scopeAccountId,
    scopeLabel,
    currentMonth,
    lastMonth,
    currentDayOfMonth,
    totalDaysInMonth,
    totalBalance,
    activeAccountsCount: activeAccounts.length,
    totalTransactionsCount: scopedTxs.length,
    thisMonth: {
      income: curIncome,
      expense: curExpense,
      netSavings,
      savingsRate,
      transferIn: round2(curTransferIn),
      transferOut: round2(curTransferOut),
      transferInternal: round2(curTransferInternal),
      transactionCount: curTxCount,
      dailyBurnRate,
      projectedMonthExpense,
      runwayDays,
    },
    lastMonthSummary: {
      income: prevIncome,
      expense: prevExpense,
      netSavings: lastNetSavings,
      savingsRate: lastSavingsRate,
    },
    trailing3MonthsAvg,
    healthScore,
    healthRating,
    topCategories,
    allCategoriesThisMonth,
    lastMonthCategories,
    accountPositions,
    last6MonthsTrend,
    unusualExpenses: unusualExpenses.slice(0, 5),
    recurringExpenses: recurringExpenses.slice(0, 5),
    budgetUtilization,
    riskWarnings,
    discretionaryTotal,
    availableSavingsCapacity,
    recentTransactionsSnippet,
    materialLedgerHash,
  };
}
