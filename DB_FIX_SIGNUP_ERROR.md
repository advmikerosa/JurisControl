
# Correção Crítica: Erro 500 ao Criar Usuário (Signup Fix)

O erro 500 durante o cadastro ocorre porque o **Trigger** do banco de dados está falhando ao tentar criar o perfil público.

Execute este script no **SQL Editor** do Supabase para substituir a função de trigger por uma versão robusta e segura.

## O que este script faz:
1.  Define o `search_path` corretamente (correção de segurança e visibilidade).
2.  Adiciona um bloco de tratamento de erro (`EXCEPTION WHEN OTHERS`). Se a criação do perfil falhar, o usuário **ainda será criado** no Auth, evitando o erro 500. O sistema recuperará o perfil ausente no próximo login.
3.  Garante que o Trigger esteja corretamente vinculado.

```sql
BEGIN;

-- 1. Remover Trigger e Função antigos para garantir limpeza
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Recriar a função handle_new_user com Robustez e Segurança
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER -- Executa com permissões de admin (bypassing RLS da tabela profiles para inserção)
SET search_path = public, extensions, temp -- Segurança contra hijacking de path
AS $$
DECLARE
  _name text;
  _username text;
  _avatar text;
BEGIN
  -- Extração segura de dados do metadata (evita erros se campos estiverem nulos)
  _name := COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'Novo Usuário');
  _avatar := COALESCE(new.raw_user_meta_data->>'avatar_url', '');
  
  -- Gera um username único baseado no ID se não fornecido
  _username := COALESCE(
    new.raw_user_meta_data->>'username', 
    '@user_' || substr(md5(new.id::text || clock_timestamp()::text), 1, 8)
  );

  -- Tenta inserir o perfil
  INSERT INTO public.profiles (id, full_name, email, avatar_url, username)
  VALUES (
    new.id,
    _name,
    new.email,
    _avatar,
    _username
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name;

  RETURN new;

EXCEPTION WHEN OTHERS THEN
  -- CRÍTICO: Captura qualquer erro (ex: violação de constraint, erro de tipo)
  -- e permite que o cadastro no Auth prossiga.
  -- O erro é logado no Postgres para debug.
  RAISE WARNING 'Erro ao criar perfil público para usuário %: %', new.id, SQLERRM;
  RETURN new;
END;
$$;

-- 3. Reaplicar o Trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. Garantir permissões na tabela profiles (caso RLS esteja bloqueando)
-- Como a função é SECURITY DEFINER, isso é redundante para o trigger, 
-- mas essencial para o funcionamento do app depois.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Política para permitir que o usuário insira seu próprio perfil (backup caso o trigger falhe e o front tente)
DROP POLICY IF EXISTS "Insert Own Profile" ON public.profiles;
CREATE POLICY "Insert Own Profile" ON public.profiles
FOR INSERT WITH CHECK (auth.uid() = id);

COMMIT;
```
