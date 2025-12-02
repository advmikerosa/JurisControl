
import { useAuth } from '../context/AuthContext';
import { permissionService } from '../services/permissionService';
import { PermissionResource, PermissionAction, Office } from '../types';
import { useState, useEffect } from 'react';
import { storageService } from '../services/storageService';

export const usePermission = () => {
  const { user } = useAuth();
  const [currentOffice, setCurrentOffice] = useState<Office | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const loadOffice = async () => {
      setLoading(true);
      if (user?.currentOfficeId) {
        try {
          const office = await storageService.getOfficeById(user.currentOfficeId);
          if (mounted) setCurrentOffice(office || null);
        } catch {
          // Silent fail or fallback
        }
      } else if (user) {
        // Create a temporary mock office context for permission checks if needed
        // This mirrors the logic in Layout to prevent blocking UI
        if (mounted) setCurrentOffice({
            id: 'default',
            name: 'Meu Escritório',
            handle: '@usuario',
            ownerId: user.id,
            location: 'Brasil',
            members: [{ userId: user.id, name: user.name, role: 'Admin', permissions: { financial: true, cases: true, documents: true, settings: true } }]
        } as Office);
      }
      if (mounted) setLoading(false);
    };
    loadOffice();
    return () => { mounted = false; };
  }, [user?.currentOfficeId, user]);

  const can = (resource: PermissionResource, action: PermissionAction) => {
    if (loading && !currentOffice) return false;
    return permissionService.can(user, currentOffice, resource, action);
  };

  return { 
    can, 
    currentOffice, 
    role: currentOffice?.members.find(m => m.userId === user?.id)?.role,
    loading 
  };
};
