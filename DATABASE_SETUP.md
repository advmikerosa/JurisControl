# Configuração do Banco de Dados (Supabase)

Para que o **JurisControl** funcione corretamente em modo de produção, você precisa configurar o banco de dados no Supabase.

## 🚨 COMANDOS DE LIMPEZA (HARD RESET)

Se você precisa limpar **todos** os dados do banco para recomeçar do zero (mantendo a estrutura das tabelas), execute o script abaixo no SQL Editor do Supabase.

**⚠️ ATENÇÃO: ISSO APAGARÁ TODOS OS CLIENTES, PROCESSOS E DADOS FINANCEIROS.**

```sql
-- Limpa dados de todas as tabelas em ordem de dependência
TRUNCATE TABLE 
  public.activity_logs,
  public.documents,
  public.financial,
  public.tasks,
  public.movements, -- Se existir tabela separada
  public.cases,
  public.clients,
  public.office_members,
  public.offices,
  public.profiles
RESTART IDENTITY CASCADE;

-- Opcional: Se quiser remover usuários da autenticação (Requer privilégio de admin do Supabase)
-- delete from auth.users;
```

---

## Instruções de Instalação

1. Acesse o painel do seu projeto no [Supabase](https://supabase.com/dashboard).
2. Vá para a seção **SQL Editor** (ícone de terminal na barra lateral esquerda).
3. Clique em **New Query**.
4. Copie todo o código SQL abaixo e cole no editor.
5. Clique em **Run**.

---

## Script SQL Estrutural (Idempotente)

Este script cria a estrutura necessária com suporte a Handles Únicos.

```sql
-- Habilita extensão para UUIDs
create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. TABELAS ESTRUTURAIS (Usuários e Escritórios)
-- ============================================================

-- Tabela Pública de Perfis (Espelho de auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  full_name text,
  username text unique not null, -- Handle único do usuário (ex: @drjoao)
  avatar_url text,
  email text,
  phone text,
  oab text,
  settings jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Tabela de Escritórios
create table if not exists public.offices (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  handle text unique not null, -- Handle único do escritório (ex: @silva_adv)
  owner_id uuid references public.profiles(id) not null,
  location text,
  logo_url text,
  area_of_activity text,
  social jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Tabela de Membros do Escritório (Junção User <-> Office)
create table if not exists public.office_members (
  id uuid default uuid_generate_v4() primary key,
  office_id uuid references public.offices(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text check (role in ('Admin', 'Advogado', 'Estagiário', 'Financeiro')) default 'Advogado',
  permissions jsonb default '{"cases": true, "financial": false, "documents": true, "settings": false}'::jsonb,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(office_id, user_id)
);

-- ============================================================
-- 2. TABELAS DE DADOS (Clientes, Processos, etc.)
-- ============================================================

-- Clientes
create table if not exists public.clients (
  id uuid default uuid_generate_v4() primary key,
  office_id uuid references public.offices(id) on delete cascade not null,
  user_id uuid references public.profiles(id), -- Quem cadastrou
  name text not null,
  type text check (type in ('PF', 'PJ')),
  status text default 'Ativo',
  email text,
  phone text,
  avatar_url text,
  
  -- Endereço
  address text,
  city text,
  state text,
  
  -- Dados Específicos
  cpf text,
  rg text,
  cnpj text,
  corporate_name text,
  
  notes text,
  tags text[], -- Array de strings
  
  -- Campos JSON para estruturas complexas ou futuras
  history jsonb default '[]'::jsonb,
  documents jsonb default '[]'::jsonb,
  alerts jsonb default '[]'::jsonb,
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Processos (Legal Cases)
create table if not exists public.cases (
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

-- Tarefas (Tasks)
create table if not exists public.tasks (
  id uuid default uuid_generate_v4() primary key,
  office_id uuid references public.offices(id) on delete cascade not null,
  user_id uuid references public.profiles(id),
  
  title text not null,
  due_date date,
  priority text check (priority in ('Alta', 'Média', 'Baixa')),
  status text default 'A Fazer',
  assigned_to text,
  description text,
  
  -- Vínculos Opcionais
  case_id uuid references public.cases(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  
  -- Cache de nomes para evitar joins complexos em listas simples
  case_title text,
  client_name text,
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Financeiro
create table if not exists public.financial (
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
  installment jsonb, -- { current: 1, total: 12 }
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Documentos do Sistema
create table if not exists public.documents (
  id uuid default uuid_generate_v4() primary key,
  office_id uuid references public.offices(id) on delete cascade not null,
  user_id uuid references public.profiles(id),
  
  name text not null,
  size text,
  type text,
  category text,
  date date default CURRENT_DATE,
  
  case_id uuid references public.cases(id) on delete set null,
  
  storage_path text, -- Para integração com Supabase Storage
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Logs de Atividade
create table if not exists public.activity_logs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id),
  action text not null,
  status text,
  ip text,
  device text,
  date timestamp with time zone default timezone('utc'::text, now())
);

-- ============================================================
-- 3. TRIGGERS E FUNÇÕES (Automação)
-- ============================================================

-- Função para lidar com novo usuário cadastrado no Auth
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, avatar_url, username)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email,
    new.raw_user_meta_data->>'avatar_url',
    -- Fallback se username não vier
    COALESCE(new.raw_user_meta_data->>'username', '@user_' || substr(new.id::text, 1, 8))
  )
  on conflict (id) do nothing; 
  return new;
end;
$$ language plpgsql security definer;

-- Trigger para criar Profile ao criar User
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Função para adicionar o criador do escritório como membro Admin
create or replace function public.add_creator_as_admin()
returns trigger as $$
begin
  insert into public.office_members (office_id, user_id, role, permissions)
  values (
    new.id,
    new.owner_id,
    'Admin',
    '{"cases": true, "financial": true, "documents": true, "settings": true}'::jsonb
  )
  on conflict (office_id, user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Trigger para Office Members
drop trigger if exists on_office_created on public.offices;
create trigger on_office_created
  after insert on public.offices
  for each row execute procedure public.add_creator_as_admin();

-- ============================================================
-- 4. ROW LEVEL SECURITY (Segurança)
-- ============================================================

-- Habilitar RLS em todas as tabelas
alter table public.profiles enable row level security;
alter table public.offices enable row level security;
alter table public.office_members enable row level security;
alter table public.clients enable row level security;
alter table public.cases enable row level security;
alter table public.tasks enable row level security;
alter table public.financial enable row level security;
alter table public.documents enable row level security;

-- PROFILES
create policy "Public profiles are viewable by everyone" on public.profiles for select using ( true );
create policy "Users can update own profile" on public.profiles for update using ( auth.uid() = id );

-- OFFICES
create policy "Offices are viewable by members or by handle" on public.offices for select using (
    auth.uid() in (select user_id from public.office_members where office_id = id)
    or true -- Permite ver dados públicos do escritório (como nome/handle) para join
);
create policy "Owners can update offices" on public.offices for update using ( auth.uid() = owner_id );
create policy "Users can create offices" on public.offices for insert with check ( auth.uid() = owner_id );

-- OFFICE MEMBERS
create policy "Members can view other members" on public.office_members for select using (
    auth.uid() in (select user_id from public.office_members as om where om.office_id = office_id)
);
create policy "Users can join offices" on public.office_members for insert with check ( auth.uid() = user_id );

-- DADOS (Clients, Cases, Tasks, Financial, Documents)
-- Política padrão: Acesso apenas se o usuário for membro do escritório vinculado ao dado

create policy "Access clients from my offices" on public.clients for all using (
    exists (select 1 from public.office_members where office_id = public.clients.office_id and user_id = auth.uid())
);

create policy "Access cases from my offices" on public.cases for all using (
    exists (select 1 from public.office_members where office_id = public.cases.office_id and user_id = auth.uid())
);

create policy "Access tasks from my offices" on public.tasks for all using (
    exists (select 1 from public.office_members where office_id = public.tasks.office_id and user_id = auth.uid())
);

create policy "Access financial from my offices" on public.financial for all using (
    exists (select 1 from public.office_members where office_id = public.financial.office_id and user_id = auth.uid())
);

create policy "Access documents from my offices" on public.documents for all using (
    exists (select 1 from public.office_members where office_id = public.documents.office_id and user_id = auth.uid())
);
