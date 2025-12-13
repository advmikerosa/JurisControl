
# Correção Crítica: Recursão Infinita (Infinite Recursion Fix)

Este erro (`infinite recursion detected in policy`) ocorre quando uma política de segurança tenta ler a própria tabela que está protegendo, criando um loop.

Execute este script COMPLETO no **SQL Editor** do Supabase para corrigir as permissões.

## O que este script faz:
1. Limpa todas as políticas antigas de `offices` e `office_members`.
2. Cria uma função segura (`check_is_member`) que ignora RLS (Security Definer) para quebrar o loop.
3. Reaplica as políticas usando esta função segura.

```sql
BEGIN;

-- ============================================================
-- 1. LIMPEZA TOTAL DE POLÍTICAS (Para evitar conflitos)
-- ============================================================

-- Tabela: Offices
DROP POLICY IF EXISTS "View offices" ON public.offices;
DROP POLICY IF EXISTS "Offices view" ON public.offices;
DROP POLICY IF EXISTS "Create offices" ON public.offices;
DROP POLICY IF EXISTS "Offices create" ON public.offices;
DROP POLICY IF EXISTS "Update offices" ON public.offices;
DROP POLICY IF EXISTS "Offices update" ON public.offices;

-- Tabela: Office Members
DROP POLICY IF EXISTS "View members" ON public.office_members;
DROP POLICY IF EXISTS "Members view" ON public.office_members;
DROP POLICY IF EXISTS "Manage members" ON public.office_members;
DROP POLICY IF EXISTS "Members manage" ON public.office_members;
DROP POLICY IF EXISTS "View team members" ON public.office_members;
DROP POLICY IF EXISTS "Manage team members" ON public.office_members;
DROP POLICY IF EXISTS "Join requests" ON public.office_members;
DROP POLICY IF EXISTS "Create join request" ON public.office_members;

-- Tabela: Profiles (Correção do erro 406)
DROP POLICY IF EXISTS "Profiles viewable" ON public.profiles;
DROP POLICY IF EXISTS "Public Profiles Access" ON public.profiles;

-- ============================================================
-- 2. FUNÇÃO DE SEGURANÇA (SECURITY DEFINER)
-- ============================================================
-- Esta função roda com privilégios de "postgres" (admin), 
-- permitindo checar membresia sem acionar o RLS novamente.

CREATE OR REPLACE FUNCTION public.check_is_member(_office_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER -- CRÍTICO: Executa sem RLS
SET search_path = public, extensions, temp -- Segurança
AS $$
BEGIN
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

-- Quem pode criar? Qualquer usuário logado.
CREATE POLICY "Create offices" ON public.offices 
FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Quem pode editar? Apenas o dono.
CREATE POLICY "Update offices" ON public.offices 
FOR UPDATE USING (auth.uid() = owner_id);


-- ============================================================
-- 4. RECRIAR POLÍTICAS (OFFICE_MEMBERS)
-- ============================================================

-- Quem pode ver membros?
-- 1. O próprio usuário (para ver seu status pendente)
-- 2. O Dono do escritório
-- 3. Colegas de trabalho (Membros ativos)
CREATE POLICY "View members" ON public.office_members
FOR SELECT USING (
  user_id = (select auth.uid()) -- Ver a si mesmo
  OR
  EXISTS (SELECT 1 FROM public.offices WHERE id = office_id AND owner_id = (select auth.uid())) -- Dono
  OR
  public.check_is_member(office_id) -- Colegas
);

-- Quem pode gerenciar (Update/Delete)?
-- Apenas Dono ou Admin
CREATE POLICY "Manage members" ON public.office_members
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.offices WHERE id = office_id AND owner_id = (select auth.uid()))
  OR
  (public.check_is_member(office_id) AND role = 'Admin')
);

-- Quem pode entrar (Insert)?
-- 1. O próprio usuário (Solicitação de entrada)
-- 2. O Dono (Adicionando alguém)
CREATE POLICY "Join requests" ON public.office_members
FOR INSERT WITH CHECK (
  user_id = (select auth.uid()) 
  OR 
  EXISTS (SELECT 1 FROM public.offices WHERE id = office_id AND owner_id = (select auth.uid()))
);

-- ============================================================
-- 5. RECRIAR POLÍTICAS (PROFILES)
-- ============================================================
-- Resolve o erro 406 ao tentar carregar o perfil do usuário

CREATE POLICY "Profiles viewable" ON public.profiles
FOR SELECT USING (true);

CREATE POLICY "Profiles update own" ON public.profiles
FOR UPDATE USING (id = (select auth.uid()));

CREATE POLICY "Profiles insert own" ON public.profiles
FOR INSERT WITH CHECK (id = (select auth.uid()));

COMMIT;
```
