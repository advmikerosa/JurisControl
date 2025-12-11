
# Supabase Final Deploy Script (JurisControl)

Copie todo o conteúdo do bloco SQL abaixo e execute no **SQL Editor** do seu projeto Supabase.
Este script configura:
1.  **Tabelas e Relacionamentos** (Clientes, Processos, Financeiro, etc.).
2.  **Segurança (RLS)** para isolamento de dados entre escritórios.
3.  **Funções e Triggers** (Automação de perfil, Soft Delete).
4.  **Storage** (Buckets privados para documentos).
5.  **Performance** (Índices e Full-Text Search).

---

```sql
-- ==============================================================================
-- 1. EXTENSÕES E CONFIGURAÇÕES INICIAIS
-- ==============================================================================

-- Habilita UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- Habilita busca textual avançada (ignorando acentos)
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Limpeza de segurança (para garantir que funções antigas não conflitem)
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.add_creator_as_admin() CASCADE;
DROP FUNCTION IF EXISTS public.check_is_member(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.search_cases(text, uuid, int) CASCADE;

-- ==============================================================================
-- 2. TABELAS ESTRUTURAIS
-- ==============================================================================

-- 2.1. Perfis de Usuário (Vinculado ao Auth do Supabase)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
  full_name text,
  username text,
  avatar_url text,
  email text,
  phone text,
  oab text,
  settings jsonb DEFAULT '{}'::jsonb,
  -- Campos de Segurança e Auditoria
  deleted_at timestamp with time zone,
  datajud_api_key_encrypted text,
  datajud_api_key_hash text,
  datajud_key_created_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2.2. Escritórios (Tenancy)
CREATE TABLE IF NOT EXISTS public.offices (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL,
  handle text UNIQUE NOT NULL,
  owner_id uuid REFERENCES public.profiles(id) NOT NULL,
  location text,
  logo_url text,
  area_of_activity text,
  social jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2.3. Membros do Escritório
CREATE TABLE IF NOT EXISTS public.office_members (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  office_id uuid REFERENCES public.offices(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role text CHECK (role IN ('Admin', 'Advogado', 'Estagiário', 'Financeiro')) DEFAULT 'Advogado',
  permissions jsonb DEFAULT '{"cases": true, "financial": false, "documents": true, "settings": false}'::jsonb,
  joined_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(office_id, user_id)
);

-- ==============================================================================
-- 3. TABELAS DE DADOS (JURÍDICO & CRM)
-- Todas possuem `office_id` para garantir isolamento (Multi-tenancy).
-- ==============================================================================

-- 3.1. Clientes
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  office_id uuid REFERENCES public.offices(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id), -- Criador
  name text NOT NULL,
  type text CHECK (type IN ('PF', 'PJ')),
  status text DEFAULT 'Ativo',
  email text,
  phone text,
  avatar_url text,
  address text,
  city text,
  state text,
  cpf text,
  rg text,
  cnpj text,
  corporate_name text,
  notes text,
  tags text[],
  -- Colunas JSONB para evitar excesso de tabelas pequenas
  history jsonb DEFAULT '[]'::jsonb,
  documents jsonb DEFAULT '[]'::jsonb,
  alerts jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3.2. Processos (Cases)
CREATE TABLE IF NOT EXISTS public.cases (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  office_id uuid REFERENCES public.offices(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id),
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  cnj text,
  title text NOT NULL,
  status text DEFAULT 'Ativo',
  category text,
  phase text,
  value numeric(15, 2) DEFAULT 0,
  responsible_lawyer text,
  court text,
  next_hearing date,
  description text,
  -- Colunas JSONB
  movements jsonb DEFAULT '[]'::jsonb,
  change_log jsonb DEFAULT '[]'::jsonb,
  last_update timestamp with time zone DEFAULT timezone('utc'::text, now()),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Coluna Gerada para Full Text Search (Otimização)
ALTER TABLE public.cases
ADD COLUMN IF NOT EXISTS fts tsvector
GENERATED ALWAYS AS (
  to_tsvector('portuguese', title || ' ' || COALESCE(description, '') || ' ' || COALESCE(cnj, ''))
) STORED;

-- 3.3. Tarefas (CRM e Prazos)
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  office_id uuid REFERENCES public.offices(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id),
  title text NOT NULL,
  due_date date,
  priority text CHECK (priority IN ('Alta', 'Média', 'Baixa')),
  status text DEFAULT 'A Fazer',
  assigned_to text,
  description text,
  case_id uuid REFERENCES public.cases(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  case_title text, -- Cache para evitar JOINs complexos em listas rápidas
  client_name text, -- Cache
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3.4. Financeiro
CREATE TABLE IF NOT EXISTS public.financial (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  office_id uuid REFERENCES public.offices(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id),
  title text NOT NULL,
  amount numeric(15, 2) NOT NULL,
  type text CHECK (type IN ('Receita', 'Despesa')),
  category text,
  status text DEFAULT 'Pendente',
  due_date date,
  payment_date date,
  case_id uuid REFERENCES public.cases(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name text,
  installment jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3.5. Documentos do Sistema
CREATE TABLE IF NOT EXISTS public.documents (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  office_id uuid REFERENCES public.offices(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id),
  name text NOT NULL,
  size text,
  type text,
  category text,
  date date DEFAULT CURRENT_DATE,
  case_id uuid REFERENCES public.cases(id) ON DELETE SET NULL,
  storage_path text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- 4. LOGS E AUDITORIA
-- ==============================================================================

-- Logs de Ações do Usuário
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id),
  action text NOT NULL,
  status text,
  ip text,
  device text,
  date timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Logs de Acesso DataJud (Segurança)
CREATE TABLE IF NOT EXISTS public.datajud_api_access_log (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint_used text,
  cnj_searched text,
  status_code int,
  error_message text,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- 5. FUNÇÕES E TRIGGERS (Lógica de Negócio no Banco)
-- ==============================================================================

-- 5.1. Criar Perfil ao Registrar
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public -- Fix de segurança
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url, username)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email,
    new.raw_user_meta_data->>'avatar_url',
    COALESCE(new.raw_user_meta_data->>'username', '@user_' || substr(new.id::text, 1, 8))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 5.2. Adicionar Dono como Admin ao Criar Escritório
CREATE OR REPLACE FUNCTION public.add_creator_as_admin()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.office_members (office_id, user_id, role, permissions)
  VALUES (
    new.id,
    new.owner_id,
    'Admin',
    '{"cases": true, "financial": true, "documents": true, "settings": true}'::jsonb
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_office_created ON public.offices;
CREATE TRIGGER on_office_created
  AFTER INSERT ON public.offices
  FOR EACH ROW EXECUTE PROCEDURE public.add_creator_as_admin();

-- 5.3. Helper de Verificação de Membro (Essencial para RLS)
CREATE OR REPLACE FUNCTION public.check_is_member(_office_id uuid)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.office_members 
    WHERE office_id = _office_id 
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql;

-- 5.4. Busca Full Text Search (RPC para Frontend)
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

-- 5.5. Soft Delete e Reativação
CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles SET deleted_at = NOW() WHERE id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.reactivate_own_account()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles SET deleted_at = NULL WHERE id = auth.uid();
END;
$$;

-- ==============================================================================
-- 6. SEGURANÇA (ROW LEVEL SECURITY)
-- ==============================================================================

-- Habilitar RLS em tudo
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.datajud_api_access_log ENABLE ROW LEVEL SECURITY;

-- Políticas Profiles
CREATE POLICY "Profiles viewable" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Profiles editable own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Políticas Offices
CREATE POLICY "Offices view" ON public.offices FOR SELECT USING (true); -- Necessário para encontrar escritório ao entrar
CREATE POLICY "Offices create" ON public.offices FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Offices update" ON public.offices FOR UPDATE USING (auth.uid() = owner_id);

-- Políticas Members
CREATE POLICY "Members view" ON public.office_members FOR SELECT USING (
  user_id = auth.uid() OR public.check_is_member(office_id)
);
CREATE POLICY "Members manage" ON public.office_members FOR ALL USING (
  public.check_is_member(office_id)
);

-- Políticas de Dados (Isolamento por Escritório)
CREATE POLICY "Access Clients" ON public.clients FOR ALL USING (public.check_is_member(office_id));
CREATE POLICY "Access Cases" ON public.cases FOR ALL USING (public.check_is_member(office_id));
CREATE POLICY "Access Tasks" ON public.tasks FOR ALL USING (public.check_is_member(office_id));
CREATE POLICY "Access Financial" ON public.financial FOR ALL USING (public.check_is_member(office_id));
CREATE POLICY "Access Documents" ON public.documents FOR ALL USING (public.check_is_member(office_id));

-- Políticas de Logs
CREATE POLICY "Logs own" ON public.activity_logs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "DataJud logs own" ON public.datajud_api_access_log FOR ALL USING (auth.uid() = user_id);

-- ==============================================================================
-- 7. ÍNDICES DE PERFORMANCE
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_cases_office_status ON public.cases (office_id, status);
CREATE INDEX IF NOT EXISTS idx_cases_last_update ON public.cases (office_id, last_update DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_office_due_date ON public.tasks (office_id, due_date);
CREATE INDEX IF NOT EXISTS idx_clients_office_name ON public.clients (office_id, name);
CREATE INDEX IF NOT EXISTS idx_cases_fts ON public.cases USING GIN (fts);

-- ==============================================================================
-- 8. STORAGE (BUCKETS)
-- ==============================================================================

-- Criar bucket 'documents' privado
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents', 'documents', FALSE, 52428800, 
  ARRAY['image/png','image/jpeg','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain']
) ON CONFLICT (id) DO UPDATE SET public = FALSE;

-- Política de Storage (Isolamento por pasta = office_id)
DROP POLICY IF EXISTS "Office Isolation Policy" ON storage.objects;
CREATE POLICY "Office Isolation Policy" ON storage.objects
FOR ALL USING (
  bucket_id = 'documents' 
  AND auth.role() = 'authenticated' 
  AND public.check_is_member((storage.foldername(name))[1]::uuid)
);

-- ==============================================================================
-- 9. CORREÇÃO DE INTEGRIDADE (Recuperação de Órfãos Auth)
-- ==============================================================================
INSERT INTO public.profiles (id, email, full_name, username)
SELECT 
  id, 
  email, 
  COALESCE(raw_user_meta_data->>'full_name', 'Usuário Recuperado'),
  COALESCE(raw_user_meta_data->>'username', '@user_' || substr(id::text, 1, 8))
FROM auth.users
ON CONFLICT (id) DO NOTHING;
```
