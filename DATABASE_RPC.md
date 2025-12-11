
# Funções RPC para Transações Atômicas e Reativação

Execute este script no SQL Editor do Supabase para corrigir a inconsistência na exclusão de contas e habilitar o fluxo de reativação segura.

```sql
-- 1. Função de Exclusão "Soft Delete" (Atomic Update)
-- Marca a conta como deletada em vez de apagar os dados fisicamente imediatamente.
-- Isso permite recuperação e evita orfãos se a exclusão falhar no meio.
CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Atualiza o perfil marcando a data de exclusão
  UPDATE public.profiles 
  SET deleted_at = NOW() 
  WHERE id = auth.uid();
  
  -- Opcional: Você pode adicionar lógica aqui para invalidar sessões se necessário,
  -- mas o RLS deve bloquear acesso baseado em deleted_at IS NOT NULL.
END;
$$;

-- 2. Função de Reativação de Conta
-- Limpa o flag de exclusão, restaurando o acesso do usuário.
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

-- 3. (Opcional) Função de Exclusão Física (Hard Delete) em Cascata
-- Use com cautela. Apaga TUDO.
CREATE OR REPLACE FUNCTION public.hard_delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  
  -- Deleta dados dependentes (embora ON DELETE CASCADE nas chaves estrangeiras deva cuidar disso)
  DELETE FROM public.activity_logs WHERE user_id = current_user_id;
  DELETE FROM public.financial WHERE user_id = current_user_id;
  DELETE FROM public.tasks WHERE user_id = current_user_id;
  DELETE FROM public.documents WHERE user_id = current_user_id;
  DELETE FROM public.cases WHERE user_id = current_user_id;
  DELETE FROM public.clients WHERE user_id = current_user_id;
  DELETE FROM public.office_members WHERE user_id = current_user_id;
  
  -- Deleta o perfil
  DELETE FROM public.profiles WHERE id = current_user_id;
  
  -- Nota: O usuário em auth.users só pode ser deletado via Admin API (Service Role),
  -- não diretamente por RPC de usuário comum por segurança do Supabase.
END;
$$;
```
