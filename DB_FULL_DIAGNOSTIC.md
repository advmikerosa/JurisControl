
# Diagnóstico Completo de Saúde do Banco de Dados (JurisControl)

Execute o script SQL abaixo no **SQL Editor** do Supabase. Ele não altera dados, apenas gera um relatório de diagnóstico para identificar inconsistências estruturais, de segurança e de integridade.

## O que este script verifica?
1.  **Consistência Arquitetural:** Verifica se o banco está usando Tabelas Relacionais ou colunas JSONB (para resolver a confusão dos scripts anteriores).
2.  **Integridade de Usuários:** Detecta usuários sem perfil ou contas "zumbis".
3.  **Segurança (RLS):** Confirma se todas as tabelas sensíveis estão protegidas.
4.  **Segurança (Funções):** Verifica se as funções `SECURITY DEFINER` estão com `search_path` travado (prevenção de hacking).
5.  **Soft Delete:** Confirma se a lógica de suspensão de conta está ativa.

---

### Copie e execute o SQL abaixo:

```sql
DO $$
DECLARE
    v_count integer;
    v_text text;
    v_has_jsonb boolean;
    v_has_table boolean;
BEGIN
    RAISE NOTICE '===================================================';
    RAISE NOTICE '   RELATÓRIO DE DIAGNÓSTICO JURISCONTROL';
    RAISE NOTICE '===================================================';

    -- 1. VERIFICAÇÃO DE ARQUITETURA (JSONB vs RELACIONAL)
    RAISE NOTICE '--- 1. Arquitetura de Dados ---';
    
    -- Checar Cases/Movements
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cases' AND column_name = 'movements') INTO v_has_jsonb;
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'case_movements') INTO v_has_table;
    
    IF v_has_jsonb AND v_has_table THEN
        RAISE WARNING '⚠️  CONFLITO DETECTADO: Existem tanto a coluna JSONB "movements" em "cases" quanto a tabela separada "case_movements". O código atual usa JSONB. A tabela separada pode estar obsoleta.';
    ELSIF v_has_jsonb THEN
        RAISE NOTICE '✅ Arquitetura: CASES usa coluna JSONB (Compatível com código atual).';
    ELSIF v_has_table THEN
        RAISE NOTICE 'ℹ️  Arquitetura: CASES usa tabela relacional separada (Requer ajuste no código frontend).';
    ELSE
        RAISE WARNING '❌ ERRO CRÍTICO: Não foi encontrado nem coluna JSONB nem tabela para Movimentações.';
    END IF;

    -- Checar Clients/Alerts
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'alerts') INTO v_has_jsonb;
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_alerts') INTO v_has_table;
    
    IF v_has_jsonb AND v_has_table THEN
        RAISE WARNING '⚠️  CONFLITO DETECTADO: Existem tanto a coluna JSONB "alerts" em "clients" quanto a tabela "client_alerts".';
    END IF;

    -- 2. VERIFICAÇÃO DE INTEGRIDADE (AUTH vs PUBLIC)
    RAISE NOTICE '--- 2. Integridade de Usuários ---';
    
    SELECT count(*) INTO v_count 
    FROM auth.users u 
    LEFT JOIN public.profiles p ON u.id = p.id 
    WHERE p.id IS NULL;
    
    IF v_count > 0 THEN
        RAISE WARNING '❌ ERRO DE INTEGRIDADE: Existem % usuários no Auth sem perfil na tabela "profiles". (Erro 409/FK potencial).', v_count;
        RAISE NOTICE '   -> Execute o script de correção: "INSERT INTO public.profiles..."';
    ELSE
        RAISE NOTICE '✅ Integridade: Todos os usuários possuem perfil.';
    END IF;

    -- 3. VERIFICAÇÃO DE SOFT DELETE
    RAISE NOTICE '--- 3. Mecanismo de Soft Delete ---';
    
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'deleted_at') INTO v_has_table;
    
    IF v_has_table THEN
        RAISE NOTICE '✅ Coluna "deleted_at" encontrada na tabela profiles.';
    ELSE
        RAISE WARNING '❌ FALHA: Coluna "deleted_at" ausente em profiles. A exclusão de conta falhará.';
    END IF;

    -- 4. VERIFICAÇÃO DE SEGURANÇA (RLS)
    RAISE NOTICE '--- 4. Segurança Row Level Security (RLS) ---';
    
    FOR v_text IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND rowsecurity = false
    LOOP
        RAISE WARNING '❌ PERIGO: A tabela "%" está com RLS DESATIVADO (Dados expostos).', v_text;
    END LOOP;

    -- Verificar se tabelas críticas têm políticas
    SELECT count(*) INTO v_count FROM pg_policies WHERE tablename = 'cases';
    IF v_count = 0 THEN RAISE WARNING '❌ PERIGO: Tabela "cases" tem RLS ativo mas NENHUMA política (Ninguém acessa).'; END IF;

    -- 5. SEGURANÇA DE FUNÇÕES (Search Path)
    RAISE NOTICE '--- 5. Segurança de Funções (Anti-Hacking) ---';
    
    SELECT count(*) INTO v_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.prosecdef = true -- Security Definer
    AND (p.proconfig IS NULL OR NOT 'search_path=public' = ANY(p.proconfig));
    
    IF v_count > 0 THEN
        RAISE WARNING '⚠️  ALERTA: Existem % funções SECURITY DEFINER com search_path vulnerável.', v_count;
        RAISE NOTICE '   -> Execute o script FIX_SECURITY_WARNINGS.md para corrigir.';
    ELSE
        RAISE NOTICE '✅ Todas as funções críticas estão protegidas.';
    END IF;

    RAISE NOTICE '===================================================';
    RAISE NOTICE '   FIM DO DIAGNÓSTICO';
    RAISE NOTICE '===================================================';
END $$;
```
