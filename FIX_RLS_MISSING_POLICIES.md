
# Correção de Segurança - RLS Enabled No Policy

O Security Advisor detectou 14 tabelas com RLS ativado, mas sem políticas de acesso. Isso impede que a aplicação leia ou grave dados nessas tabelas.

Este script cria políticas de acesso baseadas em duas estratégias:
1.  **Acesso por Escritório (Tenancy):** O usuário pode acessar se pertencer ao escritório vinculado ao dado (usando a coluna `office_id`).
2.  **Acesso Pessoal (Ownership):** O usuário pode acessar se for o dono do registro (usando a coluna `user_id`).

Execute o script abaixo no **SQL Editor** do Supabase.

```sql
-- ============================================================
-- 1. GARANTIR FUNÇÃO AUXILIAR
-- ============================================================
-- Esta função é essencial para verificar permissão no escritório de forma segura
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
-- 2. POLÍTICAS PARA TABELAS DE ESCRITÓRIO (CRM & JURÍDICO)
-- Estratégia: Permitir acesso se o usuário for membro do escritório (office_id)
-- ============================================================

-- Tabela: leads
DROP POLICY IF EXISTS "Office Members Access" ON public.leads;
CREATE POLICY "Office Members Access" ON public.leads
FOR ALL USING (public.check_is_member(office_id));

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
-- 3. POLÍTICAS PARA SUB-TABELAS DE PROCESSOS E CLIENTES
-- Estratégia: Estas tabelas geralmente herdam o office_id do pai ou o possuem diretamente.
-- Assumindo que elas possuem coluna office_id para performance.
-- ============================================================

-- Tabela: client_alerts
DROP POLICY IF EXISTS "Office Members Access" ON public.client_alerts;
CREATE POLICY "Office Members Access" ON public.client_alerts
FOR ALL USING (public.check_is_member(office_id));

-- Tabela: client_documents
DROP POLICY IF EXISTS "Office Members Access" ON public.client_documents;
CREATE POLICY "Office Members Access" ON public.client_documents
FOR ALL USING (public.check_is_member(office_id));

-- Tabela: client_interactions
DROP POLICY IF EXISTS "Office Members Access" ON public.client_interactions;
CREATE POLICY "Office Members Access" ON public.client_interactions
FOR ALL USING (public.check_is_member(office_id));

-- Tabela: case_movements
DROP POLICY IF EXISTS "Office Members Access" ON public.case_movements;
CREATE POLICY "Office Members Access" ON public.case_movements
FOR ALL USING (public.check_is_member(office_id));

-- Tabela: case_change_log
DROP POLICY IF EXISTS "Office Members Access" ON public.case_change_log;
CREATE POLICY "Office Members Access" ON public.case_change_log
FOR ALL USING (public.check_is_member(office_id));

-- ============================================================
-- 4. POLÍTICAS PARA TABELAS DE USUÁRIO (PESSOAL)
-- Estratégia: Acesso restrito ao dono do registro (user_id)
-- ============================================================

-- Tabela: user_settings
DROP POLICY IF EXISTS "User Own Access" ON public.user_settings;
CREATE POLICY "User Own Access" ON public.user_settings
FOR ALL USING (auth.uid() = user_id);

-- Tabela: email_logs
DROP POLICY IF EXISTS "User Own Access" ON public.email_logs;
CREATE POLICY "User Own Access" ON public.email_logs
FOR ALL USING (auth.uid() = user_id);

-- Tabela: data_requests (LGPD)
DROP POLICY IF EXISTS "User Own Access" ON public.data_requests;
CREATE POLICY "User Own Access" ON public.data_requests
FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- 5. TABELAS DE SISTEMA / MIGRAÇÃO
-- Estratégia: Apenas leitura para admins ou sem acesso público
-- ============================================================

-- Tabela: _migration_tasks_due_date_errors
-- Geralmente usada apenas internamente. Vamos permitir leitura apenas para debugging se necessário.
DROP POLICY IF EXISTS "No Public Access" ON public._migration_tasks_due_date_errors;
CREATE POLICY "No Public Access" ON public._migration_tasks_due_date_errors
FOR ALL USING (false); -- Bloqueia tudo (Service Role ainda acessa)

```

### Notas Importantes
*   Se alguma tabela listada acima **não possuir** a coluna `office_id`, o script retornará um erro para aquela política específica. Nesse caso, é necessário adicionar a coluna ou alterar a política para fazer um `JOIN` com a tabela pai (ex: `cases` ou `clients`).
*   As políticas `FOR ALL` cobrem `SELECT`, `INSERT`, `UPDATE` e `DELETE`.
