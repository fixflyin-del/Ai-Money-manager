/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ShieldCheck,
  HardDrive,
  X,
  Mail,
  Lock,
  User as UserIcon,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  KeyRound,
} from 'lucide-react';
import {
  auth,
  AuthService,
} from '../services/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  User,
} from 'firebase/auth';
import { StorageService } from '../services/storageService';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticated?: (user: User) => void;
  onSelectGoogle?: () => void;
  onSelectLocal: () => void;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({
  isOpen,
  onClose,
  onAuthenticated,
  onSelectGoogle,
  onSelectLocal,
}) => {
  const [authMode, setAuthMode] = useState<'chooser' | 'email_login' | 'email_signup' | 'forgot_password'>('chooser');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  if (!isOpen) return null;

  const mapAuthError = (err: any): string => {
    const code = err?.code || '';
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
      return 'Incorrect email or password. Please verify and try again.';
    }
    if (code === 'auth/email-already-in-use') {
      return 'An account already exists with this email. Please switch to Sign In.';
    }
    if (code === 'auth/weak-password') {
      return 'Password is too weak. Please choose at least 6 characters.';
    }
    if (code === 'auth/invalid-email') {
      return 'Please enter a valid email address.';
    }
    if (code === 'auth/too-many-requests') {
      return 'Access temporarily locked due to many failed attempts. Try again later or reset password.';
    }
    if (code === 'auth/network-request-failed') {
      return 'Network connection issue. Please check your internet connection.';
    }
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      return 'Google sign-in popup was cancelled.';
    }
    return err?.message || 'Authentication error. Please try again.';
  };

  // Google Sign-In
  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await AuthService.signInWithGoogle();
      if (res.user) {
        StorageService.setActiveUser(res.user.uid);
        if (onAuthenticated) onAuthenticated(res.user);
        if (onSelectGoogle) onSelectGoogle();
        onClose();
      }
    } catch (err: any) {
      console.error('Firebase Google Sign-In error:', err);
      setErrorMessage(mapAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Email & Password Sign-In
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }
    setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await signInWithEmailAndPassword(auth, email.trim(), password);
      if (res.user) {
        StorageService.setActiveUser(res.user.uid);
        if (onAuthenticated) onAuthenticated(res.user);
        onClose();
      }
    } catch (err: any) {
      console.error('Firebase Email Sign-In error:', err);
      setErrorMessage(mapAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Email & Password Sign-Up
  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMessage('Please fill in all required fields.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (res.user) {
        if (fullName.trim()) {
          try {
            await updateProfile(res.user, { displayName: fullName.trim() });
          } catch (profileErr) {
            console.warn('Profile name update skipped:', profileErr);
          }
        }
        StorageService.setActiveUser(res.user.uid);
        if (onAuthenticated) onAuthenticated(res.user);
        onClose();
      }
    } catch (err: any) {
      console.error('Firebase Sign-Up error:', err);
      setErrorMessage(mapAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Password Reset
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMessage('Please enter your email address to receive reset instructions.');
      return;
    }
    setIsLoading(true);
    setErrorMessage('');
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSuccessMessage('Password reset instructions sent! Please check your email inbox.');
      setTimeout(() => {
        setAuthMode('email_login');
        setSuccessMessage('');
      }, 3000);
    } catch (err: any) {
      console.error('Firebase password reset error:', err);
      setErrorMessage(mapAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl p-6 relative border border-slate-100 dark:border-slate-800">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Heading & Shield Icon */}
        <div className="flex items-start gap-3 mb-5 pr-6">
          <div className="w-10 h-10 rounded-xl bg-[#0B1528] dark:bg-blue-600 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-sm">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-[#0B1528] dark:text-white leading-tight">
              AI Money Manager
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Secure Ledger & Cloud Synchronization
            </p>
          </div>
        </div>

        {/* Error / Success Alerts */}
        {errorMessage && (
          <div className="mb-3.5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 font-medium flex items-start gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
            <div className="flex-1">{errorMessage}</div>
          </div>
        )}
        {successMessage && (
          <div className="mb-3.5 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <div className="flex-1">{successMessage}</div>
          </div>
        )}

        {/* VIEW 1: CHOOSER (Google, Local, or Email) */}
        {authMode === 'chooser' && (
          <div className="space-y-3">
            {/* Option 1: Continue with Google Signup */}
            <button
              disabled={isLoading}
              onClick={handleGoogleSignIn}
              className="w-full text-left p-4 rounded-2xl bg-[#0B1528] hover:bg-[#111e38] text-white transition-all shadow-md active:scale-[0.99] cursor-pointer flex items-center gap-3.5"
            >
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-xs">
                {isLoading ? (
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="font-bold text-xs sm:text-sm text-white leading-snug">
                  Continue with Google
                </div>
                <div className="text-[11px] text-slate-300 mt-0.5 leading-tight">
                  One-tap sign-in · Safe cloud backup & multi-device sync
                </div>
              </div>
            </button>

            {/* Option 2: Email & Password */}
            <button
              onClick={() => {
                setAuthMode('email_login');
                setErrorMessage('');
              }}
              className="w-full text-left p-4 rounded-2xl bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 transition-all border border-slate-200/90 dark:border-slate-700 active:scale-[0.99] cursor-pointer flex items-center gap-3.5 shadow-xs"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200/60 dark:border-blue-900/40 flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white leading-snug">
                  Sign In with Email & Password
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">
                  Login or create a password-protected cloud account
                </div>
              </div>
            </button>

            {/* Option 3: Continue with Local Storage */}
            <button
              onClick={onSelectLocal}
              className="w-full text-left p-4 rounded-2xl bg-[#F8FAFC] dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700/60 text-slate-800 dark:text-slate-100 transition-all border border-slate-200/70 dark:border-slate-700/70 active:scale-[0.99] cursor-pointer flex items-center gap-3.5"
            >
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-700 border border-slate-200/80 dark:border-slate-600 flex items-center justify-center shrink-0 shadow-2xs">
                <HardDrive className="w-5 h-5 text-slate-600 dark:text-slate-300" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white leading-snug">
                  Continue as Guest (Local Storage)
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">
                  Immediate offline access · Stored strictly on this device
                </div>
              </div>
            </button>
          </div>
        )}

        {/* VIEW 2 & 3: EMAIL TABS (SIGN IN vs CREATE ACCOUNT) */}
        {(authMode === 'email_login' || authMode === 'email_signup') && (
          <div className="space-y-3.5">
            {/* Tab Switcher */}
            <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('email_login');
                  setErrorMessage('');
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  authMode === 'email_login'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('email_signup');
                  setErrorMessage('');
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  authMode === 'email_signup'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                }`}
              >
                Create Account
              </button>
            </div>

            {/* SIGN IN FORM */}
            {authMode === 'email_login' && (
              <form onSubmit={handleEmailSignIn} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (errorMessage) setErrorMessage('');
                      }}
                      placeholder="name@example.com"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('forgot_password');
                        setErrorMessage('');
                      }}
                      className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="password"
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errorMessage) setErrorMessage('');
                      }}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 rounded-xl bg-[#0B1528] hover:bg-[#111e38] text-white font-bold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-2 mt-2"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowRight className="w-4 h-4" />
                  )}
                  <span>{isLoading ? 'Signing In...' : 'Sign In to Cloud'}</span>
                </button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('chooser');
                      setErrorMessage('');
                    }}
                    className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 font-medium cursor-pointer"
                  >
                    ← Other Sign-In Options
                  </button>
                </div>
              </form>
            )}

            {/* SIGN UP FORM */}
            {authMode === 'email_signup' && (
              <form onSubmit={handleEmailSignUp} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Full Name (Optional)
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      autoComplete="name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Your Name"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (errorMessage) setErrorMessage('');
                      }}
                      placeholder="name@example.com"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Password (Min 6 Characters)
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="password"
                      required
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errorMessage) setErrorMessage('');
                      }}
                      placeholder="At least 6 characters"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="password"
                      required
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (errorMessage) setErrorMessage('');
                      }}
                      placeholder="Repeat password"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 rounded-xl bg-[#0B1528] hover:bg-[#111e38] text-white font-bold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-2 mt-2"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowRight className="w-4 h-4" />
                  )}
                  <span>{isLoading ? 'Creating Account...' : 'Register & Sync Cloud'}</span>
                </button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('chooser');
                      setErrorMessage('');
                    }}
                    className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 font-medium cursor-pointer"
                  >
                    ← Other Sign-In Options
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* VIEW 4: FORGOT PASSWORD */}
        {authMode === 'forgot_password' && (
          <form onSubmit={handlePasswordReset} className="space-y-3.5">
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Enter your registered email address and we'll send you a secure link to reset your password.
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="name@example.com"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-[#0B1528] hover:bg-[#111e38] text-white font-bold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isLoading ? 'Sending Link...' : 'Send Password Reset Email'}</span>
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('email_login');
                  setErrorMessage('');
                }}
                className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 font-medium cursor-pointer"
              >
                ← Back to Sign In
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
