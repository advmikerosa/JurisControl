
import { useState, useEffect } from 'react';
import { cacheService } from '../services/cacheService';

interface UseQueryOptions {
  ttl?: number;
  enabled?: boolean;
}

export function useQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: UseQueryOptions = {}
) {
  const { ttl = 300, enabled = true } = options;
  
  const [data, setData] = useState<T | null>(() => cacheService.get<T>(key));
  const [isLoading, setIsLoading] = useState(!data && enabled);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const fetchData = async () => {
      // Se já temos dados do cache e não estão expirados, não buscamos
      // (A lógica de expiração está dentro do cacheService.get)
      if (data && cacheService.get(key)) {
          setIsLoading(false);
          return;
      }

      setIsLoading(true);
      try {
        const result = await cacheService.fetchWithCache(key, fetcher, ttl);
        setData(result);
        setError(null);
      } catch (err: any) {
        setError(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [key, enabled, ttl]); // Re-fetch if key changes

  const refetch = async () => {
    setIsLoading(true);
    cacheService.del(key);
    try {
        const result = await fetcher();
        cacheService.set(key, result, ttl);
        setData(result);
    } catch(e: any) {
        setError(e);
    } finally {
        setIsLoading(false);
    }
  };

  return { data, isLoading, error, refetch };
}
