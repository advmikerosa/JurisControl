
# Correção Definitiva: Recursão Infinita e Políticas Duplicadas

Este script resolve os erros:
1. `42710`: Policy already exists (Limpeza prévia).
2. `42P17`: Infinite recursion (Uso de SECURITY DEFINER).
3. `406`: Not Acceptable (Erro colateral da recursão).

Execute este script no **SQL Editor** do Supabase.

```sql
BEGIN;

-- ============================================================
-- 1. LIMPEZA TOTAL DE POLÍTICAS (DROP ALL)
-- Removemos todas as variações de nomes para evitar o erro 42710
-- ============================================================

-- Tabela: PROFILES
DROP POLICY IF EXISTS "Profiles viewable" ON public.profiles;
DROP POLICY IF EXISTS "Public Profiles Access" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update own" ON public.profiles;
DROP POLICY IF EXISTS "Profiles editable own" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Profiles insert own" ON public.profiles;
DROP POLICY IF EXISTS "Insert Own Profile" ON public.profiles;

-- Tabela: OFFICES
DROP POLICY IF EXISTS "View offices" ON public.offices;
DROP POLICY IF EXISTS "Offices view" ON public.offices;
DROP POLICY IF EXISTS "Offices select" ON public.offices;
DROP POLICY IF EXISTS "Create offices" ON public.offices;
DROP POLICY IF EXISTS "Offices create" ON public.offices;
DROP POLICY IF EXISTS "Update offices" ON public.offices;
DROP POLICY IF EXISTS "Offices update" ON public.offices;

-- Tabela: OFFICE_MEMBERS
DROP POLICY IF EXISTS "View members" ON public.office_members;
DROP POLICY IF EXISTS "Members view" ON public.office_members;
DROP POLICY IF EXISTS "Manage members" ON public.office_members;
DROP POLICY IF EXISTS "Members manage" ON public.office_members;
DROP POLICY IF EXISTS "View team members" ON public.office_members;
DROP POLICY IF EXISTS "Manage team members" ON public.office_members;
DROP POLICY IF EXISTS "Join requests" ON public.office_members;

-- ============================================================
-- 2. FUNÇÃO DE SEGURANÇA (SECURITY DEFINER)
-- Esta é a correção para o Erro 500 / Recursão
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_is_member(_office_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER -- IMPORTANTE: Executa como superusuário para não checar RLS novamente
SET search_path = public, extensions, temp -- Segurança contra hijacking
AS $$
BEGIN
  -- Verifica se o usuário atual (auth.uid()) está na lista de membros do escritório
  -- Como é SECURITY DEFINER, ele consegue ler a tabela office_members sem disparar o RLS dela
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
-- O próprio usuário pode criar uma solicitação 'pending' para si mesmo
CREATE POLICY "Join requests" ON public.office_members
FOR INSERT WITH CHECK (
  user_id = (select auth.uid()) 
);

-- ============================================================
-- 5. RECRIAR POLÍTICAS (PROFILES)
-- ============================================================

-- Leitura pública para que usuários possam ver nomes uns dos outros na equipe
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
