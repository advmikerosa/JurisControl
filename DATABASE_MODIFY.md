# Modificação do Banco de Dados - Suspensão e Reativação de Conta

Execute os comandos abaixo no **SQL Editor** do Supabase para atualizar a lógica de exclusão para "Soft Delete" (Suspensão de 30 dias).

```sql
-- 1. Adicionar coluna de controle na tabela de perfis
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

-- 2. Atualizar a função de exclusão para "Soft Delete"
-- Ao invés de apagar, marca a data de exclusão.
CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles 
  SET deleted_at = NOW() 
  WHERE id = auth.uid();
END;
$$;

-- 3. Criar função de Reativação
-- Limpa a data de exclusão, restaurando o acesso.
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

-- 4. (Opcional) Política de segurança para impedir leitura de dados de usuários excluídos por outros
-- Isso garante que o usuário "suma" das listas de membros enquanto estiver suspenso, se desejado.
-- (Não incluído neste script básico para manter a integridade referencial visual, mas recomendado em produção)
```