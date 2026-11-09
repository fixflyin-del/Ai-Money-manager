/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  mobileNumber?: string;
  platform: 'android' | 'web' | 'ios';
  storageMode: 'cloud' | 'local';
  registeredAt: string;
  lastActive: string;
  isPro: boolean;
  planName?: string;
  gateway?: 'Google Play Billing' | 'PayU' | 'International Card' | 'Admin Granted';
  amountPaid: number;
  currency: string;
  accountsCount: number;
  transactionsCount: number;
}

export interface AdminSubscriptionRecord {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  planId: 'monthly' | 'annual' | 'lifetime';
  planName: string;
  amount: number;
  currency: string;
  gateway: 'Google Play Billing' | 'PayU' | 'International Card' | 'Admin Granted';
  orderId: string;
  transactionId: string;
  status: 'active' | 'expired' | 'refunded';
  purchaseDate: string;
  expiryDate?: string;
}

export interface PushNotificationRecord {
  id: string;
  title: string;
  body: string;
  targetAudience: 'all' | 'pro_only' | 'free_only' | 'android_only' | 'web_only';
  sentAt: string;
  deliveredCount: number;
  openRate: string;
  status: 'sent' | 'scheduled';
}

const KEY_ADMIN_USERS = 'aimoney_admin_users';
const KEY_ADMIN_SUBS = 'aimoney_admin_subscriptions';
const KEY_ADMIN_PUSH = 'aimoney_admin_push_history';

export class AdminService {
  private static getInitialUsers(): AdminUser[] {
    return [
      {
        id: 'usr_001',
        name: 'Arman Khan',
        email: 'fixfly.in@gmail.com',
        mobileNumber: '+91 98765 43210',
        platform: 'android',
        storageMode: 'cloud',
        registeredAt: '2026-10-15',
        lastActive: 'Just now',
        isPro: true,
        planName: 'Pro Annual',
        gateway: 'Google Play Billing',
        amountPaid: 499,
        currency: 'INR',
        accountsCount: 3,
        transactionsCount: 42,
      },
      {
        id: 'usr_002',
        name: 'Rahul Sharma',
        email: 'rahul.s@example.com',
        mobileNumber: '+91 91234 56780',
        platform: 'web',
        storageMode: 'cloud',
        registeredAt: '2026-10-28',
        lastActive: '2 hours ago',
        isPro: true,
        planName: 'Pro Monthly',
        gateway: 'PayU',
        amountPaid: 49,
        currency: 'INR',
        accountsCount: 2,
        transactionsCount: 18,
      },
      {
        id: 'usr_003',
        name: 'Sarah Jenkins',
        email: 'sarah.j@gmail.com',
        platform: 'web',
        storageMode: 'cloud',
        registeredAt: '2026-11-01',
        lastActive: 'Yesterday',
        isPro: true,
        planName: 'Pro Lifetime',
        gateway: 'International Card',
        amountPaid: 29.99,
        currency: 'USD',
        accountsCount: 4,
        transactionsCount: 56,
      },
      {
        id: 'usr_004',
        name: 'Priya Patel',
        email: 'priya.patel@outlook.com',
        mobileNumber: '+91 98220 11223',
        platform: 'android',
        storageMode: 'local',
        registeredAt: '2026-11-03',
        lastActive: '3 days ago',
        isPro: false,
        amountPaid: 0,
        currency: 'INR',
        accountsCount: 1,
        transactionsCount: 8,
      },
      {
        id: 'usr_005',
        name: 'David Miller',
        email: 'dmiller@company.org',
        platform: 'web',
        storageMode: 'cloud',
        registeredAt: '2026-11-05',
        lastActive: '5 hours ago',
        isPro: false,
        amountPaid: 0,
        currency: 'USD',
        accountsCount: 2,
        transactionsCount: 12,
      },
    ];
  }

