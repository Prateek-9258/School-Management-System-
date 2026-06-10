const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:10000';

class PushNotificationManager {
  constructor() {
    this.swRegistration = null;
    this.isSubscribed = false;
  }

  // ✅ Check if browser supports push
  isSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window;
  }

  // ✅ Register Service Worker
  async registerServiceWorker() {
    if (!this.isSupported()) {
      console.log('❌ Push notifications not supported');
      return false;
    }

    try {
      this.swRegistration = await navigator.serviceWorker.register('/service-worker.js');
      console.log('✅ Service Worker registered');
      return true;
    } catch (err) {
      console.error('❌ Service Worker registration failed:', err);
      return false;
    }
  }

  // ✅ Get VAPID Public Key from server
  async getPublicKey() {
    const res = await fetch(`${API_URL}/api/push/vapid-public-key`);
    const data = await res.json();
    return data.publicKey;
  }

  // ✅ Subscribe to push notifications
  async subscribe(userId = null) {
    if (!this.swRegistration) {
      await this.registerServiceWorker();
    }

    try {
      const publicKey = await this.getPublicKey();
      
      // Convert VAPID key to Uint8Array
      const convertedKey = this.urlBase64ToUint8Array(publicKey);

      const subscription = await this.swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey
      });

      // Save to server
      const res = await fetch(`${API_URL}/api/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription, userId })
      });

      const data = await res.json();
      this.isSubscribed = true;
      console.log('✅ Subscribed to push notifications');
      return data;
    } catch (err) {
      console.error('❌ Subscribe failed:', err);
      return null;
    }
  }

  // ✅ Unsubscribe
  async unsubscribe() {
    if (!this.swRegistration) return;

    const subscription = await this.swRegistration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
      this.isSubscribed = false;
      console.log('🗑️ Unsubscribed from push notifications');
    }
  }

  // ✅ Check subscription status
  async checkSubscription() {
    if (!this.swRegistration) {
      await this.registerServiceWorker();
    }
    const subscription = await this.swRegistration.pushManager.getSubscription();
    this.isSubscribed = !!subscription;
    return this.isSubscribed;
  }

  // ✅ Helper: Convert base64 to Uint8Array
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
}

export default new PushNotificationManager();