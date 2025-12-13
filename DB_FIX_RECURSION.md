
# Correção Crítica: Recursão Infinita em RLS (Erro 500)

Execute este script no **SQL Editor** do Supabase para corrigir o erro de "infinite recursion" ao criar escritórios.

Este script substitui as políticas de segurança problemáticas por versões otimizadas que utilizam uma função segura (`SECURITY DEFINER`) para quebrar o ciclo de verificação.

```sql
BEGIN;

-- 1. Remover políticas antigas que causam conflito ou recursão
DROP POLICY IF EXISTS "View offices" ON public.offices;
DROP POLICY IF EXISTS "Offices view" ON public.offices;
DROP POLICY IF EXISTS "View members" ON public.office_members;
DROP POLICY IF EXISTS "Members view" ON public.office_members;
DROP POLICY IF EXISTS "Manage members" ON public.office_members;
DROP POLICY IF EXISTS "Members manage" ON public.office_members;
DROP POLICY IF EXISTS "View team members" ON public.office_members;
DROP POLICY IF EXISTS "Manage team members" ON public.office_members;
DROP POLICY IF EXISTS "Join requests" ON public.office_members; -- Correção: Remove política pré-existente

-- 2. Recriar a função de verificação como SECURITY DEFINER
-- Isso é CRUCIAL: A função roda com privilégios de "admin" (postgres),
-- ignorando o RLS da tabela office_members para evitar o loop infinito.
CREATE OR REPLACE FUNCTION public.check_is_member(_office_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER -- Ignora RLS ao executar
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

-- 3. Recriar Políticas da Tabela OFFICES
-- Agora usa a função segura check_is_member()
CREATE POLICY "View offices" ON public.offices
FOR SELECT USING (
  owner_id = (select auth.uid()) 
  OR 
  public.check_is_member(id)
);

-- Assegurar permissões de escrita em Offices
DROP POLICY IF EXISTS "Create offices" ON public.offices;
CREATE POLICY "Create offices" ON public.offices FOR INSERT WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Update offices" ON public.offices;
CREATE POLICY "Update offices" ON public.offices FOR UPDATE USING (auth.uid() = owner_id);


-- 4. Recriar Políticas da Tabela OFFICE_MEMBERS
-- Quebra a recursão permitindo ver: a si mesmo, ou se for dono, ou se for colega (via função segura)

CREATE POLICY "View members" ON public.office_members
FOR SELECT USING (
  -- Posso ver meu próprio registro (necessário para o primeiro load)
  user_id = (select auth.uid()) 
  OR
  -- Posso ver se sou o dono do escritório (sem join recursivo com members)
  EXISTS (SELECT 1 FROM public.offices WHERE id = office_id AND owner_id = (select auth.uid()))
  OR
  -- Posso ver se já sou um membro ativo (usando função segura)
  public.check_is_member(office_id)
);

CREATE POLICY "Manage members" ON public.office_members
FOR ALL USING (
  -- Apenas Dono ou Admin podem gerenciar
  EXISTS (SELECT 1 FROM public.offices WHERE id = office_id AND owner_id = (select auth.uid()))
  OR
  (public.check_is_member(office_id) AND role = 'Admin')
);

-- Permite criar solicitação de entrada (Join)
CREATE POLICY "Join requests" ON public.office_members
FOR INSERT WITH CHECK (
  user_id = (select auth.uid()) -- Auto-inserção
  OR 
  EXISTS (SELECT 1 FROM public.offices WHERE id = office_id AND owner_id = (select auth.uid())) -- Dono inserindo
);

COMMIT;
```