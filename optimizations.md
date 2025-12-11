
# Otimizações de Performance do Banco de Dados

Este documento contém scripts SQL avançados para melhorar a performance do JurisControl no Supabase.
Copie e cole os blocos de código abaixo no **SQL Editor** do Supabase.

## 1. Índices de Performance (B-Tree)

Cria índices para as colunas mais utilizadas em filtros (`WHERE`) e ordenações (`ORDER BY`). Isso acelera drasticamente o carregamento de listas.

```sql
-- Índices para Processos (Filtragem por escritório, status e busca de advogado)
CREATE INDEX IF NOT EXISTS idx_cases_office_status ON public.cases (office_id, status);
CREATE INDEX IF NOT EXISTS idx_cases_last_update ON public.cases (office_id, last_update DESC);
CREATE INDEX IF NOT EXISTS idx_cases_lawyer ON public.cases (office_id, responsible_lawyer);

-- Índices para Tarefas (Filtragem por data e status)
CREATE INDEX IF NOT EXISTS idx_tasks_office_due_date ON public.tasks (office_id, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks (office_id, status);

-- Índices para Financeiro (Cálculos de fluxo de caixa)
CREATE INDEX IF NOT EXISTS idx_financial_office_date ON public.financial (office_id, due_date);
CREATE INDEX IF NOT EXISTS idx_financial_type_status ON public.financial (office_id, type, status);

-- Índices para Clientes (Busca por nome e documento)
CREATE INDEX IF NOT EXISTS idx_clients_office_name ON public.clients (office_id, name);
CREATE INDEX IF NOT EXISTS idx_clients_docs ON public.clients (cpf, cnpj);
```

---

## 2. Full-Text Search (Busca Textual Avançada)

Habilita a busca rápida e inteligente (ignorando acentos e maiúsculas) para Processos. Este script cria uma coluna gerada (`fts`) e uma função RPC para ser chamada pelo frontend.

```sql
-- 1. Adicionar coluna FTS gerada automaticamente na tabela de Processos
ALTER TABLE public.cases
ADD COLUMN IF NOT EXISTS fts tsvector
GENERATED ALWAYS AS (
  to_tsvector('portuguese', title || ' ' || COALESCE(description, '') || ' ' || COALESCE(cnj, ''))
) STORED;

-- 2. Criar Índice GIN (Generalized Inverted Index) para velocidade extrema
CREATE INDEX IF NOT EXISTS idx_cases_fts ON public.cases USING GIN (fts);

-- 3. Função RPC para chamar do Frontend (storageService.ts)
CREATE OR REPLACE FUNCTION public.search_cases(
  search_query text,
  filter_office_id uuid,
  limit_count int DEFAULT 10
)
RETURNS SETOF public.cases
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM public.cases
  WHERE office_id = filter_office_id
  AND fts @@ plainto_tsquery('portuguese', search_query)
  ORDER BY ts_rank(fts, plainto_tsquery('portuguese', search_query)) DESC
  LIMIT limit_count;
$$;
```

---

## 3. View Materializada (Dashboard Cache)

Para dashboards com muitos cálculos financeiros, usamos uma View Materializada. Ela "salva" o resultado da query fisicamente e deve ser atualizada periodicamente, evitando recalcular tudo a cada F5 do usuário.

```sql
-- 1. Criar View Materializada para Resumo Financeiro
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_financial_summary AS
SELECT
  office_id,
  SUM(CASE WHEN type = 'Receita' AND status = 'Pago' THEN amount ELSE 0 END) as total_revenue,
  SUM(CASE WHEN type = 'Despesa' AND status = 'Pago' THEN amount ELSE 0 END) as total_expenses,
  SUM(CASE WHEN status = 'Atrasado' THEN amount ELSE 0 END) as total_overdue,
  COUNT(*) as transaction_count,
  NOW() as last_refreshed
FROM public.financial
GROUP BY office_id;

-- 2. Criar Índice Único para permitir refresh concorrente (sem travar leitura)
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_financial_office ON public.mv_financial_summary (office_id);

-- 3. Função para atualizar a View (Pode ser chamada via Cron ou Trigger)
CREATE OR REPLACE FUNCTION public.refresh_dashboard_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_financial_summary;
END;
$$;
```

---

## 4. Particionamento de Logs (Tabelas Grandes)

A tabela `activity_logs` cresce indefinidamente. O particionamento por data melhora a performance de inserção e consulta.

*Nota: No PostgreSQL, não é possível converter uma tabela normal populada diretamente para particionada. O script abaixo cria uma nova estrutura particionada.*

```sql
BEGIN;

-- 1. Renomear tabela antiga (se existir) para backup/migração
ALTER TABLE IF EXISTS public.activity_logs RENAME TO activity_logs_old;

-- 2. Criar a tabela pai particionada
CREATE TABLE public.activity_logs (
  id uuid DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES public.profiles(id),
  action text NOT NULL,
  status text,
  ip text,
  device text,
  date timestamp with time zone DEFAULT timezone('utc'::text, now()),
  -- Chave de particionamento deve fazer parte da Primary Key se houver constraints
  PRIMARY KEY (id, date)
) PARTITION BY RANGE (date);

-- 3. Criar partições (Exemplo: 2024 e 2025)
CREATE TABLE public.activity_logs_y2024 PARTITION OF public.activity_logs
    FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

CREATE TABLE public.activity_logs_y2025 PARTITION OF public.activity_logs
    FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

-- 4. Criar partição "default" para datas fora do range (segurança)
CREATE TABLE public.activity_logs_default PARTITION OF public.activity_logs DEFAULT;

-- 5. Habilitar RLS na nova tabela particionada
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Insert own logs" ON public.activity_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "View own logs" ON public.activity_logs FOR SELECT USING (auth.uid() = user_id);

-- 6. (Opcional) Migrar dados antigos
-- INSERT INTO public.activity_logs SELECT * FROM public.activity_logs_old;

COMMIT;
```

## Resumo de Manutenção

Para manter o banco saudável, recomenda-se configurar **pg_cron** (se disponível no seu plano Supabase) para rodar periodicamente:

```sql
-- Exemplo: Atualizar estatísticas do dashboard a cada hora
-- SELECT cron.schedule('0 * * * *', 'SELECT public.refresh_dashboard_stats()');

-- Exemplo: Limpeza de VACUUM (O Supabase faz automático, mas em alto volume pode ser útil)
-- VACUUM ANALYZE public.cases;
```
