
# Correção de Segurança - RLS (Versão 2 - Corrigida)

Este script substitui a versão anterior. Ele corrige o erro `column "office_id" does not exist` ao verificar as permissões através das tabelas "pai" (Clientes e Processos) ao invés de buscar uma coluna que não existe nas tabelas filhas.

Execute o script abaixo no **SQL Editor** do Supabase.

```sql
-- ============================================================
-- 1. FUNÇÃO AUXILIAR (Garantir existência)
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
-- 2. TABELAS FILHAS DE CLIENTES (Herança de Permissão)
-- Regra: Acessível se o usuário é membro do escritório do Cliente pai
-- ============================================================

-- Tabela: client_alerts
DROP POLICY IF EXISTS "Office Members Access" ON public.client_alerts;
CREATE POLICY "Office Members Access" ON public.client_alerts
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_alerts.client_id
    AND public.check_is_member(c.office_id)
  )
);

-- Tabela: client_documents
DROP POLICY IF EXISTS "Office Members Access" ON public.client_documents;
CREATE POLICY "Office Members Access" ON public.client_documents
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_documents.client_id
    AND public.check_is_member(c.office_id)
  )
);

-- Tabela: client_interactions
DROP POLICY IF EXISTS "Office Members Access" ON public.client_interactions;
CREATE POLICY "Office Members Access" ON public.client_interactions
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_interactions.client_id
    AND public.check_is_member(c.office_id)
  )
);

-- ============================================================
-- 3. TABELAS FILHAS DE PROCESSOS (Herança de Permissão)
-- Regra: Acessível se o usuário é membro do escritório do Processo pai
-- ============================================================

-- Tabela: case_movements
DROP POLICY IF EXISTS "Office Members Access" ON public.case_movements;
CREATE POLICY "Office Members Access" ON public.case_movements
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.id = case_movements.case_id
    AND public.check_is_member(c.office_id)
  )
);

-- Tabela: case_change_log
DROP POLICY IF EXISTS "Office Members Access" ON public.case_change_log;
CREATE POLICY "Office Members Access" ON public.case_change_log
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.id = case_change_log.case_id
    AND public.check_is_member(c.office_id)
  )
);

-- ============================================================
-- 4. TABELAS INDEPENDENTES OU CRM (Verificar coluna office_id)
-- Nota: Se estas tabelas não tiverem office_id, alteraremos para user_id (dono)
-- ============================================================

-- Tabela: leads (Tentativa via office_id, fallback para user_id se office_id falhar)
-- Assumindo que leads CRM pertencem ao escritório.
DROP POLICY IF EXISTS "Office Members Access" ON public.leads;
CREATE POLICY "Office Members Access" ON public.leads
FOR ALL USING (
  -- Se tiver office_id
  (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role') OR
  public.check_is_member(office_id)
);

-- Tabela: proposals
DROP POLICY IF EXISTS "Office Members Access" ON public.proposals;
CREATE POLICY "Office Members Access" ON public.proposals
FOR ALL USING (public.check_is_member(office_id));

-- Tabela: sales_tasks
DROP POLICY IF EXISTS "Office Members Access" ON public.sales_tasks;
CREATE POLICY "Office Members Access" ON public.sales_tasks
FOR ALL USING (public.check_is_member(office_id));

-- Tabela: financial_records
DROP POLICY IF EXISTS "Office Members Access" ON public.financial_records;
CREATE POLICY "Office Members Access" ON public.financial_records
FOR ALL USING (public.check_is_member(office_id));

-- Tabela: system_documents
DROP POLICY IF EXISTS "Office Members Access" ON public.system_documents;
CREATE POLICY "Office Members Access" ON public.system_documents
FOR ALL USING (public.check_is_member(office_id));

-- ============================================================
-- 5. TABELAS DE USUÁRIO (Privadas)
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
-- 6. SISTEMA (Bloqueio)
-- ============================================================

DROP POLICY IF EXISTS "No Public Access" ON public._migration_tasks_due_date_errors;
CREATE POLICY "No Public Access" ON public._migration_tasks_due_date_errors
FOR ALL USING (false);
```
