# Configuração do Banco de Dados (Supabase)

Copie o código SQL abaixo e cole no **SQL Editor** do seu painel Supabase para configurar todo o sistema.

Este script é **idempotente** (pode ser rodado múltiplas vezes, pois ele limpa as versões anteriores antes de criar).

```sql
-- ============================================================
-- 1. LIMPEZA (RESET)
-- CUIDADO: Isso apaga dados existentes nas tabelas do app
-- ============================================================

-- Remover triggers de tabelas de sistema primeiro para evitar conflitos
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Remover funções com CASCADE para apagar triggers dependentes automaticamente
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.add_creator_as_admin() CASCADE;
DROP FUNCTION IF EXISTS public.check_is_member(uuid) CASCADE;

-- Remover tabelas (ordem reversa de dependência)
DROP TABLE IF EXISTS public.activity_logs CASCADE;
DROP TABLE IF EXISTS public.documents CASCADE;
DROP TABLE IF EXISTS public.financial CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.cases CASCADE;
DROP TABLE IF EXISTS public.clients CASCADE;
DROP TABLE IF EXISTS public.office_members CASCADE;
DROP TABLE IF EXISTS public.offices CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Habilita extensão para gerar UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 2. TABELAS ESTRUTURAIS
-- ============================================================

-- Perfis de Usuário (Espelho do auth.users)
CREATE TABLE public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
  full_name text,
  username text,
  avatar_url text,
  email text,
  phone text,
  oab text,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Escritórios
CREATE TABLE public.offices (
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

-- Membros do Escritório (Tabela de Junção)
CREATE TABLE public.office_members (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  office_id uuid REFERENCES public.offices(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role text CHECK (role IN ('Admin', 'Advogado', 'Estagiário', 'Financeiro')) DEFAULT 'Advogado',
  permissions jsonb DEFAULT '{"cases": true, "financial": false, "documents": true, "settings": false}'::jsonb,
  joined_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(office_id, user_id)
);

-- ============================================================
-- 3. TABELAS DE DADOS (Tenancy via office_id)
-- ============================================================

-- Clientes
CREATE TABLE public.clients (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  office_id uuid REFERENCES public.offices(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id), -- Quem criou
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
  history jsonb DEFAULT '[]'::jsonb,
  documents jsonb DEFAULT '[]'::jsonb,
  alerts jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Processos
CREATE TABLE public.cases (
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
  movements jsonb DEFAULT '[]'::jsonb,
  change_log jsonb DEFAULT '[]'::jsonb,
  last_update timestamp with time zone DEFAULT timezone('utc'::text, now()),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tarefas
CREATE TABLE public.tasks (
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
  case_title text,
  client_name text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Financeiro
CREATE TABLE public.financial (
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

-- Documentos
CREATE TABLE public.documents (
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

-- Logs de Atividade
CREATE TABLE public.activity_logs (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id),
  action text NOT NULL,
  status text,
  ip text,
  device text,
  date timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- ============================================================
-- 4. FUNÇÕES DE SUPORTE E TRIGGERS
-- ============================================================

-- Função para Criar Perfil automaticamente ao criar usuário no Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Função para adicionar o Criador do Escritório como Admin automaticamente
CREATE OR REPLACE FUNCTION public.add_creator_as_admin()
RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_office_created
  AFTER INSERT ON public.offices
  FOR EACH ROW EXECUTE PROCEDURE public.add_creator_as_admin();

-- ============================================================
-- 5. POLÍTICAS DE SEGURANÇA (RLS)
-- ============================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- FUNÇÃO CRÍTICA: check_is_member
-- Usamos SECURITY DEFINER para que esta função possa ler a tabela office_members
-- sem acionar as políticas de RLS dessa mesma tabela (evitando recursão infinita).
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

-- --- Profiles ---
-- Qualquer usuário autenticado pode ler perfis básicos (necessário para UI de equipe)
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
-- Usuário só edita o próprio perfil
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- --- Offices ---
-- Ver escritório se for dono OU membro
CREATE POLICY "View offices" ON public.offices FOR SELECT USING (
  owner_id = auth.uid() OR public.check_is_member(id)
);
-- Criar escritório (qualquer um autenticado)
CREATE POLICY "Create offices" ON public.offices FOR INSERT WITH CHECK (auth.uid() = owner_id);
-- Atualizar escritório (apenas dono - ou expandir para admins depois)
CREATE POLICY "Update offices" ON public.offices FOR UPDATE USING (auth.uid() = owner_id);

-- --- Office Members ---
-- Ver membros: Se eu sou membro do escritório, posso ver quem mais é.
CREATE POLICY "View members" ON public.office_members FOR SELECT USING (
  public.check_is_member(office_id)
);
-- Adicionar membros: Se eu sou admin (simplificado aqui para: se eu sou membro, posso convidar por enquanto)
-- Em produção, você checaria o 'role' dentro da função check_is_member
CREATE POLICY "Manage members" ON public.office_members FOR ALL USING (
  public.check_is_member(office_id)
);

-- --- Dados (Clients, Cases, Tasks, Financial, Docs) ---
-- Política padrão: Acesso permitido se o usuário for membro do escritório vinculado ao dado.

CREATE POLICY "Access Clients" ON public.clients FOR ALL USING (public.check_is_member(office_id));
CREATE POLICY "Access Cases" ON public.cases FOR ALL USING (public.check_is_member(office_id));
CREATE POLICY "Access Tasks" ON public.tasks FOR ALL USING (public.check_is_member(office_id));
CREATE POLICY "Access Financial" ON public.financial FOR ALL USING (public.check_is_member(office_id));
CREATE POLICY "Access Documents" ON public.documents FOR ALL USING (public.check_is_member(office_id));

```