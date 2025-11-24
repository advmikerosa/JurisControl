import { AppSettings } from '../types';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface SystemNotification {
  id: string;
  title: string;
  body: string;
  type: NotificationType;
  read: boolean;
  timestamp: Date;
}

type NotificationListener = (notification: SystemNotification) => void;

class NotificationService {
  private listeners: NotificationListener[] = [];

  // Register a listener to update React State
  public subscribe(listener: NotificationListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private playSound() {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      
      const ctx = new AudioContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Pleasant "Ding" sound
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      oscillator.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1); // A5
      
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.5);
    } catch (e) {
      console.error("Audio playback failed", e);
    }
  }

  private async simulateEmailDispatch(title: string, body: string) {
    // Em um cenário real, isso chamaria uma API de backend (ex: SendGrid, AWS SES)
    console.group('📧 [Simulação de E-mail Enviado]');
    console.log(`To: usuario@juriscontrol.com`);
    console.log(`Subject: ${title}`);
    console.log(`Body: ${body}`);
    console.groupEnd();
  }

  // Send notification based on user settings
  public notify(title: string, body: string, type: NotificationType = 'info') {
    // FIX: Avoid circular dependency by reading directly from storage instead of importing storageService
    let settings = { email: true, desktop: true, sound: false };
    try {
        const stored = localStorage.getItem('@JurisControl:settings');
        if (stored) {
            const parsed = JSON.parse(stored) as AppSettings;
            if (parsed.notifications) settings = parsed.notifications;
        }
    } catch (e) {
        console.warn("Failed to read notification settings", e);
    }

    // Create internal notification object
    const newNotification: SystemNotification = {
      id: Date.now().toString() + Math.random().toString().slice(2,5),
      title,
      body,
      type,
      read: false,
      timestamp: new Date()
    };

    // 1. Notify React Subscribers (In-App Panel)
    this.listeners.forEach(listener => listener(newNotification));

    // 2. System Sound
    if (settings.sound) {
      this.playSound();
    }

    // 3. Desktop Notification
    if (settings.desktop) {
      if (Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon: '/vite.svg', // Fallback icon
          tag: 'juriscontrol-notification'
        });
      } else if (Notification.permission !== 'denied') {
        // Try to request permission if not explicitly denied yet
        this.requestDesktopPermission().then(granted => {
          if (granted) {
            new Notification(title, { body, icon: '/vite.svg' });
          }
        });
      }
    }

    // 4. Email Notification
    if (settings.email) {
      this.simulateEmailDispatch(title, body);
    }
  }

  public async requestDesktopPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('Este navegador não suporta notificações de desktop.');
      return false;
    }
    
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
}

export const notificationService = new NotificationService();