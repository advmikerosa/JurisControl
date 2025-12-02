
import React, { createContext, useContext, useState, useEffect } from 'react';
import { notificationService, SystemNotification } from '../services/notificationService';
import { storageService } from '../services/storageService';

interface NotificationContextData {
  notifications: SystemNotification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  addManualNotification: (title: string, body: string) => void;
}

const NotificationContext = createContext<NotificationContextData>({} as NotificationContextData);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);

  useEffect(() => {
    // 1. Subscribe to notification service updates
    const unsubscribe = notificationService.subscribe((newNotification) => {
      setNotifications(prev => [newNotification, ...prev]);
    });

    // 2. Setup Polling (Heartbeat) for alerts - Checks every 60 seconds
    const intervalId = setInterval(() => {
      storageService.checkRealtimeAlerts();
    }, 60000);

    // Initial check on mount
    setTimeout(() => {
       storageService.checkRealtimeAlerts();
       // Opcional: Pedir permissão discretamente se não negado
       notificationService.requestDesktopPermission(); 
    }, 2000);

    return () => {
      unsubscribe();
      clearInterval(intervalId);
    };
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  // Helper mainly for testing UI
  const addManualNotification = (title: string, body: string) => {
    notificationService.notify(title, body, 'info');
  };

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead, clearAll, addManualNotification }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);
