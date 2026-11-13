/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  deleteDoc,
  onSnapshot,
  writeBatch,
  getDocFromServer,
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from './firebase';
import { Account, Budget, Transaction, UserProfile } from '../types/finance';
import { CategoryItem } from './storageService';
import {
  serializeTransactionForFirestore,
  serializeAccountForFirestore,
  serializeCategoryForFirestore,
  serializeUserProfileForFirestore,
  serializeBudgetForFirestore,
} from './firestoreSerializer';

export class CloudFirestoreService {
  /**
   * Tests connection to Firestore server on boot
   */
  static async testConnection(): Promise<boolean> {
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
      return true;
    } catch (error) {
      if (error instanceof Error && error.message.includes('the client is offline')) {
        console.warn('Firestore connection: Client is offline or network restricted.');
      }
      return false;
    }
  }

  /**
   * Saves user profile to Firestore
   */
  static async saveUserProfile(profile: UserProfile): Promise<void> {
    const uid = profile.firebaseUid || auth.currentUser?.uid;
    if (!uid) return;
    const userDocRef = doc(db, 'users', uid);
    try {
      const sanitized = serializeUserProfileForFirestore(profile, uid);
      await setDoc(userDocRef, sanitized, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
    }
  }

  /**
   * Retrieves user profile from Firestore by UID
   */
  static async getUserProfile(uid: string): Promise<UserProfile | null> {
    const userDocRef = doc(db, 'users', uid);
    try {
      const snap = await getDoc(userDocRef);
      if (snap.exists()) {
        const data = snap.data();
        return {
          id: uid,
          name: data.name || 'AI Money Manager',
          email: data.email || undefined,
          mobileNumber: data.mobileNumber || '',
          preferredCurrency: data.preferredCurrency || 'INR',
          storageMode: 'cloud',
          firebaseUid: uid,
          darkModeEnabled: Boolean(data.darkModeEnabled),
          themeMode: data.themeMode || 'light',
          hasSelectedStorageMode: true,
          isPinLocked: Boolean(data.isPinLocked),
          biometricsEnabled: Boolean(data.biometricsEnabled),
          autoLockMinutes: data.autoLockMinutes || 5,
          categoriesSeeded: Boolean(data.categoriesSeeded),
          subscription: {
            isPro: Boolean(data.isPro),
            planName: data.planName || 'Free Plan',
            billingRegion: data.billingRegion || 'IN',
            billingCurrency: data.billingCurrency || 'INR',
            amountPaid: data.amountPaid || 0,
            gateway: data.gateway || 'PayU',
            status: data.isPro ? 'active' : 'cancelled',
          },
        };
      }
    } catch (error) {
      console.warn(`Could not load profile for ${uid}:`, error);
      handleFirestoreError(error, OperationType.GET, `users/${uid}`);
    }
    return null;
  }

  /**
   * Real-time subscription to user profile
   */
  static subscribeToProfile(
    uid: string,
    onData: (profile: UserProfile | null) => void,
    onError?: (err: any) => void
  ): () => void {
    const path = `users/${uid}`;
    return onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          onData({
            id: uid,
            name: data.name || 'AI Money Manager',
            email: data.email || undefined,
            mobileNumber: data.mobileNumber || '',
            preferredCurrency: data.preferredCurrency || 'INR',
            storageMode: 'cloud',
            firebaseUid: uid,
            darkModeEnabled: Boolean(data.darkModeEnabled),
            themeMode: data.themeMode || 'light',
            hasSelectedStorageMode: true,
            isPinLocked: Boolean(data.isPinLocked),
            biometricsEnabled: Boolean(data.biometricsEnabled),
            autoLockMinutes: data.autoLockMinutes || 5,
            categoriesSeeded: Boolean(data.categoriesSeeded),
            subscription: {
              isPro: Boolean(data.isPro),
              planName: data.planName || 'Free Plan',
              billingRegion: data.billingRegion || 'IN',
              billingCurrency: data.billingCurrency || 'INR',
              amountPaid: data.amountPaid || 0,
              gateway: data.gateway || 'PayU',
              status: data.isPro ? 'active' : 'cancelled',
            },
          });
        } else {
          onData(null);
        }
      },
      (error) => {
        if (onError) onError(error);
        handleFirestoreError(error, OperationType.GET, path);
      }
    );
  }

  /**
   * Fetches all accounts for a user
   */
  static async getAccounts(uid: string): Promise<Account[]> {
    const path = `users/${uid}/accounts`;
    try {
      const colRef = collection(db, 'users', uid, 'accounts');
      const snap = await getDocs(colRef);
      return snap.docs.map((d) => d.data() as Account);
    } catch (error) {
      console.warn('Failed to get cloud accounts:', error);
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  }

  /**
   * Real-time listener for user accounts across devices
   */
  static subscribeToAccounts(
    uid: string,
    onData: (accounts: Account[]) => void,
    onError?: (err: any) => void
  ): () => void {
    const path = `users/${uid}/accounts`;
    return onSnapshot(
      collection(db, 'users', uid, 'accounts'),
      (snap) => {
        const accounts = snap.docs.map((d) => d.data() as Account);
        onData(accounts);
      },
      (error) => {
        if (onError) onError(error);
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );
  }

  /**
   * Fetches all transactions for a user
   */
  static async getTransactions(uid: string): Promise<Transaction[]> {
    const path = `users/${uid}/transactions`;
    try {
      const colRef = collection(db, 'users', uid, 'transactions');
      const snap = await getDocs(colRef);
      return snap.docs.map((d) => d.data() as Transaction);
    } catch (error) {
      console.warn('Failed to get cloud transactions:', error);
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  }

  /**
   * Real-time listener for user transactions across devices
   */
  static subscribeToTransactions(
    uid: string,
    onData: (transactions: Transaction[]) => void,
    onError?: (err: any) => void
  ): () => void {
    const path = `users/${uid}/transactions`;
    return onSnapshot(
      collection(db, 'users', uid, 'transactions'),
      (snap) => {
        const transactions = snap.docs.map((d) => d.data() as Transaction);
        onData(transactions);
      },
      (error) => {
        if (onError) onError(error);
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );
  }

  private static normalizeCategories(docs: any[]): CategoryItem[] {
    const items = docs.map((d) => {
      const data = d.data() || {};
      return {
        id: data.id || d.id,
        name: String(data.name || 'Category').trim(),
        type: data.type === 'income' ? 'income' : 'expense',
        icon: data.icon || 'Tag',
        color: data.color || '#3B82F6',
        isDefault: Boolean(data.isDefault),
      } as CategoryItem;
    });
    return items.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'expense' ? -1 : 1;
      if (Boolean(a.isDefault) !== Boolean(b.isDefault)) return a.isDefault ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Fetches all categories for a user
   */
  static async getCategories(uid: string): Promise<CategoryItem[]> {
    const path = `users/${uid}/categories`;
    try {
      const colRef = collection(db, 'users', uid, 'categories');
      const snap = await getDocs(colRef);
      return this.normalizeCategories(snap.docs);
    } catch (error) {
      console.warn('Failed to get cloud categories:', error);
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  }

  /**
   * Real-time listener for user categories across devices
   */
  static subscribeToCategories(
    uid: string,
    onData: (categories: CategoryItem[]) => void,
    onError?: (err: any) => void
  ): () => void {
    const path = `users/${uid}/categories`;
    return onSnapshot(
      collection(db, 'users', uid, 'categories'),
      (snap) => {
        const categories = this.normalizeCategories(snap.docs);
        onData(categories);
      },
      (error) => {
        if (onError) onError(error);
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );
  }

  /**
   * Syncs an account to Firestore with full error handling
   */
  static async saveAccount(uid: string, account: Account): Promise<void> {
    if (!uid || !account) throw new Error('Missing UID or Account for saveAccount');
    const path = `users/${uid}/accounts/${account.id}`;
    try {
      const sanitized = serializeAccountForFirestore(account, uid);
      await setDoc(doc(db, 'users', uid, 'accounts', account.id), sanitized, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  /**
   * Deletes an account from Firestore
   */
  static async deleteAccount(uid: string, accountId: string): Promise<void> {
    if (!uid || !accountId) throw new Error('Missing UID or accountId for deleteAccount');
    const path = `users/${uid}/accounts/${accountId}`;
    try {
      await deleteDoc(doc(db, 'users', uid, 'accounts', accountId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  /**
   * Syncs a category to Firestore
   */
  static async saveCategory(uid: string, cat: CategoryItem): Promise<void> {
    if (!uid || !cat) throw new Error('Missing UID or Category for saveCategory');
    const path = `users/${uid}/categories/${cat.id}`;
    try {
      const sanitized = serializeCategoryForFirestore(cat, uid);
      await setDoc(doc(db, 'users', uid, 'categories', cat.id), sanitized, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  /**
   * Deletes a category from Firestore
   */
  static async deleteCategory(uid: string, catId: string): Promise<void> {
    if (!uid || !catId) throw new Error('Missing UID or catId for deleteCategory');
    const path = `users/${uid}/categories/${catId}`;
    try {
      await deleteDoc(doc(db, 'users', uid, 'categories', catId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  /**
   * Batch seeds multiple categories into Firestore
   */
  static async seedCategoriesBatch(uid: string, categories: CategoryItem[]): Promise<void> {
    if (!uid || !categories || categories.length === 0) return;
    const path = `users/${uid}/categories`;
    try {
      const batch = writeBatch(db);
      for (const cat of categories) {
        const catRef = doc(db, 'users', uid, 'categories', cat.id);
        const serializedCat = serializeCategoryForFirestore(cat, uid);
        batch.set(catRef, serializedCat, { merge: true });
      }
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  /**
   * Batch updates transactions in Firestore (used on category rename/deletion reassignment)
   */
  static async updateTransactionsBatch(uid: string, transactions: Transaction[]): Promise<void> {
    if (!uid || !transactions || transactions.length === 0) return;
    const path = `users/${uid}/transactions`;
    try {
      const chunkSize = 400;
      for (let i = 0; i < transactions.length; i += chunkSize) {
        const chunk = transactions.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        for (const tx of chunk) {
          const txRef = doc(db, 'users', uid, 'transactions', tx.id);
          const serializedTx = serializeTransactionForFirestore(tx, uid);
          batch.set(txRef, serializedTx, { merge: true });
        }
        await batch.commit();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  /**
   * Fetches all budgets for a user
   */
  static async getBudgets(uid: string): Promise<Budget[]> {
    const path = `users/${uid}/budgets`;
    try {
      const colRef = collection(db, 'users', uid, 'budgets');
      const snap = await getDocs(colRef);
      return snap.docs.map((d) => d.data() as Budget);
    } catch (error) {
      console.warn('Failed to get cloud budgets:', error);
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  }

  /**
   * Real-time listener for user budgets across devices
   */
  static subscribeToBudgets(
    uid: string,
    onData: (budgets: Budget[]) => void,
    onError?: (err: any) => void
  ): () => void {
    const path = `users/${uid}/budgets`;
    return onSnapshot(
      collection(db, 'users', uid, 'budgets'),
      (snap) => {
        const budgets = snap.docs.map((d) => d.data() as Budget);
        onData(budgets);
      },
      (error) => {
        if (onError) onError(error);
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );
  }

  /**
   * Saves a budget to Firestore with type validation
   */
  static async saveBudget(uid: string, budget: Budget): Promise<void> {
    if (!uid || !budget) throw new Error('Missing UID or Budget for saveBudget');
    const path = `users/${uid}/budgets/${budget.id}`;
    try {
      const sanitized = serializeBudgetForFirestore(budget, uid);
      await setDoc(doc(db, 'users', uid, 'budgets', budget.id), sanitized, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  /**
   * Deletes a budget from Firestore
   */
  static async deleteBudget(uid: string, budgetId: string): Promise<void> {
    if (!uid || !budgetId) throw new Error('Missing UID or budgetId for deleteBudget');
    const path = `users/${uid}/budgets/${budgetId}`;
    try {
      await deleteDoc(doc(db, 'users', uid, 'budgets', budgetId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  /**
   * Saves a transaction and updates affected account balances atomically in a single batch
   */
  static async saveTransactionWithAccounts(
    uid: string,
    tx: Transaction,
    affectedAccounts: Account[]
  ): Promise<void> {
    if (!uid || !tx) throw new Error('Missing UID or Transaction for saveTransactionWithAccounts');
    const batch = writeBatch(db);
    const txDocRef = doc(db, 'users', uid, 'transactions', tx.id);
    const serializedTx = serializeTransactionForFirestore(tx, uid);
    batch.set(txDocRef, serializedTx);

    for (const acc of affectedAccounts) {
      const accDocRef = doc(db, 'users', uid, 'accounts', acc.id);
      const serializedAcc = serializeAccountForFirestore(acc, uid);
      batch.set(accDocRef, serializedAcc, { merge: true });
    }

    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}/transactions/${tx.id}`);
    }
  }

  /**
   * Deletes a transaction and updates affected account balances atomically in a single batch
   */
  static async deleteTransactionWithAccounts(
    uid: string,
    txId: string,
    affectedAccounts: Account[]
  ): Promise<void> {
    if (!uid || !txId) throw new Error('Missing UID or txId for deleteTransactionWithAccounts');
    const batch = writeBatch(db);
    const txDocRef = doc(db, 'users', uid, 'transactions', txId);
    batch.delete(txDocRef);

    for (const acc of affectedAccounts) {
      const accDocRef = doc(db, 'users', uid, 'accounts', acc.id);
      const serializedAcc = serializeAccountForFirestore(acc, uid);
      batch.set(accDocRef, serializedAcc, { merge: true });
    }

    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${uid}/transactions/${txId}`);
    }
  }

  /**
   * Idempotent safe migration from local storage to Firestore
   * Only uploads documents that do not already exist in Firestore, never overwriting existing cloud data.
   */
  static async migrateLocalDataToFirestore(
    uid: string,
    localAccounts: Account[],
    localTransactions: Transaction[],
    localCategories: CategoryItem[],
    profile: UserProfile
  ): Promise<{ accountsMigrated: number; transactionsMigrated: number }> {
    if (!uid) return { accountsMigrated: 0, transactionsMigrated: 0 };

    // 1. Ensure user profile exists
    await this.saveUserProfile({ ...profile, firebaseUid: uid, storageMode: 'cloud' });

    // 2. Fetch existing cloud data
    const existingAccounts = await this.getAccounts(uid);
    const existingTx = await this.getTransactions(uid);
    const existingCats = await this.getCategories(uid);

    const existingAccIds = new Set(existingAccounts.map((a) => a.id));
    const existingTxIds = new Set(existingTx.map((t) => t.id));
    const existingCatIds = new Set(existingCats.map((c) => c.id));

    const batch = writeBatch(db);
    let accountsMigrated = 0;
    let transactionsMigrated = 0;
    let categoriesMigrated = 0;

    // Migrate missing accounts
    for (const acc of localAccounts) {
      if (!existingAccIds.has(acc.id)) {
        const accRef = doc(db, 'users', uid, 'accounts', acc.id);
        const serializedAcc = serializeAccountForFirestore(acc, uid);
        batch.set(accRef, serializedAcc, { merge: true });
        accountsMigrated++;
      }
    }

    // Migrate missing transactions
    for (const tx of localTransactions) {
      if (!existingTxIds.has(tx.id)) {
        const txRef = doc(db, 'users', uid, 'transactions', tx.id);
        const serializedTx = serializeTransactionForFirestore(tx, uid);
        batch.set(txRef, serializedTx);
        transactionsMigrated++;
      }
    }

    // Migrate missing categories
    for (const cat of localCategories) {
      if (!existingCatIds.has(cat.id)) {
        const catRef = doc(db, 'users', uid, 'categories', cat.id);
        const serializedCat = serializeCategoryForFirestore(cat, uid);
        batch.set(catRef, serializedCat, { merge: true });
        categoriesMigrated++;
      }
    }

    if (accountsMigrated > 0 || transactionsMigrated > 0 || categoriesMigrated > 0) {
      try {
        await batch.commit();
      } catch (error) {
        console.warn('Batch migration partial error:', error);
      }
    }

    return { accountsMigrated, transactionsMigrated };
  }

  /**
   * Records AI question in Firestore to prevent refresh bypass
   */
  static async recordAiQuestionUsed(userId?: string): Promise<number> {
    const uid = userId || auth.currentUser?.uid;
    if (!uid) return 1;
    const today = new Date().toISOString().slice(0, 10);
    const usageRef = doc(db, 'users', uid, 'ai_usage', today);
    try {
      const snap = await getDoc(usageRef);
      const current = snap.exists() ? (snap.data().questionsCount || 0) : 0;
      const next = current + 1;
      await setDoc(
        usageRef,
        {
          userId: uid,
          date: today,
          questionsCount: next,
          lastQuestionAt: new Date().toISOString(),
        },
        { merge: true }
      );
      return next;
    } catch (error) {
      console.warn('Failed to record AI usage in Firestore:', error);
      return 1;
    }
  }

  /**
   * Checks daily AI questions count from Firestore
   */
  static async getDailyAiQuestionsCount(userId?: string): Promise<number> {
    const uid = userId || auth.currentUser?.uid;
    if (!uid) return 0;
    const today = new Date().toISOString().slice(0, 10);
    const usageRef = doc(db, 'users', uid, 'ai_usage', today);
    try {
      const snap = await getDoc(usageRef);
      if (snap.exists()) {
        return snap.data().questionsCount || 0;
      }
    } catch (error) {
      console.warn('Failed to fetch AI usage from Firestore:', error);
    }
    return 0;
  }
}
