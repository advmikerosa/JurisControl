
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
      // Se não houver configuração, força modo Demo
      if (!isSupabaseConfigured || !supabase) {
        setIsDemoMode(true);
        return;
      }

      try {
        // Tenta um ping simples no Auth para verificar se a API está respondendo
        // Se o projeto estiver PAUSADO, isso retornará erro de conexão
        const { error } = await supabase.auth.getSession();
        
        if (error) {
           // Se for erro de conexão/fetch, assume offline ou projeto pausado
           if (error.message && (error.message.includes('connection') || error.message.includes('fetch') || error.message.includes('Failed to fetch'))) {
             setIsOnline(false);
             setIsDemoMode(true); // Fallback para dados locais para a UI não quebrar
           } else {
             // Outros erros (ex: sessão expirada) não significam offline
             setIsOnline(true);
             setIsDemoMode(false);
           }
        } else {
          setIsOnline(true);
          setLastSyncTime(new Date());
          setIsDemoMode(false);
        }
      } catch (error) {
        // Erro catastrófico de rede
        setIsOnline(false);
        setIsDemoMode(true);
      }
    };

    // Check imediato e depois polling
    checkConnection();
    const interval = setInterval(checkConnection, 30000);

    const handleOnline = () => {
        setIsOnline(true);
        // Tenta reconectar e processar fila
        checkConnection();
        syncQueueService.processPending();
    };

    const handleOffline = () => {
        setIsOnline(false);
        setIsDemoMode(true);
    };

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
