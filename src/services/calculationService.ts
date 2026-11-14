/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Account, CurrencyCode, Transaction, TransactionType } from '../types/finance';
import { convertCurrency, getCachedRates } from './currencyService';

export interface DateFilterOptions {
  month?: number; // 1 to 12, or undefined for all months
  year?: number;  // e.g. 2026, or undefined for all years
}

export class CalculationService {
  /**
   * Sorts accounts deterministically by user-assigned sortOrder (ascending),
   * falling back to original order / createdAt when sortOrder is unset.
   */
  static sortAccountsByOrder(accounts: Account[]): Account[] {
    return accounts
      .map((acc, index) => ({ acc, index }))
      .sort((a, b) => {
        const hasOrderA = typeof a.acc.sortOrder === 'number' && isFinite(a.acc.sortOrder);
        const hasOrderB = typeof b.acc.sortOrder === 'number' && isFinite(b.acc.sortOrder);
        if (hasOrderA && hasOrderB) {
          if (a.acc.sortOrder! !== b.acc.sortOrder!) {
            return a.acc.sortOrder! - b.acc.sortOrder!;
          }
          return a.index - b.index;
        }
        if (hasOrderA) return -1;
        if (hasOrderB) return 1;
        return a.index - b.index;
      })
      .map((entry) => entry.acc);
  }

  /**
   * Sorts transactions strictly Newest First.
   * Primary: transaction.date (YYYY-MM-DD descending)
   * Secondary: transaction.createdAt timestamp (descending)
   * Tertiary: transaction.id (stable string compare)
   */
  static sortTransactionsNewestFirst(transactions: Transaction[]): Transaction[] {
    return [...transactions].sort((a, b) => {
      // 1. Transaction Date
      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      if (timeB !== timeA) {
        return timeB - timeA;
      }

      // 2. Created Timestamp
      const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (createdB !== createdA) {
        return createdB - createdA;
      }

      // 3. Stable tie-breaker by ID
      return b.id.localeCompare(a.id);
    });
  }

  /**
   * Calculates the exact, deterministic balance of an account from its opening position
   * and all associated transactions:
   * Current Balance = Opening Position + Adjustments + Income - Expenses + Transfers In - Transfers Out
   */
  static calculateAccountBalance(
    account: Account,
    allTransactions: Transaction[],
    ratesRecord?: Record<CurrencyCode, number>
  ): number {
    const rates = ratesRecord || getCachedRates().rates;
    let balance = Number(account.openingPosition || 0) + Number(account.adjustments || 0);

    for (const tx of allTransactions) {
      if (tx.isDeleted) continue;

      const amtInAccCurrency = convertCurrency(
        tx.amount,
        tx.currency,
        account.currency,
        rates,
        tx.exchangeRateAtTransaction
      );

      if (tx.type === 'income' && tx.accountId === account.id) {
        balance += amtInAccCurrency;
      } else if (tx.type === 'expense' && tx.accountId === account.id) {
        balance -= amtInAccCurrency;
      } else if (tx.type === 'transfer') {
        if (tx.accountId === account.id) {
          // Sent from this account
          balance -= amtInAccCurrency;
        } else if (tx.toAccountId === account.id) {
          // Received into this account
          balance += amtInAccCurrency;
        }
      }
    }

    // Round to 2 decimal places to prevent JavaScript IEEE-754 floating point inaccuracies
    return Math.round((balance + Number.EPSILON) * 100) / 100;
  }

  /**
   * Recalculates all accounts' current balances deterministically from their transactions
   */
  static recalculateAllAccountBalances(
    accounts: Account[],
    transactions: Transaction[],
    ratesRecord?: Record<CurrencyCode, number>
  ): Account[] {
    const rates = ratesRecord || getCachedRates().rates;
    return accounts.map((acc) => {
      const newBal = this.calculateAccountBalance(acc, transactions, rates);
      return {
        ...acc,
        balance: newBal,
        updatedAt: new Date().toISOString(),
      };
    });
  }

  /**
   * Calculates the Consolidated Total Balance across all active (non-archived) accounts,
   * converting each account's current balance into the user's preferred display currency.
   * Does NOT double count transfers or add raw transactions.
   */
  static calculateConsolidatedBalance(
    accounts: Account[],
    transactions: Transaction[],
    displayCurrency: CurrencyCode,
    ratesRecord?: Record<CurrencyCode, number>
  ): number {
    const rates = ratesRecord || getCachedRates().rates;
    const activeAccounts = accounts.filter((a) => !a.archived);

    let total = 0;
    for (const acc of activeAccounts) {
      const accBal = this.calculateAccountBalance(acc, transactions, rates);
      const inDisplay = convertCurrency(accBal, acc.currency, displayCurrency, rates);
      total += inDisplay;
    }

    return Math.round((total + Number.EPSILON) * 100) / 100;
  }

