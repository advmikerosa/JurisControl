
# Otimização de Banco de Dados

Para garantir que a paginação e os filtros funcionem rapidamente com milhares de processos, execute este script SQL no Supabase.

```sql
-- Índices para Tabela de Processos (Cases)
-- Melhora a busca por título, CNJ e ordenação por data
CREATE INDEX IF NOT EXISTS idx_cases_user_id ON public.cases(user_id);
CREATE INDEX IF NOT EXISTS idx_cases_office_id ON public.cases(office_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON public.cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_last_update ON public.cases(last_update DESC);

-- Índice GIN para busca textual eficiente (Trigram)
-- Requer a extensão pg_trgm (ativar no painel Extensions)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_cases_title_trgm ON public.cases USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_cases_cnj_trgm ON public.cases USING gin (cnj gin_trgm_ops);

-- Índices para Clientes
CREATE INDEX IF NOT EXISTS idx_clients_name_trgm ON public.clients USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clients_email_trgm ON public.clients USING gin (email gin_trgm_ops);

-- Índices para Tarefas (Filtros comuns)
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
```
