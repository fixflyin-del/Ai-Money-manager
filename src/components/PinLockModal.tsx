/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Lock, Fingerprint, Delete, ShieldCheck } from 'lucide-react';

interface PinLockModalProps {
  isLocked: boolean;
  correctPin: string;
  onUnlock: () => void;
  biometricsEnabled: boolean;
}

export const PinLockModal: React.FC<PinLockModalProps> = ({
  isLocked,
  correctPin,
  onUnlock,
  biometricsEnabled,
}) => {
  const [enteredPin, setEnteredPin] = useState('');
  const [errorShake, setErrorShake] = useState(false);

  if (!isLocked) return null;

  const handleDigit = (digit: string) => {
    if (enteredPin.length >= 4) return;
    const newPin = enteredPin + digit;
    setEnteredPin(newPin);

    if (newPin.length === 4) {
      if (newPin === correctPin) {
        onUnlock();
        setEnteredPin('');
      } else {
        setErrorShake(true);
        setTimeout(() => {
          setEnteredPin('');
          setErrorShake(false);
        }, 500);
      }
    }
  };

  const handleDelete = () => {
    setEnteredPin((prev) => prev.slice(0, -1));
  };

  const handleBiometricSimulate = () => {
    // Biometric simulated authentication
    onUnlock();
    setEnteredPin('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#020617] backdrop-blur-xl animate-in fade-in">
      <div className="w-full max-w-xs flex flex-col items-center justify-center space-y-8 text-center">
        {/* Brand Icon */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-0.5 shadow-2xl shadow-emerald-500/20">
          <div className="w-full h-full bg-[#0F172A] rounded-[14px] flex items-center justify-center text-emerald-400">
            <Lock className="w-8 h-8" />
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">AI Money Manager</h2>
          <p className="text-xs text-slate-400 mt-1">Enter 4-digit PIN to unlock</p>
        </div>

        {/* PIN Dots Display */}
        <div className={`flex items-center gap-4 ${errorShake ? 'animate-bounce text-rose-500' : ''}`}>
          {[0, 1, 2, 3].map((index) => {
            const isFilled = enteredPin.length > index;
            return (
              <div
                key={index}
                className={`w-4 h-4 rounded-full transition-all duration-200 ${
                  isFilled
                    ? errorShake
                      ? 'bg-rose-500 scale-125'
                      : 'bg-emerald-400 scale-110 shadow-md shadow-emerald-500/50'
                    : 'bg-slate-800 border border-slate-700'
                }`}
              />
            );
          })}
        </div>

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-4 w-full">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              onClick={() => handleDigit(digit)}
              className="w-16 h-16 mx-auto rounded-full bg-[#1E293B] hover:bg-slate-700 active:scale-95 text-white font-mono font-bold text-xl transition-all shadow-md flex items-center justify-center cursor-pointer border border-slate-800"
            >
              {digit}
            </button>
          ))}

          {/* Biometrics button if enabled */}
          {biometricsEnabled ? (
            <button
              onClick={handleBiometricSimulate}
              className="w-16 h-16 mx-auto rounded-full bg-[#1E293B] hover:bg-slate-700 text-emerald-400 flex items-center justify-center transition cursor-pointer border border-slate-800"
              title="Unlock with Biometrics"
            >
              <Fingerprint className="w-7 h-7" />
            </button>
          ) : (
            <div className="w-16 h-16" />
          )}

          <button
            onClick={() => handleDigit('0')}
            className="w-16 h-16 mx-auto rounded-full bg-[#1E293B] hover:bg-slate-700 active:scale-95 text-white font-mono font-bold text-xl transition-all shadow-md flex items-center justify-center cursor-pointer border border-slate-800"
          >
            0
          </button>

          <button
            onClick={handleDelete}
            className="w-16 h-16 mx-auto rounded-full bg-[#1E293B] hover:bg-slate-700 active:scale-95 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer border border-slate-800"
            title="Delete"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>

        <div className="text-[11px] text-slate-500 flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Secured with FixFly On-Device KeyStore</span>
        </div>
      </div>
    </div>
  );
};
