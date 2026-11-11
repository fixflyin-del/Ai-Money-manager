/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Camera,
  Upload,
  X,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Receipt,
  ArrowRight,
} from 'lucide-react';
import { CurrencyCode, PaymentMode, Transaction, UserProfile } from '../types/finance';
import { AiService, ParsedReceiptData } from '../services/aiService';
import { formatCurrency } from '../services/currencyService';

interface ReceiptScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  accounts: { id: string; name: string; currency: CurrencyCode }[];
  onSaveTransaction: (tx: Omit<Transaction, 'id' | 'createdAt'>) => void;
}

export const ReceiptScannerModal: React.FC<ReceiptScannerModalProps> = ({
  isOpen,
  onClose,
  profile,
  accounts,
  onSaveTransaction,
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState('image/jpeg');
  const [isScanning, setIsScanning] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParsedReceiptData | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || '');
  const [scanError, setScanError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMimeType(file.type || 'image/jpeg');
    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedImage(event.target?.result as string);
      setParsedResult(null);
      setScanError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleScan = async () => {
    if (!selectedImage) return;

    setIsScanning(true);
    setScanError(null);

    try {
      const data = await AiService.scanReceipt(
        selectedImage,
        mimeType,
        profile.preferredCurrency
      );
      setParsedResult(data);
    } catch (err: any) {
      setScanError(err.message || 'Failed to scan receipt image.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleConfirmSave = () => {
    if (!parsedResult) return;

    onSaveTransaction({
      type: 'expense',
      amount: parsedResult.amount,
      currency: parsedResult.currency,
      description: parsedResult.merchant,
      category: parsedResult.category,
      accountId: selectedAccountId,
      paymentMode: parsedResult.paymentMode || 'UPI',
      date: parsedResult.date || new Date().toISOString().split('T')[0],
      notes: `AI Receipt Scan: ${parsedResult.merchant} (Tax: ${parsedResult.taxAmount || 0})`,
      tags: ['ReceiptScan', parsedResult.category],
      ...(selectedImage ? { receiptUrl: selectedImage } : {}),
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#1E293B] border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Gemini AI Receipt Scanner</h3>
              <p className="text-[11px] text-slate-400">Multimodal expense extraction with Gemini 2.5 Flash</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {!selectedImage ? (
            <label className="border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition bg-slate-900/40 hover:bg-slate-900/70">
              <Upload className="w-10 h-10 text-emerald-400 mb-3" />
              <div className="text-xs font-semibold text-white">Upload receipt photo or capture camera</div>
              <div className="text-[11px] text-slate-400 mt-1">Supports PNG, JPG, WEBP up to 10MB</div>
              <input type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
            </label>
          ) : (
            <div className="space-y-4">
              {/* Image Preview */}
              <div className="relative rounded-xl overflow-hidden max-h-48 bg-slate-900 border border-slate-700 flex items-center justify-center">
                <img src={selectedImage} alt="Receipt Preview" className="max-h-48 object-contain" />
                <button
                  onClick={() => {
                    setSelectedImage(null);
                    setParsedResult(null);
                  }}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-slate-900/80 text-white hover:bg-rose-600 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {!parsedResult && (
                <button
                  disabled={isScanning}
                  onClick={handleScan}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 animate-spin" />
                  <span>{isScanning ? 'Gemini AI Analyzing Receipt...' : 'Analyze Receipt with Gemini'}</span>
                </button>
              )}
            </div>
          )}

          {scanError && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{scanError}</span>
            </div>
          )}

          {/* Parsed Result Form Preview */}
          {parsedResult && (
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-700 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-white flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" /> Extracted Transaction
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  Confidence: {Math.round(parsedResult.confidence * 100)}%
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block">Merchant</span>
                  <span className="font-semibold text-white">{parsedResult.merchant}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Total Amount</span>
                  <span className="font-bold font-mono-numbers text-emerald-400 text-sm">
                    {formatCurrency(parsedResult.amount, parsedResult.currency)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Category</span>
                  <span className="font-medium text-slate-200">{parsedResult.category}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Date</span>
                  <span className="font-medium text-slate-200">{parsedResult.date}</span>
                </div>
              </div>

              {parsedResult.items && parsedResult.items.length > 0 && (
                <div className="pt-2 border-t border-slate-800">
                  <span className="text-[10px] text-slate-400 block mb-1">Itemized Lines</span>
                  <div className="space-y-1">
                    {parsedResult.items.map((it, i) => (
                      <div key={i} className="flex justify-between text-[11px] text-slate-300">
                        <span>{it.name}</span>
                        <span className="font-mono-numbers">{formatCurrency(it.price, parsedResult.currency)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Account to debit */}
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
                Confirm & Record Expense
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
