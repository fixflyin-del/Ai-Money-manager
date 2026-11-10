/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

declare global {
  interface Window {
    MoneyFlowNative?: {
      isAndroidApk: () => boolean;
      getCloudUrl: () => string;
      openExternalUrl: (url: string) => void;
      openAuthCustomTab: (url: string) => void;
      saveBase64File: (filename: string, mimeType: string, base64: string) => void;
      launchPlayBillingPurchase: (reqId: string, productId: string, type: string, accountId: string) => void;
      restorePlayBillingPurchases: (reqId: string) => void;
      queryProducts: (reqId: string) => void;
    };
    onPlayBillingPurchaseResult?: (resultJson: string) => void;
    onPlayProductsResult?: (productsJson: string) => void;
  }
}

export class AndroidBridge {
  static isAndroid(): boolean {
    try {
      return !!(window.MoneyFlowNative && window.MoneyFlowNative.isAndroidApk());
    } catch {
      return false;
    }
  }

  static getCloudUrl(): string {
    if (this.isAndroid() && window.MoneyFlowNative?.getCloudUrl) {
      return window.MoneyFlowNative.getCloudUrl();
    }
    return 'https://aimoney.fixfly.in';
  }

  static getApiUrl(endpoint: string): string {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    if (this.isAndroid()) {
      const cloud = this.getCloudUrl();
      if (cloud) return `${cloud.replace(/\/$/, '')}${cleanEndpoint}`;
    }
    return cleanEndpoint;
  }

  static openExternalUrl(url: string): void {
    if (this.isAndroid() && window.MoneyFlowNative?.openExternalUrl) {
      window.MoneyFlowNative.openExternalUrl(url);
    } else {
      window.open(url, '_blank');
    }
  }

  static openAuthCustomTab(url: string): void {
    if (this.isAndroid() && window.MoneyFlowNative?.openAuthCustomTab) {
      window.MoneyFlowNative.openAuthCustomTab(url);
    } else {
      window.open(url, '_blank');
    }
  }

  static saveBase64File(filename: string, mimeType: string, base64Data: string): void {
    if (this.isAndroid() && window.MoneyFlowNative?.saveBase64File) {
      window.MoneyFlowNative.saveBase64File(filename, mimeType, base64Data);
    } else {
      // Browser fallback: download blob via anchor
      try {
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error('Failed to trigger browser download:', err);
      }
    }
  }

  static launchPlayBillingPurchase(productId: string, type: 'subs' | 'inapp', userId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.isAndroid() || !window.MoneyFlowNative?.launchPlayBillingPurchase) {
        reject(new Error('Google Play Billing is only available in the FixFly Android App.'));
        return;
      }

      const reqId = `play_req_${Date.now()}`;

      // Register listener
      window.onPlayBillingPurchaseResult = (jsonStr: string) => {
        try {
          const res = JSON.parse(jsonStr);
          if (res.reqId === reqId) {
            if (res.success) resolve(res);
            else reject(new Error(res.message || 'Google Play purchase cancelled'));
          }
        } catch (e) {
          reject(e);
        }
      };

      window.MoneyFlowNative.launchPlayBillingPurchase(reqId, productId, type, userId);
    });
  }
}
