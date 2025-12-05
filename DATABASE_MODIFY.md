# Modificação do Banco de Dados - Exclusão de Conta

Para permitir que o usuário exclua sua própria conta e todos os dados associados (Escritórios, Processos, Clientes, Login) de forma segura, execute o comando SQL abaixo no **SQL Editor** do Supabase.

Esta função utiliza `SECURITY DEFINER` para permitir que o usuário autenticado delete seu próprio registro na tabela de sistema `auth.users`, algo que normalmente é restrito.

```sql
-- Função para Excluir a Própria Conta
CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();

  -- 1. Excluir escritórios onde o usuário é o DONO.
  -- Devido às configurações de CASCADE nas tabelas filhas (clients, cases, etc),
  -- isso limpará todos os dados operacionais vinculados a esses escritórios.
  DELETE FROM public.offices WHERE owner_id = current_user_id;

  -- 2. Excluir o usuário da tabela de autenticação do Supabase.
  -- Isso automaticamente dispara a exclusão na tabela public.profiles (se configurada com CASCADE)
  -- e remove o acesso de login.
  DELETE FROM auth.users WHERE id = current_user_id;
END;
$$;
```