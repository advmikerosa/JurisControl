import React from 'react';
import { useConnection } from '../context/ConnectionContext';
import { AlertTriangle, Cloud, CloudOff } from 'lucide-react';

export const ConnectionStatus: React.FC = () => {
  const { isOnline, isDemoMode, lastSyncTime } = useConnection();

  if (isDemoMode) {
    return (
      <div className="bg-amber-500/20 border-b border-amber-500/30 text-amber-200 px-4 py-2 flex items-center gap-3 text-xs justify-center font-medium">
        <AlertTriangle size={14} />
        <span>Modo Demo: Dados locais (não sincronizados).</span>
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div className="bg-rose-500/20 border-b border-rose-500/30 text-rose-200 px-4 py-2 flex items-center gap-3 text-xs justify-center font-medium">
        <CloudOff size={14} />
        <span>Offline: Alterações serão salvas localmente e sincronizadas depois.</span>
      </div>
    );
  }

  return null;
};