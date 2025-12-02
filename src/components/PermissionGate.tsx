
import React from 'react';
import { usePermission } from '../hooks/usePermission';
import { PermissionResource, PermissionAction } from '../types';
import { Lock } from 'lucide-react';

interface PermissionGateProps {
  children: React.ReactNode;
  resource: PermissionResource;
  action: PermissionAction;
  fallback?: React.ReactNode; // O que mostrar se negado (null por padrão)
  showLock?: boolean; // Se true, mostra um placeholder de bloqueio visual
}

export const PermissionGate: React.FC<PermissionGateProps> = ({ 
  children, 
  resource, 
  action, 
  fallback = null,
  showLock = false 
}) => {
  const { can } = usePermission();

  if (can(resource, action)) {
    return <>{children}</>;
  }

  if (showLock) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-slate-100 dark:bg-white/5 border-2 border-dashed border-slate-300 dark:border-white/10 rounded-xl text-slate-400">
        <div className="p-3 bg-slate-200 dark:bg-white/10 rounded-full mb-3">
            <Lock size={24} />
        </div>
        <p className="text-sm font-medium">Acesso Restrito</p>
        <p className="text-xs mt-1 opacity-70">Você não tem permissão para visualizar este conteúdo.</p>
      </div>
    );
  }

  return <>{fallback}</>;
};
