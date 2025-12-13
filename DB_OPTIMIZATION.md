
# Otimização Completa do Banco de Dados (Corrigido)

Copie e cole o código abaixo no **SQL Editor** do Supabase.

**Correções nesta versão:**
1.  **Resolução do Erro 42710:** Adicionados `DROP POLICY` para as novas políticas antes de criá-las.
2.  **Performance:** Substituição de `auth.uid()` por `(select auth.uid())` para melhor uso de cache do Postgres.
3.  **Limpeza:** Remoção de índices duplicados e não utilizados.
4.  **Indexação:** Criação de índices faltantes em chaves estrangeiras.
5.  **Segurança:** Correção de `search_path` mutável em funções críticas (Linter Security Fix).

```sql
-- ============================================================
-- 1. OTIMIZAÇÃO DE POLÍTICAS (RLS)
-- ============================================================

-- --- Tabela: profiles ---
-- Remover políticas antigas (nomes variados encontrados no linter)
DROP POLICY IF EXISTS "Insert Own Profile" ON public.profiles;
DROP POLICY IF EXISTS "Profiles editable own" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own DataJud key" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own DataJud key" ON public.profiles;
DROP POLICY IF EXISTS "Public Profiles Access" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Remover políticas que vamos criar (para evitar erro "already exists")
DROP POLICY IF EXISTS "Profiles viewable" ON public.profiles;
DROP POLICY IF EXISTS "Profiles insert own" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update own" ON public.profiles;

-- Criar novas políticas otimizadas
CREATE POLICY "Profiles viewable" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Profiles insert own" ON public.profiles FOR INSERT WITH CHECK (id = (select auth.uid()));
CREATE POLICY "Profiles update own" ON public.profiles FOR UPDATE USING (id = (select auth.uid()));


-- --- Tabela: offices ---
DROP POLICY IF EXISTS "Offices create" ON public.offices;
DROP POLICY IF EXISTS "Offices update" ON public.offices;
DROP POLICY IF EXISTS "View Offices" ON public.offices;

DROP POLICY IF EXISTS "View offices" ON public.offices;
DROP POLICY IF EXISTS "Create offices" ON public.offices;
DROP POLICY IF EXISTS "Update offices" ON public.offices;

CREATE POLICY "View offices" ON public.offices FOR SELECT USING (
  owner_id = (select auth.uid()) OR 
  EXISTS (SELECT 1 FROM public.office_members WHERE office_id = public.offices.id AND user_id = (select auth.uid()))
);
CREATE POLICY "Create offices" ON public.offices FOR INSERT WITH CHECK (owner_id = (select auth.uid()));
CREATE POLICY "Update offices" ON public.offices FOR UPDATE USING (owner_id = (select auth.uid()));


-- --- Tabela: office_members ---
DROP POLICY IF EXISTS "Members view" ON public.office_members;
DROP POLICY IF EXISTS "Members manage" ON public.office_members;

DROP POLICY IF EXISTS "View members" ON public.office_members;
DROP POLICY IF EXISTS "Manage members" ON public.office_members;

CREATE POLICY "View members" ON public.office_members FOR SELECT USING (
  user_id = (select auth.uid()) OR 
  EXISTS (SELECT 1 FROM public.offices WHERE id = office_id AND owner_id = (select auth.uid()))
);
CREATE POLICY "Manage members" ON public.office_members FOR ALL USING (
  user_id = (select auth.uid()) OR 
  EXISTS (SELECT 1 FROM public.offices WHERE id = office_id AND owner_id = (select auth.uid()))
);


-- --- Tabela: datajud_api_access_log ---
DROP POLICY IF EXISTS "Insert own logs" ON public.datajud_api_access_log;
DROP POLICY IF EXISTS "View own logs" ON public.datajud_api_access_log;
DROP POLICY IF EXISTS "Users can view their own DataJud logs" ON public.datajud_api_access_log;
DROP POLICY IF EXISTS "Manage own datajud logs" ON public.datajud_api_access_log;

CREATE POLICY "Manage own datajud logs" ON public.datajud_api_access_log
FOR ALL USING (user_id = (select auth.uid()));


-- --- Tabela: activity_logs ---
DROP POLICY IF EXISTS "Insert own logs" ON public.activity_logs;
DROP POLICY IF EXISTS "View own logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Logs own insert" ON public.activity_logs;
DROP POLICY IF EXISTS "Logs own view" ON public.activity_logs;

CREATE POLICY "Insert own logs" ON public.activity_logs FOR INSERT WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "View own logs" ON public.activity_logs FOR SELECT USING (user_id = (select auth.uid()));


-- --- Outras Tabelas (Correção de Auth RLS InitPlan) ---
-- Financial Records
ALTER TABLE public.financial_records DISABLE ROW LEVEL SECURITY; 
ALTER TABLE public.financial_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner Access" ON public.financial_records;
CREATE POLICY "Owner Access" ON public.financial_records FOR ALL USING (user_id = (select auth.uid()));

-- System Documents
DROP POLICY IF EXISTS "Owner Access" ON public.system_documents;
CREATE POLICY "Owner Access" ON public.system_documents FOR ALL USING (user_id = (select auth.uid()));

-- User Settings
DROP POLICY IF EXISTS "User Own Access" ON public.user_settings;
CREATE POLICY "User Own Access" ON public.user_settings FOR ALL USING (user_id = (select auth.uid()));

-- Email Logs
DROP POLICY IF EXISTS "User Own Access" ON public.email_logs;
CREATE POLICY "User Own Access" ON public.email_logs FOR ALL USING (user_id = (select auth.uid()));


-- ============================================================
-- 2. REMOÇÃO DE ÍNDICES E CONSTRAINTS DUPLICADOS
-- ============================================================

DO $$
BEGIN
  -- Remove constraint 'unique_users_email' da tabela users se existir (causa do erro 2BP01)
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_users_email' AND conrelid = 'public.users'::regclass) THEN
    ALTER TABLE public.users DROP CONSTRAINT unique_users_email;
  END IF;
  
  -- Se existir apenas como índice
  DROP INDEX IF EXISTS public.unique_users_email;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Remover índice duplicado em user_settings
DROP INDEX IF EXISTS public.idx_public_user_settings_user_id;

-- Remover índices não utilizados (bloat)
DROP INDEX IF EXISTS public.idx_cases_office_id;
DROP INDEX IF EXISTS public.idx_tasks_office_id;
DROP INDEX IF EXISTS public.idx_financial_office_id;
DROP INDEX IF EXISTS public.idx_clients_office_id;
DROP INDEX IF EXISTS public.idx_financial_user_id;
DROP INDEX IF EXISTS public.idx_financial_client_id;
DROP INDEX IF EXISTS public.idx_financial_case_id;
DROP INDEX IF EXISTS public.idx_financial_status;
DROP INDEX IF EXISTS public.idx_financial_due_date;
DROP INDEX IF EXISTS public.idx_leads_user_id;
DROP INDEX IF EXISTS public.idx_leads_status;
DROP INDEX IF EXISTS public.idx_cases_title_trgm;
DROP INDEX IF EXISTS public.idx_cases_cnj_trgm;
DROP INDEX IF EXISTS public.idx_clients_name_trgm;
DROP INDEX IF EXISTS public.idx_navigation_owner_id;
DROP INDEX IF EXISTS public.idx_clients_email_trgm;
DROP INDEX IF EXISTS public.idx_tasks_due_date;
DROP INDEX IF EXISTS public.idx_cases_office_status;
DROP INDEX IF EXISTS public.idx_tasks_office_due_date;
DROP INDEX IF EXISTS public.idx_financial_office_date;
DROP INDEX IF EXISTS public.idx_clients_docs;
DROP INDEX IF EXISTS public.idx_profiles_datajud_hash;
DROP INDEX IF EXISTS public.idx_datajud_log_user_time;
DROP INDEX IF EXISTS public.idx_user_settings_user_id;
DROP INDEX IF EXISTS public.idx_cases_fts;


-- ============================================================
-- 3. CRIAÇÃO DE ÍNDICES PARA FOREIGN KEYS (Faltantes)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_cases_client_fk ON public.cases(client_id);
CREATE INDEX IF NOT EXISTS idx_client_docs_uploaded_by ON public.client_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_client_interactions_user_id ON public.client_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON public.clients(user_id);
CREATE INDEX IF NOT EXISTS idx_data_requests_user_id ON public.data_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_case_id ON public.documents(case_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON public.email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_case_fk ON public.financial(case_id);
CREATE INDEX IF NOT EXISTS idx_financial_client_fk ON public.financial(client_id);
CREATE INDEX IF NOT EXISTS idx_financial_user_fk ON public.financial(user_id);
CREATE INDEX IF NOT EXISTS idx_office_members_user_fk ON public.office_members(user_id);
CREATE INDEX IF NOT EXISTS idx_offices_owner_id ON public.offices(owner_id);
CREATE INDEX IF NOT EXISTS idx_proposals_lead_id ON public.proposals(lead_id);
CREATE INDEX IF NOT EXISTS idx_sales_tasks_lead_id ON public.sales_tasks(lead_id);
CREATE INDEX IF NOT EXISTS idx_system_docs_user_id ON public.system_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_case_fk ON public.tasks(case_id);
CREATE INDEX IF NOT EXISTS idx_tasks_client_fk ON public.tasks(client_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_fk ON public.tasks(user_id);


-- ============================================================
-- 4. CORREÇÕES DE SEGURANÇA (Linter)
-- ============================================================

-- Correção: function_search_path_mutable
-- Define search_path fixo para evitar sequestro de sessão em funções SECURITY DEFINER
ALTER FUNCTION public.add_creator_as_admin() SET search_path = public, extensions, temp;
ALTER FUNCTION public.handle_new_user() SET search_path = public, extensions, temp;
ALTER FUNCTION public.check_is_member(uuid) SET search_path = public, extensions, temp;

-- Aplica a correção também para funções de suspensão de conta, caso existam
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'delete_own_account') THEN
    ALTER FUNCTION public.delete_own_account() SET search_path = public, extensions, temp;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'reactivate_own_account') THEN
    ALTER FUNCTION public.reactivate_own_account() SET search_path = public, extensions, temp;
  END IF;
END $$;

-- Nota sobre 'auth_leaked_password_protection':
-- Esta configuração não pode ser alterada via SQL. 
-- Ative-a no Painel do Supabase: Authentication > Security > Password protection.
```
