
# Limpeza Total do Banco de Dados (Factory Reset)

Execute este script no **SQL Editor** do Supabase para apagar **TODOS** os dados da aplicação.

> ⚠️ **ATENÇÃO:** Esta ação é irreversível. Todos os clientes, processos, documentos e usuários serão apagados permanentemente.

```sql
-- ============================================================
-- LIMPEZA TOTAL DE DADOS (MANTÉM ESTRUTURA)
-- ============================================================

BEGIN;

-- 1. Limpar tabelas públicas (Dados da Aplicação)
-- O comando TRUNCATE é mais rápido que DELETE e com CASCADE limpa as dependências.
TRUNCATE TABLE
  public.activity_logs,
  public.documents,
  public.financial,
  public.tasks,
  public.cases,
  public.clients,
  public.office_members,
  public.offices,
  public.profiles
RESTART IDENTITY CASCADE;

-- 2. Limpar usuários de autenticação (Auth do Supabase)
-- Isso garante que ninguém consiga logar com credenciais antigas.
-- Nota: Requer permissões de superusuário ou service_role no SQL Editor.
DELETE FROM auth.users;

COMMIT;

-- Verificação final (Deve retornar 0 para tudo)
SELECT 'profiles' as tabela, count(*) as total FROM public.profiles
UNION ALL
SELECT 'offices', count(*) FROM public.offices
UNION ALL
SELECT 'auth.users', count(*) FROM auth.users;
```
