# Correção Definitiva de Integridade (Erro 23503 / 409)

Este script resolve o problema onde usuários existem no Auth mas não possuem Perfil Público, impedindo a criação de escritórios.

Copie e cole todo o código abaixo no **SQL Editor** do Supabase:

```sql
BEGIN;

-- 1. Desabilitar RLS temporariamente para garantir acesso total durante a correção
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- 2. Corrigir Usuários Órfãos (Backfill)
-- Insere perfis para todos os usuários do Auth que não têm perfil na tabela public.profiles
INSERT INTO public.profiles (id, email, full_name, username, avatar_url, created_at)
SELECT 
  au.id, 
  au.email, 
  COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name', 'Usuário Recuperado'),
  COALESCE(au.raw_user_meta_data->>'username', '@user_' || substr(au.id::text, 1, 8)),
  COALESCE(au.raw_user_meta_data->>'avatar_url', ''),
  au.created_at
FROM auth.users au
LEFT JOIN public.profiles pp ON au.id = pp.id
WHERE pp.id IS NULL;

-- 3. Recriar Função Trigger com Tratamento de Erro Robusto
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER -- Executa como admin
SET search_path = public, extensions, temp
AS $$
DECLARE
  _name text;
  _username text;
BEGIN
  _name := COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));
  _username := COALESCE(new.raw_user_meta_data->>'username', '@' || split_part(new.email, '@', 1) || '_' || substr(md5(new.id::text), 1, 4));

  INSERT INTO public.profiles (id, full_name, email, avatar_url, username)
  VALUES (
    new.id,
    _name,
    new.email,
    new.raw_user_meta_data->>'avatar_url',
    _username
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email; -- Apenas garante sincronia

  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- Loga o erro mas não bloqueia o cadastro no Auth
  RAISE WARNING 'Erro ao criar perfil para %: %', new.id, SQLERRM;
  RETURN new;
END;
$$;

-- 4. Garantir que o Trigger está ativo
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 5. Reabilitar RLS e Garantir Permissões de Inserção pelo Frontend (Fallback)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Política para permitir que o PRÓPRIO usuário insira seu perfil (caso o trigger falhe)
DROP POLICY IF EXISTS "Insert Own Profile" ON public.profiles;
CREATE POLICY "Insert Own Profile" ON public.profiles
FOR INSERT WITH CHECK (auth.uid() = id);

-- Política para permitir que o PRÓPRIO usuário leia seu perfil (essencial para a verificação do frontend)
DROP POLICY IF EXISTS "Read Own Profile" ON public.profiles;
CREATE POLICY "Read Own Profile" ON public.profiles
FOR SELECT USING (true); -- Leitura pública necessária para ver nomes de membros de equipe

COMMIT;
```