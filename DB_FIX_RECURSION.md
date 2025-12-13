
# Correção Crítica: Recursão Infinita em RLS (Erro 500)

Execute este script no **SQL Editor** do Supabase para corrigir o erro de "infinite recursion" ao criar escritórios e usuários.

Este script é **idempotente**: ele remove as políticas antigas antes de criar as novas, evitando erros de "Policy already exists".

```sql
BEGIN;

-- ============================================================
-- 1. REMOVER POLÍTICAS ANTIGAS (CLEANUP)
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

-- ============================================================
-- 2. RECRIAR FUNÇÃO DE SEGURANÇA (SECURITY DEFINER)
-- ============================================================
-- Esta função é CRUCIAL. Ela roda com privilégios de admin (bypassing RLS)
-- para verificar afiliação sem causar loop infinito.

CREATE OR REPLACE FUNCTION public.check_is_member(_office_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER -- Ignora RLS ao executar
SET search_path = public, extensions, temp -- Segurança contra hijacking
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
-- 3. RECRIAR POLÍTICAS DA TABELA OFFICES
-- ============================================================

-- Leitura: Dono OU Membro Ativo
CREATE POLICY "View offices" ON public.offices
FOR SELECT USING (
  owner_id = (select auth.uid()) 
  OR 
  public.check_is_member(id)
);

-- Criação: Qualquer usuário autenticado pode criar um escritório
CREATE POLICY "Create offices" ON public.offices 
FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Atualização: Apenas o dono
CREATE POLICY "Update offices" ON public.offices 
FOR UPDATE USING (auth.uid() = owner_id);


-- ============================================================
-- 4. RECRIAR POLÍTICAS DA TABELA OFFICE_MEMBERS
-- ============================================================

-- Leitura: Ver a si mesmo, ver se é dono do escritório, ou ver colegas (se for membro ativo)
CREATE POLICY "View members" ON public.office_members
FOR SELECT USING (
  user_id = (select auth.uid()) -- Ver meu próprio registro (fundamental para o primeiro load)
  OR
  EXISTS (SELECT 1 FROM public.offices WHERE id = office_id AND owner_id = (select auth.uid())) -- Dono vê tudo
  OR
  public.check_is_member(office_id) -- Membros ativos veem colegas
);

-- Gestão Total (Update/Delete): Apenas Dono ou Admin
CREATE POLICY "Manage members" ON public.office_members
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.offices WHERE id = office_id AND owner_id = (select auth.uid()))
  OR
  (public.check_is_member(office_id) AND role = 'Admin')
);

-- Inserção (Join Requests): 
-- 1. Usuário pode se inserir (Join Request)
-- 2. Dono pode inserir membros diretamente
CREATE POLICY "Join requests" ON public.office_members
FOR INSERT WITH CHECK (
  user_id = (select auth.uid()) 
  OR 
  EXISTS (SELECT 1 FROM public.offices WHERE id = office_id AND owner_id = (select auth.uid()))
);

COMMIT;
```