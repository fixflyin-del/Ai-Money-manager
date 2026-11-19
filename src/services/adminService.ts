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
  planName: string;
  currency: string;
  accountsCount: number;
  transactionsCount: number;
}

export interface PushNotificationRecord {
  id: string;
  title: string;
  body: string;
  targetAudience: 'all' | 'free_only' | 'android_only' | 'web_only';
  sentAt: string;
  deliveredCount: number;
  openRate: string;
  status: 'sent' | 'scheduled';
}

const KEY_ADMIN_USERS = 'aimoney_admin_users';
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
        planName: '100% Free Edition',
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
        planName: '100% Free Edition',
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
        planName: '100% Free Edition',
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
        planName: '100% Free Edition',
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
        planName: '100% Free Edition',
        currency: 'USD',
        accountsCount: 2,
        transactionsCount: 12,
      },
    ];
  }

  private static getInitialPushHistory(): PushNotificationRecord[] {
    return [
      {
        id: 'push_001',
        title: 'AI Insights & Smart Budget Planning',
        body: 'Explore Deep Smart Analysis and category budgets in AI Money Manager v6.2.0.',
        targetAudience: 'all',
        sentAt: '2026-11-06 10:30 AM',
        deliveredCount: 4280,
        openRate: '48.2%',
        status: 'sent',
      },
      {
        id: 'push_002',
        title: 'Monthly Budget Reminder 🔔',
        body: 'Check your monthly savings velocity and category limits in AI Money Manager.',
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

  static getPushHistory(): PushNotificationRecord[] {
    try {
      const raw = localStorage.getItem(KEY_ADMIN_PUSH);
      if (raw) return JSON.parse(raw);
    } catch {}
    const initial = this.getInitialPushHistory();
    localStorage.setItem(KEY_ADMIN_PUSH, JSON.stringify(initial));
    return initial;
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
