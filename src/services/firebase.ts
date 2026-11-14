/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  User,
  UserCredential,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const resolvedFirebaseConfig = {
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID as string) || firebaseConfig.projectId,
  appId: (import.meta.env.VITE_FIREBASE_APP_ID as string) || firebaseConfig.appId,
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY as string) || firebaseConfig.apiKey,
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string) || firebaseConfig.authDomain,
  firestoreDatabaseId: (import.meta.env.VITE_FIREBASE_DATABASE_ID as string) || firebaseConfig.firestoreDatabaseId,
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string) || firebaseConfig.storageBucket,
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || firebaseConfig.messagingSenderId,
  oAuthClientId: (import.meta.env.VITE_FIREBASE_OAUTH_CLIENT_ID as string) || firebaseConfig.oAuthClientId,
};

export const app = initializeApp(resolvedFirebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, resolvedFirebaseConfig.firestoreDatabaseId);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

type NativeGoogleResult = { idToken?: string; error?: string };

function signInWithNativeGoogle(): Promise<UserCredential> {
  return new Promise<UserCredential>((resolve, reject) => {
    const nativeBridge = (window as any).MoneyFlowNative;
    if (!nativeBridge || typeof nativeBridge.startNativeGoogleSignIn !== 'function') {
      reject(new Error('Native Google Sign-In is unavailable in this app build.'));
      return;
    }

    let settled = false;
    const finish = (callback: (value: any) => void, value: any) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      delete (window as any).onNativeGoogleSignIn;
      callback(value);
    };

    const timeout = window.setTimeout(() => {
      finish(reject, new Error('Google Sign-In timed out. Please try again.'));
    }, 120000);

    (window as any).onNativeGoogleSignIn = async (rawResult: string) => {
      try {
        const result = JSON.parse(rawResult) as NativeGoogleResult;
        if (result.error) {
          finish(reject, new Error(result.error));
          return;
        }
        if (!result.idToken) {
          finish(reject, new Error('Google did not return an ID token.'));
          return;
        }
        const credential = GoogleAuthProvider.credential(result.idToken);
        const userCredential = await signInWithCredential(auth, credential);
        finish(resolve, userCredential);
      } catch (error) {
        finish(reject, error);
      }
    };

    try {
      nativeBridge.startNativeGoogleSignIn(resolvedFirebaseConfig.oAuthClientId);
    } catch (error) {
      finish(reject, error);
    }
  });
}

export const AuthService = {
  signInWithGoogle: () => {
    const nativeBridge = (window as any).MoneyFlowNative;
    return nativeBridge && typeof nativeBridge.startNativeGoogleSignIn === 'function'
      ? signInWithNativeGoogle()
      : signInWithPopup(auth, googleProvider);
  },
  signInWithEmail: (email: string, pass: string) => signInWithEmailAndPassword(auth, email, pass),
  signUpWithEmail: (email: string, pass: string) => createUserWithEmailAndPassword(auth, email, pass),
  sendPasswordReset: (email: string) => sendPasswordResetEmail(auth, email),
  signOut: () => signOut(auth),
  onAuthStateChanged: (callback: (user: User | null) => void) => onAuthStateChanged(auth, callback),
  getCurrentUser: () => auth.currentUser,
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}