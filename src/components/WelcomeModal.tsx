/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ShieldCheck, HardDrive, X, Mail, Lock, KeyRound, Loader2, CheckCircle2 } from 'lucide-react';
import {
  auth,
  googleProvider,
} from '../services/firebase';
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  User,
} from 'firebase/auth';

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
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  if (!isOpen) return null;

  // Real Google Sign-In with genuine Google account chooser
  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await signInWithPopup(auth, googleProvider);
      if (res.user) {
        if (onAuthenticated) onAuthenticated(res.user);
        if (onSelectGoogle) onSelectGoogle();
        onClose();
      }
    } catch (err: any) {
      console.error('Firebase Google Sign-In error:', err);
      setErrorMessage(err?.message || 'Google Sign-In failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Real Email & Password Sign-In
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await signInWithEmailAndPassword(auth, email.trim(), password);
      if (res.user) {
        if (onAuthenticated) onAuthenticated(res.user);
        onClose();
      }
    } catch (err: any) {
      console.error('Firebase Email Sign-In error:', err);
      setErrorMessage(err?.message || 'Invalid email or password.');
    } finally {
      setIsLoading(false);
    }
  };

  // Real Email & Password Sign-Up
  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (res.user) {
        if (onAuthenticated) onAuthenticated(res.user);
        onClose();
      }
    } catch (err: any) {
      console.error('Firebase Sign-Up error:', err);
      setErrorMessage(err?.message || 'Sign-up failed. This email may already be in use.');
    } finally {
      setIsLoading(false);
    }
  };

  // Password Reset
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMessage('Please enter your email address.');
      return;
    }
    setIsLoading(true);
    setErrorMessage('');
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSuccessMessage('Password reset link sent to your email. Check your inbox!');
      setTimeout(() => {
        setAuthMode('email_login');
        setSuccessMessage('');
      }, 3000);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to send password reset email.');
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
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-full transition cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Heading & Shield Icon */}
        <div className="flex items-start gap-3 mb-5 pr-6">
          <div className="w-10 h-10 rounded-xl bg-[#0B1528] flex items-center justify-center text-white shrink-0 mt-0.5">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-[#0B1528] dark:text-white leading-tight">
              Welcome to AI Money Manager
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Choose how you want to save your accounts & financial data
            </p>
          </div>
        </div>

        {/* Error / Success Alerts */}
        {errorMessage && (
          <div className="mb-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 font-medium">
            {errorMessage}
          </div>
        )}
        {successMessage && (
          <div className="mb-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* VIEW 1: CHOOSER (Screenshot 3 + options) */}
        {authMode === 'chooser' && (
          <div className="space-y-3">
            {/* Option 1: Continue with Google Signup (Screenshot 3 Dark Navy Card) */}
            <button
              disabled={isLoading}
              onClick={handleGoogleSignIn}
              className="w-full text-left p-4 rounded-2xl bg-[#0B1528] hover:bg-[#111e38] text-white transition-all shadow-md active:scale-[0.99] cursor-pointer flex items-center gap-3.5"
            >
              {/* Google Logo */}
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
                  Continue with Google Signup & Save Your Data
                </div>
                <div className="text-[11px] text-slate-300 mt-0.5 leading-tight">
                  Direct Google account approval · Safe cloud sync & backup
                </div>
              </div>
            </button>

            {/* Option 2: Continue with Local Storage (Screenshot 3 Light Grey Card) */}
            <button
              onClick={onSelectLocal}
              className="w-full text-left p-4 rounded-2xl bg-[#F1F5F9] dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 text-slate-800 dark:text-slate-100 transition-all border border-slate-200/90 dark:border-slate-700 active:scale-[0.99] cursor-pointer flex items-center gap-3.5"
            >
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-700 border border-slate-200/80 dark:border-slate-600 flex items-center justify-center shrink-0 shadow-xs">
                <HardDrive className="w-5 h-5 text-slate-700 dark:text-slate-200" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white leading-snug">
                  Continue with Local Storage
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">
                  Start immediately without sign-in · Connect Google anytime in Profile
                </div>
              </div>
            </button>

            {/* Email Sign-In / Sign-Up Alternative */}
            <div className="pt-2 text-center">
              <button
                onClick={() => setAuthMode('email_login')}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer inline-flex items-center gap-1.5"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Or Sign In with Email & Password</span>
              </button>
            </div>
          </div>
        )}

        {/* VIEW 2: EMAIL LOGIN */}
        {authMode === 'email_login' && (
          <form onSubmit={handleEmailSignIn} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setAuthMode('forgot_password')}
                  className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Forgot?
                </button>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-[#0B1528] hover:bg-[#111e38] text-white font-bold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isLoading ? 'Signing In...' : 'Sign In'}</span>
            </button>

            <div className="pt-2 flex items-center justify-between text-xs text-slate-500">
              <button
                type="button"
                onClick={() => setAuthMode('chooser')}
                className="text-slate-500 hover:text-slate-800 dark:text-slate-400"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('email_signup')}
                className="font-bold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Create Account
              </button>
            </div>
          </form>
        )}

        {/* VIEW 3: EMAIL SIGN UP */}
        {authMode === 'email_signup' && (
          <form onSubmit={handleEmailSignUp} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Create Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-[#0B1528] hover:bg-[#111e38] text-white font-bold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isLoading ? 'Creating Account...' : 'Create Account & Start'}</span>
            </button>

            <div className="pt-2 flex items-center justify-between text-xs text-slate-500">
              <button
                type="button"
                onClick={() => setAuthMode('email_login')}
                className="text-slate-500 hover:text-slate-800 dark:text-slate-400"
              >
                ← Already have account?
              </button>
            </div>
          </form>
        )}

        {/* VIEW 4: FORGOT PASSWORD */}
        {authMode === 'forgot_password' && (
          <form onSubmit={handlePasswordReset} className="space-y-3.5">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Enter your registered email address to receive a secure password reset link.
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-[#0B1528] hover:bg-[#111e38] text-white font-bold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isLoading ? 'Sending Link...' : 'Send Reset Link'}</span>
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setAuthMode('email_login')}
                className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400"
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
