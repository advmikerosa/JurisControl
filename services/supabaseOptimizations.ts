/**
 * Supabase Query Optimizations
 * Estratégias de otimização para melhorar performance e reduzir latência
 * Implementa paginação, filtros server-side e cache inteligente
 */

import { supabase } from './supabase';

// Tipagem para paginação
interface PaginationParams {
  page: number;
  pageSize: number;
  offset?: number;
}

interface QueryOptions {
  select?: string;
  filters?: Record<string, any>;
  ordering?: { column: string; ascending?: boolean };
  pagination?: PaginationParams;
  limit?: number;
}

/**
 * Executa query otimizada com select específico (apenas colunas necessárias)
 * Reduz tamanho da transferência de dados
 */
export async function fetchWithSelectOptimization<T>(
  table: string,
  options: QueryOptions
): Promise<{ data: T[]; count: number; error: any }> {
  try {
    let query = supabase.from(table).select(options.select || '*', {
      count: 'exact',
    });

    // Aplicar filtros server-side
    if (options.filters) {
      Object.entries(options.filters).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          query = query.eq(key, value);
        }
      });
    }

    // Aplicar ordenação
    if (options.ordering) {
      query = query.order(options.ordering.column, {
        ascending: options.ordering.ascending !== false,
      });
    }

    // Aplicar paginação
    if (options.pagination) {
      const { page, pageSize } = options.pagination;
      const offset = (page - 1) * pageSize;
      query = query.range(offset, offset + pageSize - 1);
    } else if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, count, error } = await query;
    return { data: data || [], count: count || 0, error };
  } catch (error) {
    return { data: [], count: 0, error };
  }
}

/**
 * Query otimizada para casos (cases)
 * Inclui apenas dados essenciais na listagem
 */
export async function fetchCasesOptimized(
  page: number = 1,
  pageSize: number = 20,
  filters?: { status?: string; attorney_id?: string }
) {
  // Seleciona apenas colunas necessárias para listagem
  const selectColumns = `
    id,
    case_number,
    title,
    status,
    client_id,
    attorney_id,
    created_at,
    updated_at,
    next_hearing_date
  `;

  return fetchWithSelectOptimization('cases', {
    select: selectColumns,
    filters,
    ordering: { column: 'created_at', ascending: false },
    pagination: { page, pageSize },
  });
}

/**
 * Query otimizada para clientes (clients)
 */
export async function fetchClientsOptimized(
  page: number = 1,
  pageSize: number = 20,
  filters?: { status?: string }
) {
  const selectColumns = `
    id,
    name,
    email,
    phone,
    status,
    created_at,
    updated_at
  `;

  return fetchWithSelectOptimization('clients', {
    select: selectColumns,
    filters,
    ordering: { column: 'name', ascending: true },
    pagination: { page, pageSize },
  });
}

/**
 * Query com busca textual otimizada (full-text search)
 * Requer índices FTS no Supabase
 */
export async function searchCases(
  searchTerm: string,
  page: number = 1,
  pageSize: number = 20
) {
  try {
    const offset = (page - 1) * pageSize;

    // Usar FTS se disponível, senão usar ILIKE como fallback
    const { data, count, error } = await supabase
      .from('cases')
      .select(
        `
        id,
        case_number,
        title,
        status,
        created_at
      `,
        { count: 'exact' }
      )
      .or(
        `case_number.ilike.%${searchTerm}%,title.ilike.%${searchTerm}%`
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    return { data: data || [], count: count || 0, error };
  } catch (error) {
    return { data: [], count: 0, error };
  }
}

/**
 * Fetch detalhado com relações (para detail pages)
 * Carrega dados completos apenas quando necessário
 */
export async function fetchCaseDetails(caseId: string) {
  try {
    const { data, error } = await supabase
      .from('cases')
      .select(
        `
        *,
        client:clients(*),
        documents:documents(*),
        events:events(*)
      `
      )
      .eq('id', caseId)
      .single();

    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
}

/**
 * Batch operations otimizadas
 * Reduz número de requisições combinando múltiplas operações
 */
export async function batchInsert<T>(
  table: string,
  records: T[],
  batchSize: number = 100
) {
  try {
    const results = [];
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const { data, error } = await supabase
        .from(table)
        .insert(batch)
        .select();

      if (error) throw error;
      results.push(...(data || []));
    }

    return { data: results, error: null };
  } catch (error) {
    return { data: [], error };
  }
}

/**
 * Cache simples em memória para queries frequentes
 * Reduz requisições desnecessárias ao servidor
 */
const queryCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

export async function fetchWithCache<T>(
  cacheKey: string,
  queryFn: () => Promise<any>,
  duration: number = CACHE_DURATION
): Promise<T> {
  const cached = queryCache.get(cacheKey);

  if (
    cached &&
    Date.now() - cached.timestamp < duration
  ) {
    return cached.data;
  }

  const result = await queryFn();
  queryCache.set(cacheKey, {
    data: result,
    timestamp: Date.now(),
  });

  return result;
}

/**
 * Limpar cache
 */
export function clearCache(pattern?: string) {
  if (pattern) {
    for (const [key] of queryCache) {
      if (key.includes(pattern)) {
        queryCache.delete(key);
      }
    }
  } else {
    queryCache.clear();
  }
}

/**
 * Implementação de debounce para buscas
 * Reduz requisições durante digitação do usuário
 */
export function createDebouncedSearch(
  searchFn: (term: string) => Promise<any>,
  delay: number = 300
) {
  let timeout: NodeJS.Timeout;

  return (term: string) => {
    return new Promise((resolve) => {
      clearTimeout(timeout);
      timeout = setTimeout(async () => {
        const result = await searchFn(term);
        resolve(result);
      }, delay);
    });
  };
}
