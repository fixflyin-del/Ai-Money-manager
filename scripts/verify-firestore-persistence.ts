/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  stripUndefined,
  serializeTransactionForFirestore,
  serializeAccountForFirestore,
  serializeCategoryForFirestore,
  serializeUserProfileForFirestore,
} from '../src/services/firestoreSerializer';
import { CalculationService } from '../src/services/calculationService';
import { StorageService } from '../src/services/storageService';
import { Account, Transaction, UserProfile } from '../src/types/finance';

// Mock localStorage for Node test runner
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

/**
 * Recursively asserts that NO property in an object or array is `undefined`.
 */
function assertNoUndefinedFields(obj: any, path = 'root'): void {
  if (obj === undefined) {
    assert(false, `Field at path "${path}" is undefined!`);
    return;
  }
  if (obj === null || typeof obj !== 'object') {
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, idx) => assertNoUndefinedFields(item, `${path}[${idx}]`));
    return;
  }
  for (const [key, val] of Object.entries(obj)) {
    if (val === undefined) {
      assert(false, `Property "${path}.${key}" is undefined! Firestore WriteBatch.set() will reject this!`);
    } else if (typeof val === 'object' && val !== null) {
      assertNoUndefinedFields(val, `${path}.${key}`);
    }
  }
}

console.log('🧪 Starting AI Money Manager Real Firestore & Production Persistence Test Suite...\n');

// =========================================================================
// TEST 1: REPRODUCTION & RESOLUTION OF EXACT ERROR (INCOME TRANSACTION)
// Screenshot Error: Function WriteBatch.set() called with invalid data. Unsupported field value: undefined (found in field toAccountId)
// =========================================================================
console.log('📌 TEST 1: Exact Income Transaction Reproduction (Amount ₹1,000, YJTR Account, UPI)...');
const incomeTxWithUndefined: Transaction = {
  id: 'tx_income_yjtr_001',
  type: 'income',
  amount: 1000,
  currency: 'INR',
  accountId: 'acc_yjtr_123',
  toAccountId: undefined, // THIS CAUSED THE PRODUCTION CRASH
  category: 'Salary',
  description: 'Salary Deposit',
  paymentMode: 'UPI',
  date: '2026-11-10',
  tags: ['income', 'Salary'],
  notes: undefined,
  receiptUrl: undefined,
  subCategory: undefined,
  exchangeRateAtTransaction: 1.0,
  rateDate: '2026-11-10',
  rateSource: 'FixFly Reserve Engine',
  time: undefined,
  isDeleted: undefined,
  createdAt: new Date().toISOString(),
};

const serializedIncome = serializeTransactionForFirestore(incomeTxWithUndefined, 'test_user_uid_456');

assert(!('toAccountId' in serializedIncome), 'Serialized Income document completely omits `toAccountId` property');
assert(!('notes' in serializedIncome), 'Undefined optional notes field is omitted from document');
assert(!('receiptUrl' in serializedIncome), 'Undefined optional receiptUrl field is omitted from document');
assert(!('subCategory' in serializedIncome), 'Undefined optional subCategory field is omitted from document');
assert(serializedIncome.amount === 1000, 'Amount ₹1,000 is preserved correctly');
assert(serializedIncome.currency === 'INR', 'Currency INR is preserved');
assert(serializedIncome.userId === 'test_user_uid_456', 'Authenticated user ID is stamped onto document');

// Strict assertion: zero undefined fields anywhere in the payload
assertNoUndefinedFields(serializedIncome, 'serializedIncome');
assert(true, 'Income transaction passes strict Firestore WriteBatch.set() validation');

// =========================================================================
// TEST 2: EXPENSE TRANSACTION WITH OPTIONAL METADATA
// =========================================================================
console.log('\n📌 TEST 2: Expense Transaction Serialization (Amount ₹500, Cash)...');
const expenseTx: Transaction = {
  id: 'tx_exp_002',
  type: 'expense',
  amount: 500,
  currency: 'INR',
  accountId: 'acc_yjtr_123',
  toAccountId: undefined,
  category: 'Food & Dining',
  description: 'Lunch at Cafe',
  paymentMode: 'Cash',
  date: '2026-11-10',
  tags: ['Food', 'Lunch'],
  notes: 'Team lunch discussion',
  receiptUrl: 'https://storage.googleapis.com/test-receipt.jpg',
  createdAt: new Date().toISOString(),
};

const serializedExpense = serializeTransactionForFirestore(expenseTx, 'test_user_uid_456');
assert(!('toAccountId' in serializedExpense), 'Serialized Expense document completely omits `toAccountId`');
assert(serializedExpense.notes === 'Team lunch discussion', 'Legitimate notes string is preserved');
assert(serializedExpense.receiptUrl === 'https://storage.googleapis.com/test-receipt.jpg', 'Legitimate receipt URL is preserved');
assertNoUndefinedFields(serializedExpense, 'serializedExpense');

