# Correção do Erro 42703 (Coluna 'created_by' não existe)

O erro ocorre porque uma função residual (`create_office_for_new_user`) está tentando automatizar a criação de escritórios usando um esquema de banco de dados antigo.

Copie e cole o código abaixo no **SQL Editor** do Supabase para remover essa função e restaurar o funcionamento correto do cadastro.

```sql
BEGIN;

-- 1. Remover triggers que possam estar chamando a função problemática
DROP TRIGGER IF EXISTS on_user_created_create_office ON auth.users;
DROP TRIGGER IF EXISTS create_office_trigger ON auth.users;
DROP TRIGGER IF EXISTS after_signup_create_office ON auth.users;

-- 2. Remover a função que causa o erro
DROP FUNCTION IF EXISTS public.create_office_for_new_user();

-- 3. Garantir que apenas o Trigger correto (Criação de Perfil) esteja ativo
-- Recriamos a função handle_new_user para garantir que ela esteja atualizada e segura
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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
    email = EXCLUDED.email; 

  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- Loga erro mas não bloqueia o cadastro no Auth (evita erro 500 no frontend)
  RAISE WARNING 'Erro ao criar perfil para %: %', new.id, SQLERRM;
  RETURN new;
END;
$$;

-- Reiniciar o trigger correto na tabela auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

COMMIT;
```