  /**
   * Filters transactions by account, date (month/year), and transaction type
   */
  static filterTransactions(
    transactions: Transaction[],
    options: {
      accountId?: string | 'all';
      dateFilter?: DateFilterOptions;
      typeFilter?: TransactionType | 'all';
      timePreset?: 'week' | 'month' | 'year' | 'all';
    }
  ): Transaction[] {
    const { accountId = 'all', dateFilter, typeFilter = 'all', timePreset } = options;
    const now = new Date();

    return transactions.filter((tx) => {
      if (tx.isDeleted) return false;

      // 1. Account filter
      if (accountId !== 'all') {
        const matchesSource = tx.accountId === accountId;
        const matchesDest = tx.type === 'transfer' && tx.toAccountId === accountId;
        if (!matchesSource && !matchesDest) return false;
      }

      // 2. Type filter
      if (typeFilter !== 'all' && tx.type !== typeFilter) {
        return false;
      }

      // 3. Specific Month / Year selector filter
      if (dateFilter && (dateFilter.month !== undefined || dateFilter.year !== undefined)) {
        const [yearStr, monthStr] = tx.date.split('-');
        const txYear = parseInt(yearStr, 10);
        const txMonth = parseInt(monthStr, 10);

        if (dateFilter.year !== undefined && txYear !== dateFilter.year) {
          return false;
        }
        if (dateFilter.month !== undefined && txMonth !== dateFilter.month) {
          return false;
        }
      } else if (timePreset && timePreset !== 'all') {
        // Fallback relative time filter
        const txDate = new Date(tx.date);
        const diffMs = now.getTime() - txDate.getTime();
        const diffDays = diffMs / (1000 * 3600 * 24);

        if (timePreset === 'week' && (diffDays < 0 || diffDays > 7)) return false;
        if (timePreset === 'month' && (diffDays < 0 || diffDays > 31)) return false;
        if (timePreset === 'year' && (diffDays < 0 || diffDays > 365)) return false;
      }

      return true;
    });
  }

  /**
   * Calculates Total Income for the filtered criteria.
   * Strictly includes income; strictly excludes expense and transfers.
   */
  static calculateIncome(
    transactions: Transaction[],
    options: {
      accountId?: string | 'all';
      dateFilter?: DateFilterOptions;
      timePreset?: 'week' | 'month' | 'year' | 'all';
      displayCurrency: CurrencyCode;
      ratesRecord?: Record<CurrencyCode, number>;
    }
  ): number {
    const filtered = this.filterTransactions(transactions, {
      accountId: options.accountId,
      dateFilter: options.dateFilter,
      timePreset: options.timePreset,
      typeFilter: 'income',
    });

    const rates = options.ratesRecord || getCachedRates().rates;
    let sum = 0;
    for (const tx of filtered) {
      sum += convertCurrency(
        tx.amount,
        tx.currency,
        options.displayCurrency,
        rates,
        tx.exchangeRateAtTransaction
      );
    }
    return Math.round((sum + Number.EPSILON) * 100) / 100;
  }

  /**
   * Calculates Total Expense for the filtered criteria.
   * Strictly includes expense; strictly excludes income and transfers.
   */
  static calculateExpense(
    transactions: Transaction[],
    options: {
      accountId?: string | 'all';
      dateFilter?: DateFilterOptions;
      timePreset?: 'week' | 'month' | 'year' | 'all';
      displayCurrency: CurrencyCode;
      ratesRecord?: Record<CurrencyCode, number>;
    }
  ): number {
    const filtered = this.filterTransactions(transactions, {
      accountId: options.accountId,
      dateFilter: options.dateFilter,
      timePreset: options.timePreset,
      typeFilter: 'expense',
    });

    const rates = options.ratesRecord || getCachedRates().rates;
    let sum = 0;
    for (const tx of filtered) {
      sum += convertCurrency(
        tx.amount,
        tx.currency,
        options.displayCurrency,
        rates,
        tx.exchangeRateAtTransaction
      );
    }
    return Math.round((sum + Number.EPSILON) * 100) / 100;
  }
}