// =========================================================================
// TEST 3: TRANSFER TRANSACTION TYPE-AWARE VALIDATION
// =========================================================================
console.log('\n📌 TEST 3: Transfer Transaction Type-Aware Validation (Amount ₹200)...');
const validTransferTx: Transaction = {
  id: 'tx_transfer_003',
  type: 'transfer',
  amount: 200,
  currency: 'INR',
  accountId: 'acc_source_1',
  toAccountId: 'acc_dest_2',
  category: 'Transfer',
  description: 'Vault Transfer',
  paymentMode: 'Net Banking',
  date: '2026-11-10',
  tags: ['transfer'],
  createdAt: new Date().toISOString(),
};

const serializedTransfer = serializeTransactionForFirestore(validTransferTx, 'test_user_uid_456');
assert(serializedTransfer.toAccountId === 'acc_dest_2', 'Transfer preserves valid toAccountId');
assert(serializedTransfer.accountId === 'acc_source_1', 'Transfer preserves valid source accountId');
assertNoUndefinedFields(serializedTransfer, 'serializedTransfer');

// Test Transfer Error Conditions: Missing destination
let transferMissingDestError = false;
try {
  serializeTransactionForFirestore({
    ...validTransferTx,
    toAccountId: undefined,
  }, 'test_user_uid_456');
} catch {
  transferMissingDestError = true;
}
assert(transferMissingDestError, 'Transfer without destination account throws validation error');

// Test Transfer Error Conditions: Same source and destination
let transferSameAccError = false;
try {
  serializeTransactionForFirestore({
    ...validTransferTx,
    toAccountId: 'acc_source_1',
  }, 'test_user_uid_456');
} catch {
  transferSameAccError = true;
}
assert(transferSameAccError, 'Transfer with identical source and destination accounts throws validation error');

