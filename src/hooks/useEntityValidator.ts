import { useEffect, useState } from 'react';
import { storageService } from '../services/storageService';

export const useEntityValidator = (
  entityType: 'case' | 'client' | 'task',
  id: string | undefined
) => {
  const [isValid, setIsValid] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    
    if (!id) {
      if (mounted) {
        setIsValid(false);
        setIsLoading(false);
      }
      return;
    }

    const validate = async () => {
      try {
        let entity;
        switch (entityType) {
          case 'case':
            entity = await storageService.getCaseById(id);
            break;
          case 'client':
            const clients = await storageService.getClients();
            entity = clients.find(c => c.id === id);
            break;
          case 'task':
            const tasks = await storageService.getTasks();
            entity = tasks.find(t => t.id === id);
            break;
        }
        if (mounted) setIsValid(!!entity);
      } catch (error) {
        console.error(`Erro ao validar ${entityType}:`, error);
        if (mounted) setIsValid(false);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    validate();
    
    return () => { mounted = false; };
  }, [id, entityType]);

  return { isValid, isLoading };
};