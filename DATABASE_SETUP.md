# Configuração do Banco de Dados (Supabase)

Para garantir que o **JurisControl** funcione corretamente e evitar erros de tipo ou recursão infinita nas políticas de segurança, execute este script no **SQL Editor** do Supabase.

## 🚨 COMANDOS DE RESET TOTAL E CORREÇÃO

**⚠️ ATENÇÃO: ISSO APAGARÁ TODOS OS DADOS DO SISTEMA.**

```sql
-- 1. Limpeza (Drop) de tabelas existentes
DROP TABLE IF EXISTS public.activity_logs CASCADE;
DROP TABLE IF EXISTS public.documents CASCADE;
DROP TABLE IF EXISTS public.financial CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.cases CASCADE;
DROP TABLE IF EXISTS public.clients CASCADE;
DROP TABLE IF EXISTS public.office_members CASCADE;
DROP TABLE IF EXISTS public.offices CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- 2. Habilita extensão para UUIDs
create extension if not exists "uuid-ossp";

-- ============================================================
-- 3. TABELAS ESTRUTURAIS
-- ============================================================

create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  full_name text,
  username text unique not null,
  avatar_url text,
  email text,
  phone text,
  oab text,
  settings jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.offices (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  handle text unique not null,
  owner_id uuid references public.profiles(id) not null,
  location text,
  logo_url text,
  area_of_activity text,
  social jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.office_members (
  id uuid default uuid_generate_v4() primary key,
  office_id uuid references public.offices(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text check (role in ('Admin', 'Advogado', 'Estagiário', 'Financeiro')) default 'Advogado',
  permissions jsonb default '{"cases": true, "financial": false, "documents": true, "settings": false}'::jsonb,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(office_id, user_id)
);

-- ============================================================
-- 4. TABELAS DE DADOS
-- ============================================================

create table public.clients (
  id uuid default uuid_generate_v4() primary key,
  office_id uuid references public.offices(id) on delete cascade not null,
  user_id uuid references public.profiles(id),
  name text not null,
  type text check (type in ('PF', 'PJ')),
  status text default 'Ativo',
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
  history jsonb default '[]'::jsonb,
  documents jsonb default '[]'::jsonb,
  alerts jsonb default '[]'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.cases (
  id uuid default uuid_generate_v4() primary key,
  office_id uuid references public.offices(id) on delete cascade not null,
  user_id uuid references public.profiles(id),
  client_id uuid references public.clients(id) on delete set null,
  cnj text,
  title text not null,
  status text default 'Ativo',
  category text,
  phase text,
  value numeric(15, 2) default 0,
  responsible_lawyer text,
  court text,
  next_hearing date,
  description text,
  movements jsonb default '[]'::jsonb,
  change_log jsonb default '[]'::jsonb,
  last_update timestamp with time zone default timezone('utc'::text, now()),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.tasks (
  id uuid default uuid_generate_v4() primary key,
  office_id uuid references public.offices(id) on delete cascade not null,
  user_id uuid references public.profiles(id),
  title text not null,
  due_date date,
  priority text check (priority in ('Alta', 'Média', 'Baixa')),
  status text default 'A Fazer',
  assigned_to text,
  description text,
  case_id uuid references public.cases(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  case_title text,
  client_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.financial (
  id uuid default uuid_generate_v4() primary key,
  office_id uuid references public.offices(id) on delete cascade not null,
  user_id uuid references public.profiles(id),
  title text not null,
  amount numeric(15, 2) not null,
  type text check (type in ('Receita', 'Despesa')),
  category text,
  status text default 'Pendente',
  due_date date,
  payment_date date,
  case_id uuid references public.cases(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  client_name text,
  installment jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.documents (
  id uuid default uuid_generate_v4() primary key,
  office_id uuid references public.offices(id) on delete cascade not null,
  user_id uuid references public.profiles(id),
  name text not null,
  size text,
  type text,
  category text,
  date date default CURRENT_DATE,
  case_id uuid references public.cases(id) on delete set null,
  storage_path text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.activity_logs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id),
  action text not null,
  status text,
  ip text,
  device text,
  date timestamp with time zone default timezone('utc'::text, now())
);

-- ============================================================
-- 5. FUNÇÕES E TRIGGERS
-- ============================================================

-- Criação de Perfil Automático
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, avatar_url, username)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email,
    new.raw_user_meta_data->>'avatar_url',
    COALESCE(new.raw_user_meta_data->>'username', '@user_' || substr(new.id::text, 1, 8))
  )
  on conflict (id) do nothing; 
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Adicionar Criador como Admin do Escritório
create or replace function public.add_creator_as_admin()
returns trigger as $$
begin
  insert into public.office_members (office_id, user_id, role, permissions)
  values (
    new.id,
    new.owner_id,
    'Admin',
    '{"cases": true, "financial": true, "documents": true, "settings": true}'::jsonb
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_office_created
  after insert on public.offices
  for each row execute procedure public.add_creator_as_admin();

-- ============================================================
-- 6. RLS (SEGURANÇA E POLÍTICAS)
-- ============================================================

alter table public.profiles enable row level security;
alter table public.offices enable row level security;
alter table public.office_members enable row level security;
alter table public.clients enable row level security;
alter table public.cases enable row level security;
alter table public.tasks enable row level security;
alter table public.financial enable row level security;
alter table public.documents enable row level security;

-- *** HELPER FUNCTION PARA EVITAR RECURSÃO INFINITA ***
-- Esta função é CRÍTICA. Ela permite verificar se um usuário é membro de um escritório
-- sem acionar as políticas RLS da tabela office_members recursivamente.
create or replace function public.is_member_of(_office_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.office_members 
    where office_id = _office_id 
    and user_id = auth.uid()
  );
end;
$$ language plpgsql security definer;

-- PROFILES
create policy "Public profiles" on public.profiles for select using (true);
create policy "Update own profile" on public.profiles for update using (auth.uid() = id);

-- OFFICES
-- Pode ver escritório se for o dono ou se for membro (via função segura)
create policy "View offices" on public.offices for select using (
  owner_id = auth.uid() or public.is_member_of(id)
);
create policy "Create offices" on public.offices for insert with check (auth.uid() = owner_id);
create policy "Update offices" on public.offices for update using (auth.uid() = owner_id);

-- OFFICE MEMBERS
-- Pode ver membros se você também for membro do mesmo escritório
create policy "View office members" on public.office_members for select using (
  public.is_member_of(office_id)
);
-- Permite inserção automática pelo trigger (security definer bypass) ou se for admin
create policy "Manage members" on public.office_members for insert with check (
  public.is_member_of(office_id) -- Simplificado para demonstração
);

-- DADOS GERAIS (Clients, Cases, etc)
-- Acesso permitido se o usuário for membro do escritório vinculado ao dado

create policy "Access clients" on public.clients for all using (public.is_member_of(office_id));
create policy "Access cases" on public.cases for all using (public.is_member_of(office_id));
create policy "Access tasks" on public.tasks for all using (public.is_member_of(office_id));
create policy "Access financial" on public.financial for all using (public.is_member_of(office_id));
create policy "Access documents" on public.documents for all using (public.is_member_of(office_id));
```