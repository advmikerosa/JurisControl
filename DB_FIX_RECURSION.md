
# Correção Definitiva: Recursão Infinita e Políticas

Este script resolve os erros `42P17` (Infinite Recursion), `500` (Internal Error) e `42710` (Policy exists).

Execute este script no **SQL Editor** do Supabase.

## O que este script faz:
1.  Remove forçadamente TODAS as políticas relacionadas a escritórios e membros para garantir um estado limpo.
2.  Recria a função de segurança crítica `check_is_member` com privilégios de sistema para evitar o loop de verificação.
3.  Reaplica as políticas de segurança corretas.

```sql
BEGIN;

-- ============================================================
-- 1. LIMPEZA SEGURA DE POLÍTICAS (DROP ALL)
-- ============================================================

-- Tabela: OFFICES
DROP POLICY IF EXISTS "View offices" ON public.offices;
DROP POLICY IF EXISTS "Offices view" ON public.offices;
DROP POLICY IF EXISTS "Offices select" ON public.offices;
DROP POLICY IF EXISTS "Create offices" ON public.offices;
DROP POLICY IF EXISTS "Offices create" ON public.offices;
DROP POLICY IF EXISTS "Offices insert" ON public.offices;
DROP POLICY IF EXISTS "Update offices" ON public.offices;
DROP POLICY IF EXISTS "Offices update" ON public.offices;
DROP POLICY IF EXISTS "Delete offices" ON public.offices;

-- Tabela: OFFICE_MEMBERS
DROP POLICY IF EXISTS "View members" ON public.office_members;
DROP POLICY IF EXISTS "Members view" ON public.office_members;
DROP POLICY IF EXISTS "Select members" ON public.office_members;
DROP POLICY IF EXISTS "Manage members" ON public.office_members;
DROP POLICY IF EXISTS "Members manage" ON public.office_members;
DROP POLICY IF EXISTS "View team members" ON public.office_members;
DROP POLICY IF EXISTS "Manage team members" ON public.office_members;
DROP POLICY IF EXISTS "Join requests" ON public.office_members;
DROP POLICY IF EXISTS "Create join request" ON public.office_members;

-- Tabela: PROFILES (Causa do erro 406/42710)
DROP POLICY IF EXISTS "Profiles viewable" ON public.profiles;
DROP POLICY IF EXISTS "Public Profiles Access" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update own" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Profiles insert own" ON public.profiles;
DROP POLICY IF EXISTS "Insert Own Profile" ON public.profiles;

-- ============================================================
-- 2. FUNÇÃO DE SEGURANÇA (SECURITY DEFINER)
-- ============================================================
-- Esta função é o segredo para evitar a recursão. Ela roda como admin/postgres.

CREATE OR REPLACE FUNCTION public.check_is_member(_office_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER -- Executa sem checar RLS novamente
SET search_path = public, extensions, temp
AS $$
BEGIN
  -- Verifica se o usuário atual (auth.uid()) está na lista de membros do escritório
  RETURN EXISTS (
    SELECT 1 
    FROM public.office_members 
    WHERE office_id = _office_id 
    AND user_id = (select auth.uid())
    AND status = 'active'
  );
END;
$$;

-- ============================================================
-- 3. RECRIAR POLÍTICAS (OFFICES)
-- ============================================================

-- Quem pode ver escritórios? 
-- 1. O Dono
-- 2. Membros ativos (usando a função segura)
CREATE POLICY "View offices" ON public.offices
FOR SELECT USING (
  owner_id = (select auth.uid()) 
  OR 
  public.check_is_member(id)
);

-- Quem pode criar? Qualquer usuário autenticado.
CREATE POLICY "Create offices" ON public.offices 
FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Quem pode editar? Apenas o dono.
CREATE POLICY "Update offices" ON public.offices 
FOR UPDATE USING (auth.uid() = owner_id);

-- ============================================================
-- 4. RECRIAR POLÍTICAS (OFFICE_MEMBERS)
-- ============================================================

-- Quem pode ver a lista de membros?
-- 1. O próprio usuário (ver sua própria linha)
-- 2. O dono do escritório
-- 3. Colegas de trabalho (membros ativos)
CREATE POLICY "View members" ON public.office_members
FOR SELECT USING (
  user_id = (select auth.uid()) -- Ver a si mesmo
  OR
  EXISTS (SELECT 1 FROM public.offices WHERE id = office_id AND owner_id = (select auth.uid())) -- Dono
  OR
  public.check_is_member(office_id) -- Colegas
);

-- Quem pode gerenciar (Adicionar/Remover/Editar)?
-- Apenas Dono ou Admin
CREATE POLICY "Manage members" ON public.office_members
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.offices WHERE id = office_id AND owner_id = (select auth.uid()))
  OR
  (public.check_is_member(office_id) AND role = 'Admin')
);

-- Quem pode entrar (Solicitação)?
-- O próprio usuário pode criar uma solicitação 'pending'
CREATE POLICY "Join requests" ON public.office_members
FOR INSERT WITH CHECK (
  user_id = (select auth.uid()) 
);

-- ============================================================
-- 5. RECRIAR POLÍTICAS (PROFILES)
-- ============================================================

-- Leitura pública para que usuários possam ver nomes uns dos outros
CREATE POLICY "Profiles viewable" ON public.profiles
FOR SELECT USING (true);

-- Edição apenas do próprio perfil
CREATE POLICY "Profiles update own" ON public.profiles
FOR UPDATE USING (id = (select auth.uid()));

-- Inserção apenas do próprio perfil (Trigger geralmente faz isso, mas deixamos como backup)
CREATE POLICY "Profiles insert own" ON public.profiles
FOR INSERT WITH CHECK (id = (select auth.uid()));

COMMIT;
```
