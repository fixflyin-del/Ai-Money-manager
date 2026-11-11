/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Account, Transaction, UserProfile } from '../types/finance';
import { CategoryItem } from './storageService';

/**
 * Recursively removes any object keys whose value is strictly `undefined`.
 * Preserves `null`, `false`, `0`, `""`, arrays, and nested objects.
 */
export function stripUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => stripUndefined(item)) as unknown as T;
  }

  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj as Record<string, any>)) {
    if (value !== undefined) {
      cleaned[key] = typeof value === 'object' && value !== null ? stripUndefined(value) : value;
    }
  }

  return cleaned as T;
}

/**
 * Validates and serializes a Transaction into a Firestore-safe plain JavaScript object.
 * Strictly enforces type-aware rules for income, expense, and transfer.
 */
export function serializeTransactionForFirestore(
  tx: Transaction,
  uid: string
): Record<string, any> {
  if (!uid || typeof uid !== 'string' || uid.trim() === '') {
    throw new Error('Firestore Serialization Error: Missing or invalid authenticated user ID (uid).');
  }
  if (!tx || !tx.id) {
    throw new Error('Firestore Serialization Error: Transaction ID is required.');
  }

  const amount = Number(tx.amount);
  if (isNaN(amount) || !isFinite(amount) || amount <= 0) {
    throw new Error(`Invalid transaction amount: ${tx.amount}. Amount must be a positive number.`);
  }

  if (!tx.accountId || typeof tx.accountId !== 'string' || tx.accountId.trim() === '') {
    throw new Error('Transaction requires a valid account.');
  }

  const type = tx.type;
  if (type !== 'income' && type !== 'expense' && type !== 'transfer') {
    throw new Error(`Unsupported transaction type: ${type}`);
  }

  // Base payload with guaranteed non-undefined primitive fields
  const payload: Record<string, any> = {
    id: tx.id,
    type: tx.type,
    amount: amount,
    currency: tx.currency || 'INR',
    category: tx.category || (type === 'transfer' ? 'Transfer' : 'General'),
    description: tx.description ? String(tx.description).trim() : (tx.category || 'Transaction'),
    date: tx.date || new Date().toISOString().split('T')[0],
    accountId: tx.accountId,
    paymentMode: tx.paymentMode || 'UPI',
    tags: Array.isArray(tx.tags) ? tx.tags.filter(Boolean) : [],
    userId: uid,
    createdAt: tx.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Transaction-type aware validation & field routing
  if (type === 'transfer') {
    if (!tx.toAccountId || typeof tx.toAccountId !== 'string' || tx.toAccountId.trim() === '') {
      throw new Error('Transfer transactions require a valid destination account (toAccountId).');
    }
    if (tx.accountId === tx.toAccountId) {
      throw new Error('Source and destination accounts for a transfer cannot be the same.');
    }
    payload.toAccountId = tx.toAccountId;
  } else {
    // For income and expense: MUST NOT include toAccountId
    // Explicitly delete to prevent any undefined or accidental transfer data leak
    delete payload.toAccountId;
  }

  // Optional string / metadata fields: only include if genuinely provided (not undefined or empty)
  if (typeof tx.subCategory === 'string' && tx.subCategory.trim()) {
    payload.subCategory = tx.subCategory.trim();
  }
  if (typeof tx.notes === 'string' && tx.notes.trim()) {
    payload.notes = tx.notes.trim();
  }
  if (typeof tx.time === 'string' && tx.time.trim()) {
    payload.time = tx.time.trim();
  }
  if (typeof tx.receiptUrl === 'string' && tx.receiptUrl.trim()) {
    payload.receiptUrl = tx.receiptUrl.trim();
  }
  if (typeof tx.exchangeRateAtTransaction === 'number' && isFinite(tx.exchangeRateAtTransaction)) {
    payload.exchangeRateAtTransaction = tx.exchangeRateAtTransaction;
  }
  if (typeof tx.rateDate === 'string' && tx.rateDate.trim()) {
    payload.rateDate = tx.rateDate.trim();
  }
  if (typeof tx.rateSource === 'string' && tx.rateSource.trim()) {
    payload.rateSource = tx.rateSource.trim();
  }
  if (typeof tx.isDeleted === 'boolean') {
    payload.isDeleted = tx.isDeleted;
  }

  return stripUndefined(payload);
}

/**
 * Validates and serializes an Account into a Firestore-safe plain JavaScript object.
 */
export function serializeAccountForFirestore(
  acc: Account,
  uid: string
): Record<string, any> {
  if (!uid || typeof uid !== 'string') {
    throw new Error('Firestore Serialization Error: Missing uid for Account.');
  }
  if (!acc || !acc.id || !acc.name) {
    throw new Error('Firestore Serialization Error: Account requires valid id and name.');
  }

  const payload: Record<string, any> = {
    id: acc.id,
    name: String(acc.name).trim(),
    type: acc.type || 'bank',
    currency: acc.currency || 'INR',
    balance: Number(acc.balance) || 0,
    openingPosition: Number(acc.openingPosition) || 0,
    adjustments: Number(acc.adjustments) || 0,
    netTransfers: Number(acc.netTransfers) || 0,
    color: acc.color || '#3B82F6',
    userId: uid,
    createdAt: acc.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (typeof acc.accountNumber === 'string' && acc.accountNumber.trim()) {
    payload.accountNumber = acc.accountNumber.trim();
  }
  if (typeof acc.icon === 'string' && acc.icon.trim()) {
    payload.icon = acc.icon.trim();
  }
  if (typeof acc.notes === 'string' && acc.notes.trim()) {
    payload.notes = acc.notes.trim();
  }
  if (typeof acc.archived === 'boolean') {
    payload.archived = acc.archived;
  }

  return stripUndefined(payload);
}

/**
 * Validates and serializes a CategoryItem into a Firestore-safe plain JavaScript object.
 */
export function serializeCategoryForFirestore(
  cat: CategoryItem,
  uid: string
): Record<string, any> {
  if (!uid || typeof uid !== 'string') {
    throw new Error('Firestore Serialization Error: Missing uid for Category.');
  }
  if (!cat || !cat.id || !cat.name) {
    throw new Error('Firestore Serialization Error: Category requires valid id and name.');
  }

  const payload: Record<string, any> = {
    id: cat.id,
    name: String(cat.name).trim(),
    type: cat.type === 'income' ? 'income' : 'expense',
    color: cat.color || '#3B82F6',
    icon: cat.icon || 'tag',
    userId: uid,
  };

  return stripUndefined(payload);
}

/**
 * Validates and serializes a UserProfile into a Firestore-safe plain JavaScript object.
 */
export function serializeUserProfileForFirestore(
  profile: UserProfile,
  uid: string
): Record<string, any> {
  if (!uid || typeof uid !== 'string') {
    throw new Error('Firestore Serialization Error: Missing uid for UserProfile.');
  }

  const payload: Record<string, any> = {
    id: uid,
    name: profile.name ? String(profile.name).trim() : 'AI Money Manager',
    email: profile.email ? String(profile.email).trim() : '',
    mobileNumber: profile.mobileNumber ? String(profile.mobileNumber).trim() : '',
    preferredCurrency: profile.preferredCurrency || 'INR',
    storageMode: 'cloud',
    darkModeEnabled: Boolean(profile.darkModeEnabled),
    themeMode: profile.themeMode || 'light',
    isPinLocked: Boolean(profile.isPinLocked),
    biometricsEnabled: Boolean(profile.biometricsEnabled),
    autoLockMinutes: Number(profile.autoLockMinutes) || 5,
    isPro: Boolean(profile.subscription?.isPro),
    planName: profile.subscription?.planName || 'Free Plan',
    billingRegion: profile.subscription?.billingRegion || 'IN',
    billingCurrency: profile.subscription?.billingCurrency || 'INR',
    amountPaid: Number(profile.subscription?.amountPaid) || 0,
    gateway: profile.subscription?.gateway || 'PayU',
    updatedAt: new Date().toISOString(),
  };

  return stripUndefined(payload);
}
