
import { useAuth } from '../context/AuthContext';
import { permissionService } from '../services/permissionService';
import { PermissionResource, PermissionAction, Office } from '../types';
import { useState, useEffect } from 'react';
import { storageService } from '../services/storageService';

export const usePermission = () => {
  const { user } = useAuth();
  const [currentOffice, setCurrentOffice] = useState<Office | null>(null);

  useEffect(() => {
    const loadOffice = async () => {
      if (user?.currentOfficeId) {
        const office = await storageService.getOfficeById(user.currentOfficeId);
        setCurrentOffice(office || null);
      }
    };
    loadOffice();
  }, [user?.currentOfficeId]);

  const can = (resource: PermissionResource, action: PermissionAction) => {
    return permissionService.can(user, currentOffice, resource, action);
  };

  return { can, currentOffice, role: currentOffice?.members.find(m => m.userId === user?.id)?.role };
};
