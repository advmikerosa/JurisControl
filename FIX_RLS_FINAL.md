
# Correção Definitiva de Segurança - RLS (Final)

Este script corrige os erros `column "office_id" does not exist` e `column "user_id" does not exist` aplicando as estratégias corretas para cada tipo de tabela.

Execute o script abaixo no **SQL Editor** do Supabase.

```sql
-- ============================================================
-- 1. FUNÇÃO AUXILIAR (Essencial para verificação de membros)
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
-- 2. TABELAS DE SISTEMA / MIGRAÇÃO (Sem acesso público)
-- ============================================================

-- Tabela: _migration_tasks_due_date_errors
-- Esta tabela é interna e não deve ter acesso via API.
DROP POLICY IF EXISTS "No Public Access" ON public._migration_tasks_due_date_errors;
CREATE POLICY "No Public Access" ON public._migration_tasks_due_date_errors
FOR ALL USING (false);

-- ============================================================
-- 3. CRM - LEADS E FILHOS (Relacionamento via Lead)
-- ============================================================

-- Tabela Pai: leads (Tem user_id)
DROP POLICY IF EXISTS "Owner Access" ON public.leads;
DROP POLICY IF EXISTS "Office Members Access" ON public.leads;
CREATE POLICY "Owner Access" ON public.leads
FOR ALL USING (auth.uid() = user_id);

-- Tabela Filha: proposals (Tem lead_id, herda permissão de leads)
DROP POLICY IF EXISTS "Inherit Lead Access" ON public.proposals;
DROP POLICY IF EXISTS "Office Members Access" ON public.proposals;
DROP POLICY IF EXISTS "Owner Access" ON public.proposals;
CREATE POLICY "Inherit Lead Access" ON public.proposals
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.leads l 
    WHERE l.id = proposals.lead_id 
    AND l.user_id = auth.uid()
  )
);

-- Tabela Filha: sales_tasks (Tem lead_id, herda permissão de leads)
DROP POLICY IF EXISTS "Inherit Lead Access" ON public.sales_tasks;
DROP POLICY IF EXISTS "Office Members Access" ON public.sales_tasks;
DROP POLICY IF EXISTS "Owner Access" ON public.sales_tasks;
CREATE POLICY "Inherit Lead Access" ON public.sales_tasks
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.leads l 
    WHERE l.id = sales_tasks.lead_id 
    AND l.user_id = auth.uid()
  )
);

-- ============================================================
-- 4. JURÍDICO - CLIENTES E FILHOS (Relacionamento via Client/Office)
-- ============================================================

-- Tabela Filha: client_alerts
DROP POLICY IF EXISTS "Inherit Client Access" ON public.client_alerts;
CREATE POLICY "Inherit Client Access" ON public.client_alerts
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_alerts.client_id
    AND public.check_is_member(c.office_id)
  )
);

-- Tabela Filha: client_documents
DROP POLICY IF EXISTS "Inherit Client Access" ON public.client_documents;
CREATE POLICY "Inherit Client Access" ON public.client_documents
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_documents.client_id
    AND public.check_is_member(c.office_id)
  )
);

-- Tabela Filha: client_interactions
DROP POLICY IF EXISTS "Inherit Client Access" ON public.client_interactions;
CREATE POLICY "Inherit Client Access" ON public.client_interactions
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_interactions.client_id
    AND public.check_is_member(c.office_id)
  )
);

-- ============================================================
-- 5. JURÍDICO - PROCESSOS E FILHOS (Relacionamento via Case/Office)
-- ============================================================

-- Tabela Filha: case_movements
DROP POLICY IF EXISTS "Inherit Case Access" ON public.case_movements;
CREATE POLICY "Inherit Case Access" ON public.case_movements
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.id = case_movements.case_id
    AND public.check_is_member(c.office_id)
  )
);

-- Tabela Filha: case_change_log
DROP POLICY IF EXISTS "Inherit Case Access" ON public.case_change_log;
CREATE POLICY "Inherit Case Access" ON public.case_change_log
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.id = case_change_log.case_id
    AND public.check_is_member(c.office_id)
  )
);

-- ============================================================
-- 6. TABELAS INDEPENDENTES OU LEGADO (Fallback para user_id)
-- ============================================================

-- Tabela: financial_records (Se existir com este nome)
DROP POLICY IF EXISTS "Owner Access" ON public.financial_records;
DROP POLICY IF EXISTS "Office Members Access" ON public.financial_records;
-- Tenta criar apenas se a tabela existir (bloco anônimo para evitar erro)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'financial_records') THEN
        CREATE POLICY "Owner Access" ON public.financial_records FOR ALL USING (auth.uid() = user_id);
    END IF;
END
$$;

-- Tabela: system_documents (Se existir com este nome)
DROP POLICY IF EXISTS "Owner Access" ON public.system_documents;
DROP POLICY IF EXISTS "Office Members Access" ON public.system_documents;
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'system_documents') THEN
        CREATE POLICY "Owner Access" ON public.system_documents FOR ALL USING (auth.uid() = user_id);
    END IF;
END
$$;

-- ============================================================
-- 7. TABELAS DE USUÁRIO (Sempre user_id)
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
```
