
import React, { createContext, useContext, useState, useEffect } from 'react';
import { isSupabaseConfigured, supabase } from '../services/supabase';
import { syncQueueService } from '../services/syncQueue';

interface ConnectionContextData {
  isOnline: boolean;
  isDemoMode: boolean;
  lastSyncTime?: Date;
}

const ConnectionContext = createContext<ConnectionContextData>({
  isOnline: true,
  isDemoMode: false
});

export const ConnectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(!isSupabaseConfigured);
  const [lastSyncTime, setLastSyncTime] = useState<Date>();

  useEffect(() => {
    const checkConnection = async () => {
      if (!isSupabaseConfigured || !supabase) {
        setIsDemoMode(true);
        return;
      }

      try {
        // Simple check to Supabase Auth to verify connectivity
        const { error } = await supabase.auth.getSession();
        
        if (error && error.message && (error.message.includes('connection') || error.message.includes('fetch'))) {
          setIsOnline(false);
        } else {
          setIsOnline(true);
          setLastSyncTime(new Date());
          setIsDemoMode(false);
        }
      } catch (error) {
        setIsOnline(false);
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 30000);

    const handleOnline = () => {
        setIsOnline(true);
        // Trigger sync when coming back online
        syncQueueService.processPending();
    };

    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <ConnectionContext.Provider value={{ isOnline, isDemoMode, lastSyncTime }}>
      {children}
    </ConnectionContext.Provider>
  );
};

export const useConnection = () => useContext(ConnectionContext);
