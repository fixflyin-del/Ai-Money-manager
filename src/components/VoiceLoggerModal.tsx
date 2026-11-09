/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Mic,
  MicOff,
  Sparkles,
  X,
  CheckCircle2,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { CurrencyCode, PaymentMode, Transaction, UserProfile } from '../types/finance';
import { AiService, ParsedVoiceExpense } from '../services/aiService';
import { formatCurrency } from '../services/currencyService';

interface VoiceLoggerModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  accounts: { id: string; name: string; currency: CurrencyCode }[];
  onSaveTransaction: (tx: Omit<Transaction, 'id' | 'createdAt'>) => void;
}

export const VoiceLoggerModal: React.FC<VoiceLoggerModalProps> = ({
  isOpen,
  onClose,
  profile,
  accounts,
  onSaveTransaction,
}) => {
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedExpense, setParsedExpense] = useState<ParsedVoiceExpense | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || '');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const quickExamples = [
    'Paid 450 rupees for lunch with UPI',
    'Spent $35 on Uber cab to airport with Credit Card',
    'Bought 1200 groceries at Blinkit using PhonePe',
    'Received 75000 salary from employer in HDFC',
  ];

  // Speech Recognition if browser supports it
  const handleToggleMic = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech Recognition is not natively supported in this browser. You can type or tap an example below!');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText(transcript);
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const handleParse = async () => {
    if (!inputText.trim()) return;

    setIsParsing(true);
    setErrorMsg(null);

    try {
      const res = await AiService.parseVoiceExpense(inputText.trim(), profile.preferredCurrency);
      setParsedExpense(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to parse natural voice expense.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleConfirmSave = () => {
    if (!parsedExpense) return;

    onSaveTransaction({
      type: parsedExpense.type,
      amount: parsedExpense.amount,
      currency: parsedExpense.currency,
      description: parsedExpense.merchantOrDescription,
      category: parsedExpense.category,
      accountId: selectedAccountId,
      paymentMode: parsedExpense.paymentMode,
      date: new Date().toISOString().split('T')[0],
      notes: parsedExpense.notes,
      tags: ['VoiceLogged', parsedExpense.category],
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#1E293B] border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/15 flex items-center justify-center text-indigo-400">
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">AI Voice Expense Logger</h3>
              <p className="text-[11px] text-slate-400">Speak or write in natural language</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Mic Visualizer & Input Box */}
          <div className="flex flex-col items-center justify-center p-5 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-3">
            <button
              onClick={handleToggleMic}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                isListening
                  ? 'bg-rose-600 text-white animate-pulse scale-110 shadow-lg shadow-rose-600/50'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30'
              }`}
            >
              {isListening ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
            </button>
            <div className="text-xs font-semibold text-slate-300">
              {isListening ? 'Listening... Speak your expense now' : 'Tap microphone to speak or type below'}
            </div>
          </div>

          {/* Text Area */}
          <div>
            <textarea
              rows={2}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="e.g. Paid 450 rupees for lunch with UPI"
              className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Quick Preset Chips */}
          <div className="space-y-1.5">
            <span className="text-[10px] text-slate-400 font-semibold uppercase">Or tap an example prompt:</span>
            <div className="flex flex-wrap gap-1.5">
              {quickExamples.map((ex, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setInputText(ex)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-[11px] text-slate-300 border border-slate-700/80 transition cursor-pointer text-left"
                >
                  "{ex}"
                </button>
              ))}
            </div>
          </div>

          {!parsedExpense && (
            <button
              disabled={isParsing || !inputText.trim()}
              onClick={handleParse}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4 animate-spin" />
              <span>{isParsing ? 'Gemini Parsing Sentence...' : 'Parse Transaction'}</span>
            </button>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Parsed Result Box */}
          {parsedExpense && (
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-700 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-white flex items-center gap-1.5 text-indigo-400">
                  <CheckCircle2 className="w-4 h-4" /> Parsed Transaction
                </span>
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                  {parsedExpense.type}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block">Description</span>
                  <span className="font-semibold text-white">{parsedExpense.merchantOrDescription}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Amount</span>
                  <span className="font-bold font-mono-numbers text-indigo-400 text-sm">
                    {formatCurrency(parsedExpense.amount, parsedExpense.currency)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Category</span>
                  <span className="font-medium text-slate-200">{parsedExpense.category}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Payment Mode</span>
                  <span className="font-medium text-slate-200">{parsedExpense.paymentMode}</span>
                </div>
              </div>

              {/* Account Selection */}
              <div className="pt-2 border-t border-slate-800">
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Charge to Account</label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.currency})
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleConfirmSave}
                className="mt-3 w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md shadow-emerald-600/30 transition cursor-pointer"
              >
                Confirm & Record Transaction
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