  private static getInitialSubscriptions(): AdminSubscriptionRecord[] {
    return [
      {
        id: 'sub_001',
        userId: 'usr_001',
        userName: 'Arman Khan',
        userEmail: 'fixfly.in@gmail.com',
        planId: 'annual',
        planName: 'Pro Annual',
        amount: 499,
        currency: 'INR',
        gateway: 'Google Play Billing',
        orderId: 'GPA.3382-9102-4821-99210',
        transactionId: 'play_tx_992104812',
        status: 'active',
        purchaseDate: '2026-10-15',
        expiryDate: '2027-10-15',
      },
      {
        id: 'sub_002',
        userId: 'usr_002',
        userName: 'Rahul Sharma',
        userEmail: 'rahul.s@example.com',
        planId: 'monthly',
        planName: 'Pro Monthly',
        amount: 49,
        currency: 'INR',
        gateway: 'PayU',
        orderId: 'payu_ord_8829102',
        transactionId: 'payu_tx_7739182',
        status: 'active',
        purchaseDate: '2026-10-28',
        expiryDate: '2026-11-28',
      },
      {
        id: 'sub_003',
        userId: 'usr_003',
        userName: 'Sarah Jenkins',
        userEmail: 'sarah.j@gmail.com',
        planId: 'lifetime',
        planName: 'Pro Lifetime',
        amount: 29.99,
        currency: 'USD',
        gateway: 'International Card',
        orderId: 'card_ord_449102',
        transactionId: 'card_tx_558190',
        status: 'active',
        purchaseDate: '2026-11-01',
      },
    ];
  }

  private static getInitialPushHistory(): PushNotificationRecord[] {
    return [
      {
        id: 'push_001',
        title: 'New: Gemini AI Receipt Scanner 🚀',
        body: 'Scan store receipts instantly with camera or gallery! Tap to try now.',
        targetAudience: 'all',
        sentAt: '2026-11-06 10:30 AM',
        deliveredCount: 4280,
        openRate: '48.2%',
        status: 'sent',
      },
      {
        id: 'push_002',
        title: 'Monthly Budget Reminder 🔔',
        body: 'Check your November savings velocity and category limits in AI Money Manager.',
        targetAudience: 'free_only',
        sentAt: '2026-11-01 09:00 AM',
        deliveredCount: 3150,
        openRate: '39.7%',
        status: 'sent',
      },
    ];
  }

  static getUsers(): AdminUser[] {
    try {
      const raw = localStorage.getItem(KEY_ADMIN_USERS);
      if (raw) return JSON.parse(raw);
    } catch {}
    const initial = this.getInitialUsers();
    localStorage.setItem(KEY_ADMIN_USERS, JSON.stringify(initial));
    return initial;
  }

  static getSubscriptions(): AdminSubscriptionRecord[] {
    try {
      const raw = localStorage.getItem(KEY_ADMIN_SUBS);
      if (raw) return JSON.parse(raw);
    } catch {}
    const initial = this.getInitialSubscriptions();
    localStorage.setItem(KEY_ADMIN_SUBS, JSON.stringify(initial));
    return initial;
  }

  static getPushHistory(): PushNotificationRecord[] {
    try {
      const raw = localStorage.getItem(KEY_ADMIN_PUSH);
      if (raw) return JSON.parse(raw);
    } catch {}
    const initial = this.getInitialPushHistory();
    localStorage.setItem(KEY_ADMIN_PUSH, JSON.stringify(initial));
    return initial;
  }

  static toggleUserPro(userId: string): AdminUser[] {
    const users = this.getUsers().map((u) => {
      if (u.id === userId) {
        const newPro = !u.isPro;
        return {
          ...u,
          isPro: newPro,
          planName: newPro ? 'Pro Admin Lifetime' : undefined,
          gateway: newPro ? ('Admin Granted' as const) : undefined,
        };
      }
      return u;
    });
    localStorage.setItem(KEY_ADMIN_USERS, JSON.stringify(users));
    return users;
  }

  static sendPushNotification(
    title: string,
    body: string,
    targetAudience: PushNotificationRecord['targetAudience']
  ): PushNotificationRecord {
    const history = this.getPushHistory();
    const newRecord: PushNotificationRecord = {
      id: `push_${Date.now()}`,
      title,
      body,
      targetAudience,
      sentAt: new Date().toLocaleString(),
      deliveredCount: Math.floor(Math.random() * 500) + 1200,
      openRate: 'Pending',
      status: 'sent',
    };
    const updated = [newRecord, ...history];
    localStorage.setItem(KEY_ADMIN_PUSH, JSON.stringify(updated));

    // If browser supports native Notification API and permission granted, display preview
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, { body, icon: '/icon-192.png' });
      } catch {}
    }

    return newRecord;
  }
}
