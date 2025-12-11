
# Correção de Segurança - Function Search Path Mutable

O Security Advisor do Supabase detectou que funções com privilégios elevados (`SECURITY DEFINER`) não estão com o `search_path` fixado, o que pode permitir que usuários mal-intencionados interceptem a execução desviando para esquemas não seguros.

Execute o script abaixo no **SQL Editor** do Supabase para corrigir todas as 18 funções listadas.

## Script de Correção

Este script utiliza um bloco anônimo (`DO $$ ... $$`) para iterar sobre as funções existentes no banco e aplicar o `ALTER FUNCTION ... SET search_path = public` dinamicamente, garantindo que funcione independentemente dos argumentos de cada função.

```sql
DO $$
DECLARE
    -- Variável para armazenar a assinatura da função encontrada
    r RECORD;
    -- Lista das funções afetadas
    target_functions TEXT[] := ARRAY[
        'reactivate_own_account',
        'handle_new_user',
        'check_is_member',
        'update_updated_at_column',
        'global_search',
        'is_member_of_office',
        'is_office_member',
        'add_creator_as_admin',
        'get_user_office_id',
        'set_client_office_id',
        'set_case_office_id',
        'set_task_office_id',
        'set_document_office_id',
        'set_financial_office_id',
        'set_activity_log_metadata',
        'log_activity',
        'delete_own_account',
        'hard_delete_own_account'
    ];
BEGIN
    -- Loop para encontrar e alterar cada função
    FOR r IN
        SELECT p.oid::regprocedure as function_signature, p.proname
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname = ANY(target_functions)
    LOOP
        -- Executa o comando de alteração
        EXECUTE 'ALTER FUNCTION ' || r.function_signature || ' SET search_path = public';
        
        -- Loga o sucesso no console de mensagens do Postgres
        RAISE NOTICE '✅ search_path corrigido para: %', r.function_signature;
    END LOOP;
    
    RAISE NOTICE '--- Fim da correção de segurança ---';
END $$;
```

## O que este script faz?

1.  **Define a lista de alvos:** Lista as 18 funções vulneráveis.
2.  **Busca metadados:** Consulta a tabela de sistema `pg_proc` para obter a assinatura exata de cada função (nome + tipos de argumentos).
3.  **Aplica a correção:** Executa `ALTER FUNCTION [assinatura] SET search_path = public`. Isso garante que, quando a função for executada, ela olhe apenas para o esquema `public` e não herde o caminho de busca do usuário que a chamou, prevenindo ataques de substituição de objetos.
