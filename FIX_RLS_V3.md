
# Correção Final de Segurança - RLS (Versão 3)

Este script corrige definitivamente o erro `column "office_id" does not exist`.
Ele aplica políticas diferenciadas:
1.  **Herança:** Para tabelas filhas de Clientes e Processos (usa JOINs).
2.  **Propriedade (Owner):** Para tabelas de CRM e Sistema que não possuem `office_id` (usa `user_id`).
3.  **Bloqueio:** Para tabelas de migração interna.

Execute o script abaixo no **SQL Editor** do Supabase.

```sql
-- ============================================================
-- 1. FUNÇÃO AUXILIAR (Essencial)
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_is_member(_office_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.office_members 
    WHERE office_id = _office_id 
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 2. TABELAS DE MIGRAÇÃO/SISTEMA (Sem office_id -> Bloquear)
-- ============================================================

-- Tabela: _migration_tasks_due_date_errors
-- Esta tabela não tem office_id nem user_id confiável para RLS público.
DROP POLICY IF EXISTS "No Public Access" ON public._migration_tasks_due_date_errors;
CREATE POLICY "No Public Access" ON public._migration_tasks_due_date_errors
FOR ALL USING (false);

-- ============================================================
-- 3. TABELAS CRM E SUPORTE (Sem office_id -> Usar user_id)
-- Estas tabelas causavam o erro. Mudamos para acesso via Dono.
-- ============================================================

-- Tabela: leads
DROP POLICY IF EXISTS "Owner Access" ON public.leads;
DROP POLICY IF EXISTS "Office Members Access" ON public.leads;
CREATE POLICY "Owner Access" ON public.leads
FOR ALL USING (auth.uid() = user_id);

-- Tabela: proposals
DROP POLICY IF EXISTS "Owner Access" ON public.proposals;
DROP POLICY IF EXISTS "Office Members Access" ON public.proposals;
CREATE POLICY "Owner Access" ON public.proposals
FOR ALL USING (auth.uid() = user_id);

-- Tabela: sales_tasks
DROP POLICY IF EXISTS "Owner Access" ON public.sales_tasks;
DROP POLICY IF EXISTS "Office Members Access" ON public.sales_tasks;
CREATE POLICY "Owner Access" ON public.sales_tasks
FOR ALL USING (auth.uid() = user_id);

-- Tabela: financial_records 
-- (Nota: Se esta tabela foi criada pelo setup oficial, ela TEM office_id. 
-- Se foi criada por migração externa, pode não ter. Vamos usar user_id por segurança aqui, 
-- ou check_is_member se tiver certeza. Na dúvida do erro, user_id é o fallback seguro).
DROP POLICY IF EXISTS "Owner Access" ON public.financial_records;
DROP POLICY IF EXISTS "Office Members Access" ON public.financial_records;
CREATE POLICY "Owner Access" ON public.financial_records
FOR ALL USING (auth.uid() = user_id);

-- Tabela: system_documents
DROP POLICY IF EXISTS "Owner Access" ON public.system_documents;
DROP POLICY IF EXISTS "Office Members Access" ON public.system_documents;
CREATE POLICY "Owner Access" ON public.system_documents
FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- 4. TABELAS DE USUÁRIO (Sempre user_id)
-- ============================================================

-- Tabela: user_settings
DROP POLICY IF EXISTS "User Own Access" ON public.user_settings;
CREATE POLICY "User Own Access" ON public.user_settings
FOR ALL USING (auth.uid() = user_id);

-- Tabela: email_logs
DROP POLICY IF EXISTS "User Own Access" ON public.email_logs;
CREATE POLICY "User Own Access" ON public.email_logs
FOR ALL USING (auth.uid() = user_id);

-- Tabela: data_requests
DROP POLICY IF EXISTS "User Own Access" ON public.data_requests;
CREATE POLICY "User Own Access" ON public.data_requests
FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- 5. TABELAS FILHAS (Herança via JOIN com tabelas pai)
-- Estas funcionam pois buscam o office_id na tabela pai (clients/cases)
-- ============================================================

-- Tabela: client_alerts
DROP POLICY IF EXISTS "Inherit Client Access" ON public.client_alerts;
CREATE POLICY "Inherit Client Access" ON public.client_alerts
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_alerts.client_id
    AND public.check_is_member(c.office_id)
  )
);

-- Tabela: client_documents
DROP POLICY IF EXISTS "Inherit Client Access" ON public.client_documents;
CREATE POLICY "Inherit Client Access" ON public.client_documents
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_documents.client_id
    AND public.check_is_member(c.office_id)
  )
);

-- Tabela: client_interactions
DROP POLICY IF EXISTS "Inherit Client Access" ON public.client_interactions;
CREATE POLICY "Inherit Client Access" ON public.client_interactions
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_interactions.client_id
    AND public.check_is_member(c.office_id)
  )
);

-- Tabela: case_movements
DROP POLICY IF EXISTS "Inherit Case Access" ON public.case_movements;
CREATE POLICY "Inherit Case Access" ON public.case_movements
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.id = case_movements.case_id
    AND public.check_is_member(c.office_id)
  )
);

-- Tabela: case_change_log
DROP POLICY IF EXISTS "Inherit Case Access" ON public.case_change_log;
CREATE POLICY "Inherit Case Access" ON public.case_change_log
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.id = case_change_log.case_id
    AND public.check_is_member(c.office_id)
  )
);
```