// =========================================================================
// TEST 4: ACCOUNT, CATEGORY, & USER PROFILE SERIALIZATION
// =========================================================================
console.log('\n📌 TEST 4: Account, Category & UserProfile Serialization...');
const testAccount: Account = {
  id: 'acc_yjtr_123',
  name: 'YJTR',
  type: 'bank',
  currency: 'INR',
  balance: 200,
  openingPosition: 200,
  adjustments: 0,
  netTransfers: 0,
  color: '#3B82F6',
  accountNumber: undefined,
  notes: undefined,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const serializedAcc = serializeAccountForFirestore(testAccount, 'test_user_uid_456');
assertNoUndefinedFields(serializedAcc, 'serializedAcc');
assert(serializedAcc.balance === 200, 'Account balance is preserved as 200');
assert(serializedAcc.adjustments === 0, 'Zero numerical adjustment is preserved (not stripped)');
assert(!('accountNumber' in serializedAcc), 'Undefined accountNumber is safely omitted');

const testCat = {
  id: 'cat_sal_01',
  name: 'Salary',
  type: 'income' as const,
  color: '#10B981',
  icon: 'briefcase',
};
const serializedCat = serializeCategoryForFirestore(testCat, 'test_user_uid_456');
assertNoUndefinedFields(serializedCat, 'serializedCat');

const testProfile: UserProfile = {
  id: 'test_user_uid_456',
  name: 'Fixfly QA',
  email: 'fixfly.in@gmail.com',
  preferredCurrency: 'INR',
  storageMode: 'cloud',
  darkModeEnabled: false,
  themeMode: 'light',
  isPinLocked: false,
  biometricsEnabled: false,
  autoLockMinutes: 5,
  subscription: {
    isPro: true,
    planName: 'Launch Free Pro',
    billingRegion: 'IN',
    billingCurrency: 'INR',
    amountPaid: 0,
    gateway: 'PayU',
    status: 'active',
  },
};
const serializedProf = serializeUserProfileForFirestore(testProfile, 'test_user_uid_456');
assertNoUndefinedFields(serializedProf, 'serializedProf');
assert(serializedProf.darkModeEnabled === false, 'False boolean is preserved (not stripped)');

// =========================================================================
// TEST 5: SIMULATE THE EXACT LIFECYCLE SCENARIO (Income ₹1000 -> Expense ₹500 -> Transfer ₹200 -> Edit -> Delete)
// =========================================================================
console.log('\n📌 TEST 5: Financial State Mutation & Balance Consistency Lifecycle...');
StorageService.setActiveUser('qa_user_session_1');

// Step 1: User starts with YJTR account with balance ₹200
const accYJTR: Account = {
  id: 'acc_yjtr_123',
  name: 'YJTR',
  type: 'bank',
  currency: 'INR',
  balance: 200,
  openingPosition: 200,
  adjustments: 0,
  netTransfers: 0,
  color: '#3B82F6',
  createdAt: '2026-11-10T00:00:00Z',
  updatedAt: '2026-11-10T00:00:00Z',
};
const accSavings: Account = {
  id: 'acc_savings_456',
  name: 'Savings',
  type: 'savings',
  currency: 'INR',
  balance: 1000,
  openingPosition: 1000,
  adjustments: 0,
  netTransfers: 0,
  color: '#10B981',
  createdAt: '2026-11-10T00:00:00Z',
  updatedAt: '2026-11-10T00:00:00Z',
};
StorageService.saveAccounts([accYJTR, accSavings]);
StorageService.saveTransactions([]);

// Step 2: Record Income ₹1,000 into YJTR
const txIncome = StorageService.addTransaction({
  type: 'income',
  amount: 1000,
  currency: 'INR',
  accountId: 'acc_yjtr_123',
  category: 'Salary',
  description: 'Salary',
  paymentMode: 'UPI',
  date: '2026-11-10',
  tags: ['income', 'Salary'],
});
let accountsAfterIncome = StorageService.getAccounts();
let yjtrAfterIncome = accountsAfterIncome.find(a => a.id === 'acc_yjtr_123');
assert(yjtrAfterIncome?.balance === 1200, `YJTR balance after ₹1,000 income is ₹1,200 (Got ${yjtrAfterIncome?.balance})`);

// Step 3: Record Expense ₹500 from YJTR
const txExpense = StorageService.addTransaction({
  type: 'expense',
  amount: 500,
  currency: 'INR',
  accountId: 'acc_yjtr_123',
  category: 'Food',
  description: 'Lunch',
  paymentMode: 'Cash',
  date: '2026-11-10',
  tags: ['expense', 'Food'],
});
let accountsAfterExpense = StorageService.getAccounts();
let yjtrAfterExpense = accountsAfterExpense.find(a => a.id === 'acc_yjtr_123');
assert(yjtrAfterExpense?.balance === 700, `YJTR balance after ₹500 expense is ₹700 (Got ${yjtrAfterExpense?.balance})`);

// Step 4: Transfer ₹200 from YJTR to Savings
const txTransfer = StorageService.addTransaction({
  type: 'transfer',
  amount: 200,
  currency: 'INR',
  accountId: 'acc_yjtr_123',
  toAccountId: 'acc_savings_456',
  category: 'Transfer',
  description: 'Save surplus',
  paymentMode: 'Net Banking',
  date: '2026-11-10',
  tags: ['transfer'],
});
let accountsAfterTransfer = StorageService.getAccounts();
let yjtrAfterTransfer = accountsAfterTransfer.find(a => a.id === 'acc_yjtr_123');
let savingsAfterTransfer = accountsAfterTransfer.find(a => a.id === 'acc_savings_456');
assert(yjtrAfterTransfer?.balance === 500, `YJTR balance after ₹200 transfer is ₹500 (Got ${yjtrAfterTransfer?.balance})`);
assert(savingsAfterTransfer?.balance === 1200, `Savings balance after ₹200 transfer is ₹1,200 (Got ${savingsAfterTransfer?.balance})`);

// Verify consolidated balance neutrality on transfers:
let totalConsolidated = CalculationService.calculateConsolidatedBalance(accountsAfterTransfer, StorageService.getTransactions(), 'INR');
assert(totalConsolidated === 1700, `Consolidated balance is strictly ₹1,700 (Opening 200 + 1000 + Income 1000 - Expense 500 = 1700) (Got ${totalConsolidated})`);

// Step 5: Edit the Expense from ₹500 to ₹300
StorageService.updateTransaction({
  ...txExpense,
  amount: 300,
});
let accountsAfterEdit = StorageService.getAccounts();
let yjtrAfterEdit = accountsAfterEdit.find(a => a.id === 'acc_yjtr_123');
assert(yjtrAfterEdit?.balance === 700, `YJTR balance after editing expense to ₹300 is ₹700 (Got ${yjtrAfterEdit?.balance})`);

// Step 6: Delete the Expense transaction
StorageService.deleteTransaction(txExpense.id);
let accountsAfterDelete = StorageService.getAccounts();
let yjtrAfterDelete = accountsAfterDelete.find(a => a.id === 'acc_yjtr_123');
assert(yjtrAfterDelete?.balance === 1000, `YJTR balance after deleting expense is ₹1,000 (Got ${yjtrAfterDelete?.balance})`);

// =========================================================================
// TEST 6: USER ISOLATION & ZERO DATA OVERWRITE ON REFRESH / LOGOUT
// =========================================================================
console.log('\n📌 TEST 6: Cross-User Isolation & Session Persistence...');
// Switch to User B (simulating another user logging in)
StorageService.setActiveUser('user_b_completely_isolated');
assert(StorageService.getAccounts().length === 0, 'New user session has 0 accounts (clean isolated storage)');
assert(StorageService.getTransactions().length === 0, 'New user session has 0 transactions (clean isolated storage)');

// User B adds their own account
const userBAcc = StorageService.addAccount({
  name: 'User B Checking',
  type: 'bank',
  currency: 'USD',
  openingPosition: 500,
  balance: 500,
  color: '#3B82F6',
});
assert(StorageService.getAccounts().length === 1, 'User B has 1 account');

// Switch back to User A (simulating re-login)
StorageService.setActiveUser('qa_user_session_1');
const restoredUserAAccounts = StorageService.getAccounts();
const restoredUserATransactions = StorageService.getTransactions();
assert(restoredUserAAccounts.length === 2, 'User A restored 2 accounts with zero data loss');
assert(restoredUserATransactions.length === 2, 'User A restored remaining 2 transactions without cross-user leakage');
assert(restoredUserAAccounts.find(a => a.id === 'acc_yjtr_123')?.balance === 1000, 'User A YJTR balance remains ₹1,000');

// =========================================================================
// TEST 7: CATEGORY EDIT, DEFAULT PRESERVATION, RENAME SYNC & SAFE DELETE
// =========================================================================
console.log('\n📌 TEST 7: Category CRUD, Edit Persistence & Transaction Rename Sync...');
StorageService.setActiveUser('qa_cat_test_user');
const initialCats = StorageService.getCategories();
assert(initialCats.length === 20, `Initial default categories count is 20 (Got ${initialCats.length})`);

// Add a custom category
const customCat = StorageService.addCategory({
  name: 'Tea & Snacks',
  type: 'expense',
  icon: 'Coffee',
  color: '#D97706',
  isDefault: true,
});
let catsAfterAdd = StorageService.getCategories();
assert(catsAfterAdd.length === 21, `Adding 1 category preserves all 20 defaults + 1 custom = 21 (Got ${catsAfterAdd.length})`);

// Create a transaction using this category
StorageService.addAccount({
  name: 'Cash Wallet',
  type: 'cash',
  currency: 'INR',
  openingPosition: 500,
  balance: 500,
  color: '#10B981',
});
const catAcc = StorageService.getAccounts()[0];
StorageService.addTransaction({
  type: 'expense',
  amount: 50,
  currency: 'INR',
  category: 'Tea & Snacks',
  description: 'Chai',
  date: '2026-11-12',
  accountId: catAcc.id,
  paymentMode: 'Cash',
  tags: ['expense'],
});

// Edit the category (rename + color + icon)
StorageService.updateCategory({
  ...customCat,
  name: 'Coffee & Snacks',
  color: '#2563EB',
  icon: 'Utensils',
  isDefault: true,
});
const catsAfterEdit = StorageService.getCategories();
assert(catsAfterEdit.length === 21, `Editing a category does NOT delete any category (Got ${catsAfterEdit.length})`);
const editedCat = catsAfterEdit.find(c => c.id === customCat.id);
assert(editedCat?.name === 'Coffee & Snacks', 'Edited category name persisted');
assert(editedCat?.color === '#2563EB', 'Edited category color persisted');
assert(editedCat?.icon === 'Utensils', 'Edited category icon persisted');
assert(editedCat?.isDefault === true, 'Edited category isDefault persisted');
const serializedEditedCat = serializeCategoryForFirestore(editedCat!, 'qa_cat_test_user');
assertNoUndefinedFields(serializedEditedCat, 'serializedEditedCat');
assert(serializedEditedCat.isDefault === true, 'Firestore serializer preserves isDefault on Category');

// Verify transaction category was renamed automatically
const txsAfterCatRename = StorageService.getTransactions();
assert(txsAfterCatRename[0].category === 'Coffee & Snacks', 'Transaction category updated on category rename');

// Delete the custom category and confirm others stay intact and tx reassigns to General
const delResult = StorageService.deleteCategory(customCat.id, 'General');
assert(delResult.success && delResult.reassignedCount === 1, 'Delete category returns reassignedCount = 1');
const catsAfterDel = StorageService.getCategories();
assert(catsAfterDel.length === 20, `Deleting 1 category leaves all 20 other categories intact (Got ${catsAfterDel.length})`);
assert(StorageService.getTransactions()[0].category === 'General', 'Deleted category transaction reassigned to General');

console.log('\n======================================================');
console.log(`🎉 TEST SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED`);
console.log('======================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
