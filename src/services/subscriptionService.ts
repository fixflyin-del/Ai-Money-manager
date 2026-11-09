/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SubscriptionPlanDefinition, UserProfile, UserSubscription } from '../types/finance';
import { StorageService } from './storageService';

// Centralized default pricing fallback matching backend configuration
export const DEFAULT_PLANS: SubscriptionPlanDefinition[] = [
  {
    id: 'monthly',
    name: 'Pro Monthly',
    duration: '1 Month',
    features: [
      'Unlimited Gemini AI Receipt Scanning',
      'AI Voice Expense Logger',
      'Multi-currency live exchange rate engine',
      'Unlimited Accounts & Custom Categories',
      'Automated Budget Velocity Alerts',
    ],
    pricing: {
      IN: {
        currency: 'INR',
        symbol: '₹',
        price: 49,
        displayPrice: '₹49 / month',
        gateway: 'PayU',
        gatewayProductId: 'aimoney_pro_monthly_inr',
      },
      GLOBAL: {
        currency: 'USD',
        symbol: '$',
        price: 0.99,
        displayPrice: '$0.99 / month',
        gateway: 'International Card',
        gatewayProductId: 'aimoney_pro_monthly_usd',
      },
    },
  },
  {
    id: 'annual',
    name: 'Pro Annual',
    duration: '1 Year',
    badge: 'BEST VALUE (SAVE 20%)',
    features: [
      'All Pro Monthly Features',
      'AI Financial Health Score & Anomaly Detection',
      'Unlimited PDF & Excel Statements',
      'Google Drive & Cloud Auto-Backup',
      'Multi-device synchronization',
      'Priority FixFly VIP Support',
    ],
    pricing: {
      IN: {
        currency: 'INR',
        symbol: '₹',
        price: 499,
        displayPrice: '₹499 / year',
        gateway: 'PayU',
        gatewayProductId: 'aimoney_pro_yearly_inr',
      },
      GLOBAL: {
        currency: 'USD',
        symbol: '$',
        price: 9.99,
        displayPrice: '$9.99 / year',
        gateway: 'International Card',
        gatewayProductId: 'aimoney_pro_yearly_usd',
      },
    },
  },
  {
    id: 'lifetime',
    name: 'Pro Lifetime Access',
    duration: 'Forever',
    badge: 'ONE-TIME PURCHASE',
    features: [
      'Lifetime Access — Pay Once, Enjoy Forever',
      'All Future AI Models & Roadmap Upgrades',
      'Shared Web + Android Native Entitlement',
      'Zero Ads, Zero Subscriptions',
      'VIP FixFly Early Access Club',
    ],
    pricing: {
      IN: {
        currency: 'INR',
        symbol: '₹',
        price: 1450,
        displayPrice: '₹1,450 one-time',
        gateway: 'PayU',
        gatewayProductId: 'aimoney_pro_lifetime_inr',
      },
      GLOBAL: {
        currency: 'USD',
        symbol: '$',
        price: 29.99,
        displayPrice: '$29.99 one-time',
        gateway: 'International Card',
        gatewayProductId: 'aimoney_pro_lifetime_usd',
      },
    },
  },
];

export async function fetchSubscriptionPlans(): Promise<SubscriptionPlanDefinition[]> {
  try {
    const res = await fetch('/api/subscription/plans');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch (err) {
    console.warn('Failed to load server pricing, using centralized fallback:', err);
  }
  return DEFAULT_PLANS;
}

export interface CheckoutResult {
  success: boolean;
  orderId?: string;
  transactionId?: string;
  gateway?: string;
  billingCurrency: 'INR' | 'USD';
  amount: number;
  message?: string;
}

/**
 * Initiates checkout through the centralized server-side payment engine.
 */
export async function processWebCheckout(
  planId: 'monthly' | 'annual' | 'lifetime',
  billingRegion: 'IN' | 'GLOBAL',
  userProfile: UserProfile
): Promise<CheckoutResult> {
  try {
    const res = await fetch('/api/subscription/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId,
        billingRegion,
        userId: userProfile.id,
        userEmail: userProfile.email,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.orderId) {
      throw new Error(data.error || 'Failed to initiate checkout with gateway');
    }

    // Now simulate gateway verification on server
    const verifyRes = await fetch('/api/subscription/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: data.orderId,
        transactionId: `tx_${data.gateway.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`,
        planId,
        billingRegion,
        userId: userProfile.id,
      }),
    });

    const verifyData = await verifyRes.json();
    if (verifyData.verified) {
      const now = new Date();
      let expiryDate: string | undefined;

      if (planId === 'monthly') {
        const nextMonth = new Date(now);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        expiryDate = nextMonth.toISOString();
      } else if (planId === 'annual') {
        const nextYear = new Date(now);
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        expiryDate = nextYear.toISOString();
      }

      const subscription: UserSubscription = {
        isPro: true,
        planId,
        planName: planId === 'lifetime' ? 'Pro Lifetime' : planId === 'annual' ? 'Pro Annual' : 'Pro Monthly',
        billingRegion,
        billingCurrency: verifyData.currency,
        amountPaid: verifyData.amount,
        gateway: verifyData.gateway,
        transactionId: verifyData.transactionId,
        purchaseDate: now.toISOString(),
        expiryDate,
        status: 'active',
      };

      const updated = { ...userProfile, subscription };
      StorageService.saveUserProfile(updated);

      return {
        success: true,
        orderId: data.orderId,
        transactionId: verifyData.transactionId,
        gateway: verifyData.gateway,
        billingCurrency: verifyData.currency,
        amount: verifyData.amount,
      };
    } else {
      return {
        success: false,
        billingCurrency: billingRegion === 'IN' ? 'INR' : 'USD',
        amount: 0,
        message: verifyData.error || 'Payment verification failed',
      };
    }
  } catch (err: any) {
    return {
      success: false,
      billingCurrency: billingRegion === 'IN' ? 'INR' : 'USD',
      amount: 0,
      message: err?.message || 'Network error during checkout',
    };
  }
}
