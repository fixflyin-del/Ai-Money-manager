/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CurrencyCode, CurrencyInfo, ExchangeRates, SUPPORTED_CURRENCIES } from '../types/finance';

// Default static fallback rates pegged against USD
export const DEFAULT_EXCHANGE_RATES: ExchangeRates = {
  base: 'USD',
  rates: {
    USD: 1.0,
    INR: 86.50, // 1 USD = 86.50 INR
    EUR: 0.92,  // 1 USD = 0.92 EUR
    GBP: 0.79,  // 1 USD = 0.79 GBP
    AED: 3.6725,// 1 USD = 3.6725 AED
    SAR: 3.75,  // 1 USD = 3.75 SAR
    CAD: 1.38,  // 1 USD = 1.38 CAD
    AUD: 1.54,  // 1 USD = 1.54 AUD
    SGD: 1.34,  // 1 USD = 1.34 SGD
    JPY: 152.0, // 1 USD = 152 JPY
  },
  lastUpdated: new Date().toISOString(),
  source: 'FixFly Reserve Engine (Cached Fallback)',
};

const STORAGE_KEY_RATES = 'aimoney_exchange_rates';

export function getCachedRates(): ExchangeRates {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RATES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.rates && parsed.rates.INR) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_EXCHANGE_RATES;
}

export function saveCachedRates(rates: ExchangeRates): void {
  try {
    localStorage.setItem(STORAGE_KEY_RATES, JSON.stringify(rates));
  } catch {
    // ignore
  }
}

/**
 * Fetch latest rates from server, falling back to local cached rates.
 */
export async function fetchLiveRates(): Promise<ExchangeRates> {
  try {
    const res = await fetch('/api/exchange-rates');
    if (res.ok) {
      const data: ExchangeRates = await res.json();
      saveCachedRates(data);
      return data;
    }
  } catch (err) {
    console.warn('Failed to fetch live exchange rates, using local fallback:', err);
  }
  return getCachedRates();
}

/**
 * Convert an amount from one currency to another using exchange rates.
 * If historicalRate is provided and fromCurrency is not toCurrency, uses historical rate if appropriate.
 */
export function convertCurrency(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
  rates: Record<CurrencyCode, number> = getCachedRates().rates,
  historicalRate?: number
): number {
  if (from === to) return amount;
  if (!amount || isNaN(amount)) return 0;

  const rateFrom = rates[from] || 1;
  const rateTo = rates[to] || 1;

  // If a historical rate relative to USD was recorded at transaction time
  if (historicalRate && historicalRate > 0) {
    if (from === 'USD') {
      return amount * rateTo;
    }
    // Amount in USD = amount / historicalRate
    const amountInUsd = amount / historicalRate;
    return amountInUsd * rateTo;
  }

  // Cross rate calculation: (Amount / from_rate) * to_rate
  const inUsd = amount / rateFrom;
  return inUsd * rateTo;
}

export function getCurrencyInfo(code: CurrencyCode): CurrencyInfo {
  const found = SUPPORTED_CURRENCIES.find((c) => c.code === code);
  return (
    found || {
      code,
      name: code,
      symbol: code,
      locale: 'en-US',
      fractionDigits: 2,
      flag: '🌐',
    }
  );
}

/**
 * Format a monetary amount according to the target currency's locale standard.
 * e.g., INR: ₹1,50,000.00; USD: $1,500.00; JPY: ¥15,000
 */
export function formatCurrency(
  amount: number,
  currencyCode: CurrencyCode = 'INR',
  options?: { showSymbol?: boolean; maximumFractionDigits?: number }
): string {
  const info = getCurrencyInfo(currencyCode);
  const showSymbol = options?.showSymbol !== false;
  const maxDigits = options?.maximumFractionDigits !== undefined ? options.maximumFractionDigits : info.fractionDigits;

  try {
    const formatted = new Intl.NumberFormat(info.locale, {
      style: showSymbol ? 'currency' : 'decimal',
      currency: currencyCode,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: maxDigits === 0 ? 0 : 2,
      maximumFractionDigits: maxDigits,
    }).format(amount);

    return formatted;
  } catch {
    // Fallback if Intl formatter fails
    const num = amount.toFixed(info.fractionDigits);
    return showSymbol ? `${info.symbol}${num}` : num;
  }
}

/**
 * Short human readable representation (e.g. ₹1.2L, $4.5k)
 */
export function formatCompactCurrency(
  amount: number,
  currencyCode: CurrencyCode = 'INR'
): string {
  const info = getCurrencyInfo(currencyCode);
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';

  if (currencyCode === 'INR') {
    if (abs >= 10000000) {
      return `${sign}${info.symbol}${(abs / 10000000).toFixed(2)} Cr`;
    }
    if (abs >= 100000) {
      return `${sign}${info.symbol}${(abs / 100000).toFixed(2)} L`;
    }
    if (abs >= 1000) {
      return `${sign}${info.symbol}${(abs / 1000).toFixed(1)}k`;
    }
    return formatCurrency(amount, currencyCode);
  }

  if (abs >= 1000000) {
    return `${sign}${info.symbol}${(abs / 1000000).toFixed(2)}M`;
  }
  if (abs >= 1000) {
    return `${sign}${info.symbol}${(abs / 1000).toFixed(1)}k`;
  }

  return formatCurrency(amount, currencyCode);
}
