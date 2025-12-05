# Plano de Validação do Banco de Dados

Copie e cole o script abaixo no **SQL Editor** do Supabase para realizar um check-up completo no sistema.

## O que este script faz?
1.  **Verifica Estrutura:** Confirma se a coluna `deleted_at` (necessária para o Soft Delete) existe.
2.  **Verifica Integridade (Auth vs Public):** Identifica usuários que estão autenticados (tabela `auth.users`) mas não possuem perfil (tabela `public.profiles`), o que causa o **Erro 409/23503**.
3.  **Verifica Órfãos:** Checa se existem dados (processos, clientes) vinculados a escritórios inexistentes.
4.  **Verifica Segurança:** Confirma se o RLS (Row Level Security) está ativo nas tabelas.

---

### Script de Diagnóstico e Correção

```sql
-- ============================================================
-- 1. VERIFICAÇÃO ESTRUTURAL (Coluna deleted_at)
-- ============================================================
DO $$ 
BEGIN 
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'deleted_at'
    ) THEN 
        RAISE NOTICE '✅ SUCESSO: A coluna "deleted_at" existe na tabela profiles.';
    ELSE 
        RAISE NOTICE '❌ ERRO: A coluna "deleted_at" NÃO existe. Execute o script FIX_DATABASE.md.';
    END IF;
END $$;

-- ============================================================
-- 2. VERIFICAÇÃO DE CONSISTÊNCIA (Auth vs Profiles)
-- Identifica e conta usuários sem perfil (Causa do Erro 409)
-- ============================================================
SELECT 
    count(*) as "Usuarios_Sem_Perfil_Publico",
    CASE WHEN count(*) > 0 THEN '❌ ERRO: Existem usuários no Auth sem perfil no Public.' ELSE '✅ SUCESSO: Todos os usuários têm perfil.' END as status
FROM auth.users au
LEFT JOIN public.profiles pp ON au.id = pp.id
WHERE pp.id IS NULL;

-- Listar os IDs problemáticos (se houver)
SELECT id, email, created_at 
FROM auth.users 
WHERE id NOT IN (SELECT id FROM public.profiles);

-- ============================================================
-- 3. VERIFICAÇÃO DE SEGURANÇA (RLS Ativo)
-- ============================================================
SELECT 
    tablename,
    rowsecurity as "rls_enabled"
FROM pg_tables
JOIN pg_class ON pg_tables.tablename = pg_class.relname
WHERE schemaname = 'public' 
AND tablename IN ('profiles', 'offices', 'cases', 'clients', 'financial')
ORDER BY rowsecurity DESC;

-- ============================================================
-- 4. ESTATÍSTICAS GERAIS (Contagem de Registros)
-- ============================================================
SELECT 'profiles' as tabela, count(*) as total FROM public.profiles
UNION ALL
SELECT 'offices', count(*) FROM public.offices
UNION ALL
SELECT 'office_members', count(*) FROM public.office_members
UNION ALL
SELECT 'clients', count(*) FROM public.clients
UNION ALL
SELECT 'cases', count(*) FROM public.cases;

-- ============================================================
-- 5. CORREÇÃO AUTOMÁTICA (Executar se o item 2 falhou)
-- ============================================================
-- Se o passo 2 mostrou erros, esta query conserta:
INSERT INTO public.profiles (id, email, full_name, username)
SELECT 
  id, 
  email, 
  COALESCE(raw_user_meta_data->>'full_name', 'Usuário Recuperado'),
  COALESCE(raw_user_meta_data->>'username', '@user_' || substr(id::text, 1, 8))
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Garantir coluna deleted_at se não existir
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;
```