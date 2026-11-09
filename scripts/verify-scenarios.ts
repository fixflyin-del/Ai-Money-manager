/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CalculationService } from '../src/services/calculationService';
import { StorageService } from '../src/services/storageService';
import { Account, Transaction } from '../src/types/finance';

// Mock localStorage for Node environment if needed
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, val: string) => store.set(key, val),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] || null,
    length: store.size,
  } as unknown as Storage;
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${msg}`);
    failed++;
  }
}

console.log('🧪 Starting AI Money Manager Test Scenarios A through H...\n');

// ==========================================
// SCENARIO A: Single Account & Basics
// ==========================================
console.log('📌 Running Scenario A: Single Account Calculations...');
const acc1: Account = {
  id: 'acc_1',
  name: 'Primary Checking',
  type: 'bank',
  currency: 'INR',
  balance: 10000,
  openingPosition: 10000,
  adjustments: 0,
  netTransfers: 0,
  color: '#3B82F6',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const tx1_income: Transaction = {
  id: 'tx_1',
  type: 'income',
  amount: 5000,
  currency: 'INR',
  accountId: 'acc_1',
  category: 'Salary',
  date: '2026-01-05',
  description: 'Salary',
  paymentMode: 'UPI',
  tags: [],
  createdAt: '2026-01-05T10:00:00Z',
};

const tx2_expense: Transaction = {
  id: 'tx_2',
  type: 'expense',
  amount: 2000,
  currency: 'INR',
  accountId: 'acc_1',
  category: 'Groceries',
  date: '2026-01-10',
  description: 'Groceries',
  paymentMode: 'UPI',
  tags: [],
  createdAt: '2026-01-10T10:00:00Z',
};

let txList = [tx1_income, tx2_expense];
let acc1Bal = CalculationService.calculateAccountBalance(acc1, txList);
let totalIncA = CalculationService.calculateIncome(txList, { displayCurrency: 'INR' });
let totalExpA = CalculationService.calculateExpense(txList, { displayCurrency: 'INR' });

assert(acc1Bal === 13000, `Account 1 Balance is ₹13,000 (Got ${acc1Bal})`);
assert(totalIncA === 5000, `Total Income is ₹5,000 (Got ${totalIncA})`);
assert(totalExpA === 2000, `Total Expense is ₹2,000 (Got ${totalExpA})`);

// ==========================================
// SCENARIO B: Second Account & Consolidated
// ==========================================
console.log('\n📌 Running Scenario B: Second Account & Consolidated Total Balance...');
const acc2: Account = {
  id: 'acc_2',
  name: 'Savings Vault',
  type: 'savings',
  currency: 'INR',
  balance: 20000,
  openingPosition: 20000,
  adjustments: 0,
  netTransfers: 0,
  color: '#10B981',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const tx3_income2: Transaction = {
  id: 'tx_3',
  type: 'income',
  amount: 3000,
  currency: 'INR',
  accountId: 'acc_2',
  category: 'Interest',
  date: '2026-01-12',
  description: 'Interest',
  paymentMode: 'Net Banking',
  tags: [],
  createdAt: '2026-01-12T10:00:00Z',
};

const tx4_expense2: Transaction = {
  id: 'tx_4',
  type: 'expense',
  amount: 1000,
  currency: 'INR',
  accountId: 'acc_2',
  category: 'Shopping',
  date: '2026-01-15',
  description: 'Shopping',
  paymentMode: 'UPI',
  tags: [],
  createdAt: '2026-01-15T10:00:00Z',
};

txList = [tx1_income, tx2_expense, tx3_income2, tx4_expense2];
let acc2Bal = CalculationService.calculateAccountBalance(acc2, txList);
let consolidatedB = CalculationService.calculateConsolidatedBalance([acc1, acc2], txList, 'INR');

assert(acc2Bal === 22000, `Account 2 Balance is ₹22,000 (Got ${acc2Bal})`);
assert(consolidatedB === 35000, `Consolidated Balance is ₹35,000 (Got ${consolidatedB})`);

// ==========================================
// SCENARIO C: Inter-Account Transfer
// ==========================================
console.log('\n📌 Running Scenario C: Transfer Between Accounts...');
const tx5_transfer: Transaction = {
  id: 'tx_5',
  type: 'transfer',
  amount: 2000,
  currency: 'INR',
  accountId: 'acc_1',
  toAccountId: 'acc_2',
  category: 'Transfer',
  date: '2026-01-18',
  description: 'Move to Savings',
  paymentMode: 'Net Banking',
  tags: [],
  createdAt: '2026-01-18T10:00:00Z',
};

txList = [tx1_income, tx2_expense, tx3_income2, tx4_expense2, tx5_transfer];
acc1Bal = CalculationService.calculateAccountBalance(acc1, txList);
acc2Bal = CalculationService.calculateAccountBalance(acc2, txList);
let consolidatedC = CalculationService.calculateConsolidatedBalance([acc1, acc2], txList, 'INR');
let totalIncC = CalculationService.calculateIncome(txList, { displayCurrency: 'INR' });
let totalExpC = CalculationService.calculateExpense(txList, { displayCurrency: 'INR' });

assert(acc1Bal === 11000, `Account 1 Balance reduced to ₹11,000 (Got ${acc1Bal})`);
assert(acc2Bal === 24000, `Account 2 Balance increased to ₹24,000 (Got ${acc2Bal})`);
assert(consolidatedC === 35000, `Consolidated Balance unchanged at ₹35,000 (Got ${consolidatedC})`);
assert(totalIncC === 8000, `Total Income strictly unchanged at ₹8,000 (Got ${totalIncC})`);
assert(totalExpC === 3000, `Total Expense strictly unchanged at ₹3,000 (Got ${totalExpC})`);

// ==========================================
// SCENARIO D: Edit Transaction
// ==========================================
console.log('\n📌 Running Scenario D: Edit Transaction from ₹2,000 to ₹3,000...');
const tx2_edited: Transaction = {
  ...tx2_expense,
  amount: 3000,
};

txList = [tx1_income, tx2_edited, tx3_income2, tx4_expense2, tx5_transfer];
acc1Bal = CalculationService.calculateAccountBalance(acc1, txList);
acc2Bal = CalculationService.calculateAccountBalance(acc2, txList);
let consolidatedD = CalculationService.calculateConsolidatedBalance([acc1, acc2], txList, 'INR');
let totalExpD = CalculationService.calculateExpense(txList, { displayCurrency: 'INR' });

assert(acc1Bal === 10000, `Account 1 Balance after edit is ₹10,000 (Got ${acc1Bal})`);
assert(acc2Bal === 24000, `Account 2 Balance remains ₹24,000 (Got ${acc2Bal})`);
assert(consolidatedD === 34000, `Consolidated Balance adjusted to ₹34,000 (Got ${consolidatedD})`);
assert(totalExpD === 4000, `Total Expense is now ₹4,000 (Got ${totalExpD})`);

// ==========================================
// SCENARIO E: Delete Transaction
// ==========================================
console.log('\n📌 Running Scenario E: Delete Edited Transaction...');
txList = txList.filter(t => t.id !== 'tx_2');
acc1Bal = CalculationService.calculateAccountBalance(acc1, txList);
acc2Bal = CalculationService.calculateAccountBalance(acc2, txList);
let consolidatedE = CalculationService.calculateConsolidatedBalance([acc1, acc2], txList, 'INR');
let totalExpE = CalculationService.calculateExpense(txList, { displayCurrency: 'INR' });

assert(acc1Bal === 13000, `Account 1 Balance restored to ₹13,000 (Got ${acc1Bal})`);
assert(acc2Bal === 24000, `Account 2 Balance remains ₹24,000 (Got ${acc2Bal})`);
assert(consolidatedE === 37000, `Consolidated Balance restored to ₹37,000 (Got ${consolidatedE})`);
assert(totalExpE === 1000, `Total Expense reduced to ₹1,000 (Got ${totalExpE})`);

// ==========================================
// SCENARIO F: Account-Wise Transaction Filter
// ==========================================
console.log('\n📌 Running Scenario F: Account Filtering Verification...');
const acc1Txs = CalculationService.filterTransactions(txList, { accountId: 'acc_1' });
const acc2Txs = CalculationService.filterTransactions(txList, { accountId: 'acc_2' });
const allTxs = CalculationService.filterTransactions(txList, { accountId: 'all' });

const acc1Inc = CalculationService.calculateIncome(txList, { accountId: 'acc_1', displayCurrency: 'INR' });
const acc1Exp = CalculationService.calculateExpense(txList, { accountId: 'acc_1', displayCurrency: 'INR' });

const acc2Inc = CalculationService.calculateIncome(txList, { accountId: 'acc_2', displayCurrency: 'INR' });
const acc2Exp = CalculationService.calculateExpense(txList, { accountId: 'acc_2', displayCurrency: 'INR' });

assert(acc1Txs.length === 2, `Account 1 has 2 transactions (Income ₹5k & Transfer Out ₹2k) (Got ${acc1Txs.length})`);
assert(acc1Inc === 5000, `Account 1 Filtered Income = ₹5,000 (Got ${acc1Inc})`);
assert(acc1Exp === 0, `Account 1 Filtered Expense = ₹0 (Got ${acc1Exp})`);

assert(acc2Txs.length === 3, `Account 2 has 3 transactions (Income ₹3k, Expense ₹1k, Transfer In ₹2k) (Got ${acc2Txs.length})`);
assert(acc2Inc === 3000, `Account 2 Filtered Income = ₹3,000 (Got ${acc2Inc})`);
assert(acc2Exp === 1000, `Account 2 Filtered Expense = ₹1,000 (Got ${acc2Exp})`);
assert(allTxs.length === 4, `All Accounts Filtered Count = 4 (Got ${allTxs.length})`);

// ==========================================
// SCENARIO G: Date Selector Filtering (Month & Year)
// ==========================================
console.log('\n📌 Running Scenario G: Date Selector Filtering (Month/Year)...');
const txJan: Transaction = {
  id: 'tx_jan',
  type: 'expense',
  amount: 500,
  currency: 'INR',
  accountId: 'acc_1',
  category: 'Food',
  description: 'Food expense',
  paymentMode: 'Cash',
  tags: [],
  date: '2026-01-15',
  createdAt: '2026-01-15T00:00:00Z'
};
const txFeb: Transaction = {
  id: 'tx_feb',
  type: 'expense',
  amount: 800,
  currency: 'INR',
  accountId: 'acc_1',
  category: 'Transport',
  description: 'Transport expense',
  paymentMode: 'UPI',
  tags: [],
  date: '2026-02-10',
  createdAt: '2026-02-10T00:00:00Z'
};
const txNov: Transaction = {
  id: 'tx_nov',
  type: 'expense',
  amount: 1200,
  currency: 'INR',
  accountId: 'acc_1',
  category: 'Bills',
  description: 'Bills expense',
  paymentMode: 'Net Banking',
  tags: [],
  date: '2026-11-05',
  createdAt: '2026-11-05T00:00:00Z'
};

const dateTestTxs = [txJan, txFeb, txNov];

const janFilter = CalculationService.filterTransactions(dateTestTxs, {
  dateFilter: { year: 2026, month: 1 }
});
const febFilter = CalculationService.filterTransactions(dateTestTxs, {
  dateFilter: { year: 2026, month: 2 }
});
const novFilter = CalculationService.filterTransactions(dateTestTxs, {
  dateFilter: { year: 2026, month: 11 }
});
const yearFilter = CalculationService.filterTransactions(dateTestTxs, {
  dateFilter: { year: 2026, month: undefined }
});

assert(janFilter.length === 1 && janFilter[0].id === 'tx_jan', `Jan 2026 filter returns only Jan transaction`);
assert(febFilter.length === 1 && febFilter[0].id === 'tx_feb', `Feb 2026 filter returns only Feb transaction`);
assert(novFilter.length === 1 && novFilter[0].id === 'tx_nov', `Nov 2026 filter returns only Nov transaction`);
assert(yearFilter.length === 3, `All-Months 2026 filter returns all 3 transactions`);

// Test Newest First Sorting
const sorted = CalculationService.sortTransactionsNewestFirst(dateTestTxs);
assert(sorted[0].id === 'tx_nov', `Strict newest-first puts Nov 2026 first (Got ${sorted[0].id})`);
assert(sorted[1].id === 'tx_feb', `Strict newest-first puts Feb 2026 second (Got ${sorted[1].id})`);
assert(sorted[2].id === 'tx_jan', `Strict newest-first puts Jan 2026 third (Got ${sorted[2].id})`);

// ==========================================
// SCENARIO H: User Data Isolation
// ==========================================
console.log('\n📌 Running Scenario H: User Data Isolation...');
// Switch to User A
StorageService.setActiveUser('user_a_123');
StorageService.saveAccounts([acc1, acc2]);
StorageService.saveTransactions(txList);

assert(StorageService.getAccounts().length === 2, `User A has 2 stored accounts`);
assert(StorageService.getTransactions().length === 4, `User A has 4 stored transactions`);

// Switch to brand-new User B
StorageService.setActiveUser('user_b_brand_new_999');
assert(StorageService.getAccounts().length === 0, `User B starts with 0 accounts (empty state guaranteed)`);
assert(StorageService.getTransactions().length === 0, `User B starts with 0 transactions (empty state guaranteed)`);

// User B creates their own account
const userBAcc: Account = {
  id: 'acc_b1',
  name: 'User B Cash',
  type: 'cash',
  currency: 'USD',
  balance: 50,
  openingPosition: 50,
  adjustments: 0,
  netTransfers: 0,
  color: '#EF4444',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z'
};
StorageService.saveAccounts([userBAcc]);
assert(StorageService.getAccounts().length === 1, `User B has exactly 1 account`);

// Switch back to User A
StorageService.setActiveUser('user_a_123');
const restoredAAccounts = StorageService.getAccounts();
const restoredATransactions = StorageService.getTransactions();

assert(restoredAAccounts.length === 2, `User A restores 2 accounts without leakage`);
assert(restoredATransactions.length === 4, `User A restores 4 transactions without leakage`);
assert(restoredAAccounts[0].id === 'acc_1', `User A accounts are strictly their own`);

console.log('\n==========================================');
console.log(`🎉 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('==========================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
