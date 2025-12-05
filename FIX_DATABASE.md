# Correção do Banco de Dados - Erros 400 e 409

Execute os comandos abaixo no **SQL Editor** do Supabase para corrigir a estrutura do banco de dados (coluna `deleted_at` ausente) e a integridade dos dados (perfis de usuário ausentes).

```sql
-- 1. Adicionar coluna deleted_at na tabela profiles (Resolve Erro 400)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

-- 2. Criar função de Reativação (Necessário para a lógica de suspensão funcionar)
CREATE OR REPLACE FUNCTION public.reactivate_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles 
  SET deleted_at = NULL 
  WHERE id = auth.uid();
END;
$$;

-- 3. Corrigir perfis ausentes (Resolve Erro 409 / 23503)
-- Insere registros na tabela profiles para usuários que existem no Auth mas não no Public
INSERT INTO public.profiles (id, email, full_name, username)
SELECT 
  id, 
  email, 
  COALESCE(raw_user_meta_data->>'full_name', 'Usuário Recuperado'),
  COALESCE(raw_user_meta_data->>'username', '@user_' || substr(id::text, 1, 8))
FROM auth.users
ON CONFLICT (id) DO NOTHING;
```