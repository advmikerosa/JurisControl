
# Migração: Fluxo de Solicitação de Ingresso (Join Request)

Execute este script no **SQL Editor** do Supabase para habilitar a aprovação de membros.

```sql
-- 1. Adicionar coluna de status na tabela de membros
ALTER TABLE public.office_members 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active' 
CHECK (status IN ('active', 'pending', 'invited'));

-- 2. Atualizar a função crítica de segurança (RLS Helper)
-- Apenas membros com status 'active' podem acessar os dados do escritório.
CREATE OR REPLACE FUNCTION public.check_is_member(_office_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.office_members 
    WHERE office_id = _office_id 
    AND user_id = (select auth.uid())
    AND status = 'active' -- Segurança Reforçada
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, temp;

-- 3. Atualizar Políticas RLS para permitir solicitações (INSERT)
-- Usuários podem se inserir na tabela members como 'pending'
DROP POLICY IF EXISTS "Manage members" ON public.office_members; -- Remove antiga se conflitar

-- Política de Leitura: Ver membros (se eu sou ativo ou dono) ou ver meu próprio registro (se pendente)
CREATE POLICY "View members" ON public.office_members
FOR SELECT USING (
  user_id = (select auth.uid()) OR 
  EXISTS (
    SELECT 1 FROM public.office_members AS om
    WHERE om.office_id = public.office_members.office_id 
    AND om.user_id = (select auth.uid())
    AND om.status = 'active'
  ) OR
  EXISTS (
    SELECT 1 FROM public.offices 
    WHERE id = public.office_members.office_id 
    AND owner_id = (select auth.uid())
  )
);

-- Política de Inserção: Criar solicitação (Status obrigatório 'pending' se não for dono)
CREATE POLICY "Create join request" ON public.office_members
FOR INSERT WITH CHECK (
  (user_id = (select auth.uid()) AND status = 'pending') OR -- Auto-solicitação
  EXISTS (SELECT 1 FROM public.offices WHERE id = office_id AND owner_id = (select auth.uid())) -- Dono adicionando
);

-- Política de Atualização/Exclusão: Apenas Admin/Dono ativos
CREATE POLICY "Admin manage members" ON public.office_members
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.office_members 
    WHERE office_id = public.office_members.office_id 
    AND user_id = (select auth.uid()) 
    AND role = 'Admin' 
    AND status = 'active'
  ) OR 
  EXISTS (
    SELECT 1 FROM public.offices 
    WHERE id = public.office_members.office_id 
    AND owner_id = (select auth.uid())
  )
);

CREATE POLICY "Admin delete members" ON public.office_members
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.office_members 
    WHERE office_id = public.office_members.office_id 
    AND user_id = (select auth.uid()) 
    AND role = 'Admin' 
    AND status = 'active'
  ) OR 
  EXISTS (
    SELECT 1 FROM public.offices 
    WHERE id = public.office_members.office_id 
    AND owner_id = (select auth.uid())
  ) OR
  user_id = (select auth.uid()) -- O próprio usuário pode cancelar sua solicitação
);

-- 4. Função Trigger para garantir que o Criador do escritório nasça 'active'
CREATE OR REPLACE FUNCTION public.add_creator_as_admin()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.office_members (office_id, user_id, role, permissions, status)
  VALUES (
    new.id,
    new.owner_id,
    'Admin',
    '{"cases": true, "financial": true, "documents": true, "settings": true}'::jsonb,
    'active'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, temp;
```
