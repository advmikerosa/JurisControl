
import { storageService } from './storageService';

class NotificationService {
  
  // Play a system sound using Web Audio API (no external assets needed)
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

  // Send notification based on user settings
  public notify(title: string, body: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
    const settings = storageService.getSettings();

    // 1. System Sound
    if (settings.notifications.sound) {
      this.playSound();
    }

    // 2. Desktop Notification
    if (settings.notifications.desktop) {
      if (Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon: '/vite.svg', // Fallback icon
          tag: 'juriscontrol-notification'
        });
      }
    }

    // 3. Email Notification (Simulation)
    if (settings.notifications.email) {
      console.log(`[MOCK EMAIL SERVICE] Sending email to user: Subject: ${title} | Body: ${body}`);
      // In a real app, this would call an API endpoint.
      // We can trigger a specific toast or just log it for this demo.
    }
  }

  public requestDesktopPermission() {
    if (!('Notification' in window)) {
      alert('Este navegador não suporta notificações de desktop.');
      return;
    }
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        new Notification('JurisControl', { body: 'Notificações ativadas com sucesso!' });
      }
    });
  }
}

export const notificationService = new NotificationService();
