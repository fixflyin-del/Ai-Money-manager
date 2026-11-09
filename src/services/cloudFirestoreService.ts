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
  query,
  orderBy,
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from './firebase';
import { Account, Transaction, UserProfile } from '../types/finance';
import { CategoryItem } from './storageService';

export class CloudFirestoreService {
  /**
   * Saves user profile to Firestore
   */
  static async saveUserProfile(profile: UserProfile): Promise<void> {
    const uid = profile.firebaseUid || auth.currentUser?.uid;
    if (!uid) return;
    const userDocRef = doc(db, 'users', uid);
    try {
      await setDoc(
        userDocRef,
        {
          id: uid,
          name: profile.name,
          email: profile.email || '',
          mobileNumber: profile.mobileNumber || '',
          preferredCurrency: profile.preferredCurrency,
          storageMode: profile.storageMode,
          darkModeEnabled: Boolean(profile.darkModeEnabled),
          themeMode: profile.themeMode || 'light',
          isPro: Boolean(profile.subscription?.isPro),
          planName: profile.subscription?.planName || '',
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
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
    }
    return null;
  }

  /**
   * Loads user profile using currently authenticated user
   */
  static async loadProfile(): Promise<Partial<UserProfile> | null> {
    if (!auth.currentUser) return null;
    return this.getUserProfile(auth.currentUser.uid);
  }

  /**
   * Fetches all accounts for a user
   */
  static async getAccounts(uid: string): Promise<Account[]> {
    try {
      const colRef = collection(db, 'users', uid, 'accounts');
      const snap = await getDocs(colRef);
      return snap.docs.map((d) => d.data() as Account);
    } catch (error) {
      console.warn('Failed to get cloud accounts:', error);
      return [];
    }
  }

  /**
   * Fetches all transactions for a user
   */
  static async getTransactions(uid: string): Promise<Transaction[]> {
    try {
      const colRef = collection(db, 'users', uid, 'transactions');
      const snap = await getDocs(colRef);
      return snap.docs.map((d) => d.data() as Transaction);
    } catch (error) {
      console.warn('Failed to get cloud transactions:', error);
      return [];
    }
  }

  /**
   * Fetches all categories for a user
   */
  static async getCategories(uid: string): Promise<CategoryItem[]> {
    try {
      const colRef = collection(db, 'users', uid, 'categories');
      const snap = await getDocs(colRef);
      return snap.docs.map((d) => d.data() as CategoryItem);
    } catch (error) {
      console.warn('Failed to get cloud categories:', error);
      return [];
    }
  }

  /**
   * Syncs an account to Firestore
   */
  static async saveAccount(uidOrAccount: string | Account, maybeAccount?: Account): Promise<void> {
    const uid = typeof uidOrAccount === 'string' ? uidOrAccount : auth.currentUser?.uid;
    const account = typeof uidOrAccount === 'string' ? maybeAccount : uidOrAccount;
    if (!uid || !account) return;

    const path = `users/${uid}/accounts/${account.id}`;
    try {
      await setDoc(doc(db, 'users', uid, 'accounts', account.id), {
        ...account,
        userId: uid,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  /**
   * Deletes an account from Firestore
   */
  static async deleteAccount(accountId: string): Promise<void> {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
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
  static async saveCategory(uidOrCat: string | CategoryItem, maybeCat?: CategoryItem): Promise<void> {
    const uid = typeof uidOrCat === 'string' ? uidOrCat : auth.currentUser?.uid;
    const cat = typeof uidOrCat === 'string' ? maybeCat : uidOrCat;
    if (!uid || !cat) return;

    const path = `users/${uid}/categories/${cat.id}`;
    try {
      await setDoc(doc(db, 'users', uid, 'categories', cat.id), {
        ...cat,
        userId: uid,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  /**
   * Deletes a category from Firestore
   */
  static async deleteCategory(catId: string): Promise<void> {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const path = `users/${uid}/categories/${catId}`;
    try {
      await deleteDoc(doc(db, 'users', uid, 'categories', catId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  /**
   * Syncs a transaction to Firestore
   */
  static async saveTransaction(uidOrTx: string | Transaction, maybeTx?: Transaction): Promise<void> {
    const uid = typeof uidOrTx === 'string' ? uidOrTx : auth.currentUser?.uid;
    const tx = typeof uidOrTx === 'string' ? maybeTx : uidOrTx;
    if (!uid || !tx) return;

    const path = `users/${uid}/transactions/${tx.id}`;
    try {
      await setDoc(doc(db, 'users', uid, 'transactions', tx.id), {
        ...tx,
        userId: uid,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  /**
   * Deletes a transaction from Firestore
   */
  static async deleteTransaction(uidOrTxId: string, maybeTxId?: string): Promise<void> {
    const uid = maybeTxId ? uidOrTxId : auth.currentUser?.uid;
    const txId = maybeTxId ? maybeTxId : uidOrTxId;
    if (!uid || !txId) return;
    const path = `users/${uid}/transactions/${txId}`;
    try {
      await deleteDoc(doc(db, 'users', uid, 'transactions', txId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
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
