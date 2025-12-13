
# Correção de Segurança Multi-Tenant e RLS

Execute este script no **SQL Editor** do Supabase para blindar a arquitetura de escritórios.

```sql
-- ============================================================
-- 1. FUNÇÕES AUXILIARES SEGURAS
-- ============================================================

-- Verifica se o usuário é Admin no escritório (para permissões de gestão)
CREATE OR REPLACE FUNCTION public.check_is_admin(_office_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.office_members 
    WHERE office_id = _office_id 
    AND user_id = (select auth.uid())
    AND role = 'Admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, temp;

-- Verifica se o usuário é o Dono do escritório
CREATE OR REPLACE FUNCTION public.check_is_owner(_office_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.offices 
    WHERE id = _office_id 
    AND owner_id = (select auth.uid())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, temp;

-- Otimização: Índice para acelerar verificações de RLS
CREATE INDEX IF NOT EXISTS idx_office_members_user_office 
ON public.office_members(user_id, office_id);

-- ============================================================
-- 2. REFORÇO DAS POLÍTICAS DE 'OFFICE_MEMBERS'
-- ============================================================

-- Remove a política genérica insegura
DROP POLICY IF EXISTS "Manage members" ON public.office_members;
DROP POLICY IF EXISTS "View members" ON public.office_members;

-- Política de Leitura: Membros podem ver seus colegas
CREATE POLICY "View team members" ON public.office_members
FOR SELECT USING (
  public.check_is_member(office_id)
);

-- Política de Escrita (INSERT/UPDATE/DELETE): Apenas Admin ou Dono
CREATE POLICY "Manage team members" ON public.office_members
FOR ALL USING (
  public.check_is_admin(office_id) OR public.check_is_owner(office_id)
)
WITH CHECK (
  public.check_is_admin(office_id) OR public.check_is_owner(office_id)
);

-- ============================================================
-- 3. PROTEÇÃO CONTRA EXCLUSÃO DO DONO (TRIGGER)
-- ============================================================

CREATE OR REPLACE FUNCTION public.prevent_owner_removal()
RETURNS trigger AS $$
BEGIN
  -- Verifica se o membro sendo excluído ou tendo papel alterado é o dono do escritório
  IF EXISTS (SELECT 1 FROM public.offices WHERE id = OLD.office_id AND owner_id = OLD.user_id) THEN
    IF (TG_OP = 'DELETE') THEN
        RAISE EXCEPTION 'Não é permitido remover o proprietário do escritório.';
    ELSIF (TG_OP = 'UPDATE' AND NEW.role != 'Admin') THEN
        RAISE EXCEPTION 'O proprietário deve manter o papel de Admin.';
    END IF;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_owner_removal ON public.office_members;

CREATE TRIGGER check_owner_removal
  BEFORE DELETE OR UPDATE ON public.office_members
  FOR EACH ROW EXECUTE PROCEDURE public.prevent_owner_removal();

-- ============================================================
-- 4. REFORÇO DE DADOS (CASES, CLIENTS, ETC.)
-- Garante que usuário só insira dados no escritório que participa
-- ============================================================

-- Exemplo para CASES (Replicar lógica para outras tabelas se necessário)
DROP POLICY IF EXISTS "Access Cases" ON public.cases;

CREATE POLICY "Access Cases" ON public.cases
FOR ALL 
USING ( public.check_is_member(office_id) )
WITH CHECK ( public.check_is_member(office_id) );

-- Repetir o padrão WITH CHECK para garantir integridade na inserção
DROP POLICY IF EXISTS "Access Clients" ON public.clients;
CREATE POLICY "Access Clients" ON public.clients FOR ALL USING (public.check_is_member(office_id)) WITH CHECK (public.check_is_member(office_id));

DROP POLICY IF EXISTS "Access Financial" ON public.financial;
CREATE POLICY "Access Financial" ON public.financial FOR ALL USING (public.check_is_member(office_id)) WITH CHECK (public.check_is_member(office_id));

DROP POLICY IF EXISTS "Access Documents" ON public.documents;
CREATE POLICY "Access Documents" ON public.documents FOR ALL USING (public.check_is_member(office_id)) WITH CHECK (public.check_is_member(office_id));

DROP POLICY IF EXISTS "Access Tasks" ON public.tasks;
CREATE POLICY "Access Tasks" ON public.tasks FOR ALL USING (public.check_is_member(office_id)) WITH CHECK (public.check_is_member(office_id));

```
