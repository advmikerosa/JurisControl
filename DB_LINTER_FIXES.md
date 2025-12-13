
# Correções de Lint do Banco de Dados

Copie e cole os comandos abaixo no **SQL Editor** do Supabase para resolver os alertas de performance e integridade identificados no relatório.

## 1. Criar Índices em Chaves Estrangeiras (Unindexed Foreign Keys)
Estes índices melhoram a performance de `JOINs` e evitam lentidão ao deletar usuários (cascata).

```sql
-- public.activity_logs_old
CREATE INDEX IF NOT EXISTS idx_activity_logs_old_user_id 
ON public.activity_logs_old(user_id);

-- public.datajud_api_access_log
CREATE INDEX IF NOT EXISTS idx_datajud_api_access_log_user_id 
ON public.datajud_api_access_log(user_id);

-- public.financial_records
CREATE INDEX IF NOT EXISTS idx_financial_records_user_id 
ON public.financial_records(user_id);

-- public.leads
CREATE INDEX IF NOT EXISTS idx_leads_user_id 
ON public.leads(user_id);
```

## 2. Adicionar Chave Primária (No Primary Key)
Tabelas sem chave primária podem causar problemas de replicação e performance.

```sql
-- Adiciona uma coluna ID sintética se não houver outra coluna lógica para ser PK
ALTER TABLE public._migration_tasks_due_date_errors
ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() PRIMARY KEY;
```

## 3. Remover Índices Não Utilizados (Unused Indexes)
Estes índices ocupam espaço em disco e tornam a escrita (`INSERT`/`UPDATE`) mais lenta, sem trazer benefício de leitura.

> **Nota:** Os índices relacionados a partições (`activity_logs_y...`) foram removidos desta lista pois são gerenciados automaticamente pelo Postgres e não devem ser excluídos manualmente.

```sql
-- Logs e Atividades
DROP INDEX IF EXISTS public.idx_email_logs_user_id;

-- Tabelas Core (Verifique se não são essenciais para Foreign Keys antes de rodar em produção)
DROP INDEX IF EXISTS public.idx_cases_client_fk;
DROP INDEX IF EXISTS public.idx_client_docs_uploaded_by;
DROP INDEX IF EXISTS public.idx_client_interactions_user_id;
DROP INDEX IF EXISTS public.idx_clients_user_id;
DROP INDEX IF EXISTS public.idx_data_requests_user_id;
DROP INDEX IF EXISTS public.idx_documents_case_id;
DROP INDEX IF EXISTS public.idx_documents_user_id;

-- Financeiro e Escritório
DROP INDEX IF EXISTS public.idx_financial_case_fk;
DROP INDEX IF EXISTS public.idx_financial_client_fk;
DROP INDEX IF EXISTS public.idx_financial_user_fk;
DROP INDEX IF EXISTS public.idx_office_members_user_fk;
DROP INDEX IF EXISTS public.idx_offices_owner_id;

-- CRM e Tarefas
DROP INDEX IF EXISTS public.idx_proposals_lead_id;
DROP INDEX IF EXISTS public.idx_sales_tasks_lead_id;
DROP INDEX IF EXISTS public.idx_system_docs_user_id;
DROP INDEX IF EXISTS public.idx_tasks_case_fk;
DROP INDEX IF EXISTS public.idx_tasks_client_fk;
DROP INDEX IF EXISTS public.idx_tasks_user_fk;
DROP INDEX IF EXISTS public.idx_cases_status;
```
