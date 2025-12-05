
# Correção de Permissões (RLS) e Triggers

Copie e cole o código abaixo no **SQL Editor** do Supabase. Este script corrige as políticas de segurança para garantir que o usuário consiga ver o escritório que acabou de criar ou entrar.

```sql
-- ============================================================
-- 1. CORREÇÃO DE PERMISSÕES (RLS)
-- ============================================================

-- Permitir que qualquer usuário autenticado busque escritórios
-- (Necessário para validar se o @handle existe e para encontrar o ID ao entrar)
DROP POLICY IF EXISTS "View offices" ON public.offices;
CREATE POLICY "View offices" ON public.offices
FOR SELECT
USING ( true );

-- Permitir que o usuário veja associações onde ELE é o usuário ou o escritório pertence a ele
DROP POLICY IF EXISTS "View members" ON public.office_members;
CREATE POLICY "View members" ON public.office_members
FOR SELECT
USING (
  user_id = auth.uid() OR 
  EXISTS (SELECT 1 FROM public.offices WHERE id = office_id AND owner_id = auth.uid())
);

-- Permitir inserção na tabela de membros (necessário para "Entrar" e Trigger de criação)
-- Removemos versões anteriores da política para evitar erro de duplicidade
DROP POLICY IF EXISTS "Manage members" ON public.office_members;
DROP POLICY IF EXISTS "Join or Manage members" ON public.office_members;

CREATE POLICY "Join or Manage members" ON public.office_members
FOR ALL
USING (
  user_id = auth.uid() OR 
  EXISTS (SELECT 1 FROM public.offices WHERE id = office_id AND owner_id = auth.uid())
)
WITH CHECK (
  user_id = auth.uid() OR 
  EXISTS (SELECT 1 FROM public.offices WHERE id = office_id AND owner_id = auth.uid())
);

-- ============================================================
-- 2. GARANTIA DE TRIGGER (Criação Automática de Admin)
-- ============================================================

-- Recria a função e o trigger para garantir que, ao criar um escritório,
-- o dono seja adicionado automaticamente como membro Admin.
DROP TRIGGER IF EXISTS on_office_created ON public.offices;
DROP FUNCTION IF EXISTS public.add_creator_as_admin();

CREATE OR REPLACE FUNCTION public.add_creator_as_admin()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.office_members (office_id, user_id, role, permissions)
  VALUES (
    new.id,
    new.owner_id,
    'Admin',
    '{"cases": true, "financial": true, "documents": true, "settings": true}'::jsonb
  )
  ON CONFLICT (office_id, user_id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_office_created
  AFTER INSERT ON public.offices
  FOR EACH ROW EXECUTE PROCEDURE public.add_creator_as_admin();
```
