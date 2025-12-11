
interface CacheItem<T> {
  data: T;
  expiry: number;
}

type CacheKey = 'OFFICE_MEMBERS' | 'USER_PERMISSIONS' | 'FINANCIAL_SUMMARY' | 'DASHBOARD_STATS';

class CacheService {
  private memoryCache: Map<string, CacheItem<any>> = new Map();
  private readonly PREFIX = '@JurisCache:';

  constructor() {
    this.restoreFromStorage();
  }

  // Restaura do localStorage para persistência entre reloads
  private restoreFromStorage() {
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(this.PREFIX)) {
          const item = JSON.parse(localStorage.getItem(key) || '{}');
          if (item.expiry > Date.now()) {
            this.memoryCache.set(key, item);
          } else {
            localStorage.removeItem(key); // Limpa expirados
          }
        }
      });
    } catch (e) {
      console.warn('Cache restore failed', e);
    }
  }

  /**
   * Define um valor no cache
   * @param key Chave única (pode usar sufixos, ex: OFFICE_MEMBERS:123)
   * @param data Dados a salvar
   * @param ttlSeconds Tempo de vida em segundos
   */
  set<T>(key: string, data: T, ttlSeconds: number = 300): void {
    const fullKey = this.PREFIX + key;
    const expiry = Date.now() + (ttlSeconds * 1000);
    const item = { data, expiry };

    this.memoryCache.set(fullKey, item);
    
    try {
      localStorage.setItem(fullKey, JSON.stringify(item));
    } catch (e) {
      // Se quota excedida, limpa cache antigo e tenta de novo
      this.clearExpired();
    }
  }

  /**
   * Recupera valor do cache. Retorna null se não existir ou expirado.
   */
  get<T>(key: string): T | null {
    const fullKey = this.PREFIX + key;
    const item = this.memoryCache.get(fullKey);

    if (!item) {
       // Tenta buscar do storage se não estiver em memória (ex: nova aba)
       const stored = localStorage.getItem(fullKey);
       if (stored) {
         const parsed = JSON.parse(stored);
         if (parsed.expiry > Date.now()) {
           this.memoryCache.set(fullKey, parsed);
           return parsed.data;
         }
       }
       return null;
    }

    if (Date.now() > item.expiry) {
      this.del(key);
      return null;
    }

    return item.data;
  }

  del(key: string): void {
    const fullKey = this.PREFIX + key;
    this.memoryCache.delete(fullKey);
    localStorage.removeItem(fullKey);
  }

  /**
   * Invalida chaves por padrão (ex: 'OFFICE_*')
   */
  invalidatePattern(pattern: string): void {
    const regex = new RegExp(`^${this.PREFIX}${pattern}`);
    
    // Memory
    for (const key of this.memoryCache.keys()) {
      if (regex.test(key)) this.memoryCache.delete(key);
    }

    // Storage
    Object.keys(localStorage).forEach(key => {
      if (regex.test(key)) localStorage.removeItem(key);
    });
  }

  clearExpired(): void {
    const now = Date.now();
    for (const [key, item] of this.memoryCache.entries()) {
      if (now > item.expiry) {
        this.memoryCache.delete(key);
        localStorage.removeItem(key);
      }
    }
  }

  /**
   * Wrapper para buscar dados com estratégia Stale-While-Revalidate ou Cache-First
   */
  async fetchWithCache<T>(
    key: string, 
    fetcher: () => Promise<T>, 
    ttl: number = 300
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached) {
      // Opcional: Background refresh se estiver "velho" mas não expirado (Stale)
      // Aqui implementamos Cache-First simples
      return cached;
    }

    const data = await fetcher();
    this.set(key, data, ttl);
    return data;
  }
}

export const cacheService = new CacheService();
