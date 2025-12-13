# Checklist de Validação de Banco de Dados (Pré-Produção)

Este documento serve como um roteiro final para garantir que o banco de dados do **JurisControl** (Supabase/PostgreSQL) esteja seguro, performático e íntegro antes de receber dados reais de usuários.

---

## 1. Estrutura e Integridade (`Schema Validation`)

### ✅ Tabelas Core
- [ ] **Existência:** Todas as tabelas essenciais existem (`profiles`, `offices`, `office_members`, `clients`, `cases`, `tasks`, `financial`, `documents`, `activity_logs`).
- [ ] **Chaves Primárias:** Todas as tabelas possuem uma Primary Key (`id` uuid) definida.
- [ ] **Tipos de Dados:**
    - [ ] `jsonb` está sendo usado para campos flexíveis (`settings`, `history`, `social`, `permissions`).
    - [ ] `numeric(15,2)` está sendo usado para valores monetários (`financial.amount`, `cases.value`).
    - [ ] `timestamp with time zone` (timestamptz) é usado para todas as datas de sistema (`created_at`).

### ✅ Chaves Estrangeiras (Foreign Keys)
- [ ] **Definição:** Todos os relacionamentos (`user_id`, `office_id`, `client_id`, `case_id`) são FKs reais.
- [ ] **Ações de Exclusão (Cascading):**
    - [ ] `profiles`: `ON DELETE CASCADE` (Ao apagar user do Auth, apaga perfil).
    - [ ] `office_members`: `ON DELETE CASCADE` (Ao apagar escritório ou user, remove a associação).
    - [ ] `clients/cases/tasks`: `ON DELETE CASCADE` em relação ao `office_id` (Ao apagar escritório, apaga os dados).
    - [ ] `documents/financial`: `ON DELETE SET NULL` em relação a `case_id` ou `client_id` (para não perder registros financeiros se um cliente for deletado, se essa for a regra de negócio desejada, ou CASCADE se preferir limpeza total).

### 🔍 Script de Validação Estrutural
```sql
-- Verificar tabelas sem Primary Key
SELECT relname as tabela_sem_pk 
FROM pg_class JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace 
WHERE relkind = 'r' AND nspname = 'public' 
AND relname NOT IN (SELECT table_name FROM information_schema.table_constraints WHERE constraint_type = 'PRIMARY KEY');
```

---

## 2. Segurança e RLS (`Row Level Security`)

Esta é a etapa mais crítica para um sistema multi-tenant (SaaS).

### ✅ Ativação RLS
- [ ] **RLS Ativo:** O comando `ENABLE ROW LEVEL SECURITY` foi executado em **TODAS** as tabelas públicas.
- [ ] **Política de Negação Padrão:** Sem políticas definidas, o acesso deve ser negado (Postgres Default).

### ✅ Políticas Específicas
- [ ] **Profiles:** Leitura pública (para membros verem nomes), Escrita apenas pelo próprio usuário (`auth.uid()`).
- [ ] **Offices:** Leitura apenas para membros ou dono.
- [ ] **Dados (Cases, Clients, etc.):** Leitura/Escrita permitida **APENAS** se o usuário for membro do `office_id` vinculado (Tenancy Isolation).

### ✅ Funções de Segurança
- [ ] **Security Definer:** As funções críticas (`check_is_member`, `handle_new_user`, `add_creator_as_admin`) estão definidas como `SECURITY DEFINER`.
- [ ] **Search Path:** As funções possuem `SET search_path = public` para evitar sequestro de sessão.

### 🔍 Script de Validação de Segurança
```sql
-- 1. Verificar se RLS está habilitado
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- 2. Listar tabelas sem nenhuma política (PERIGO: Ninguém acessa ou Todos acessam dependendo do contexto)
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename NOT IN (SELECT tablename FROM pg_policies);
```

---

## 3. Identidade e Autenticação

### ✅ Sincronização Auth <-> Public
- [ ] **Trigger de Criação:** O trigger `on_auth_user_created` existe e funciona.
- [ ] **Consistência:** Não existem usuários na tabela `auth.users` sem correspondente em `public.profiles`.
- [ ] **Metadados:** Nome e Avatar estão sendo copiados corretamente do `raw_user_meta_data`.

### 🔍 Script de Verificação de Órfãos
```sql
-- Conta usuários no Auth sem perfil no Public (Deve retornar 0)
SELECT count(*) as orfaos_auth 
FROM auth.users u 
LEFT JOIN public.profiles p ON u.id = p.id 
WHERE p.id IS NULL;
```

---

## 4. Performance e Indexação

### ✅ Índices Obrigatórios
- [ ] **Chaves Estrangeiras:** Todas as colunas `_id` usadas em JOINs (`user_id`, `office_id`, `client_id`) possuem índices B-Tree.
- [ ] **Buscas Textuais:** Colunas muito buscadas (`cases.title`, `clients.name`, `cases.cnj`) possuem índices (B-Tree ou GIN/Trigram se usar busca fuzzy).
- [ ] **Colunas Únicas:** `offices.handle` e `profiles.username` possuem restrição `UNIQUE` (cria índice automaticamente).

### ✅ Índices Desnecessários
- [ ] **Duplicados:** Não existem índices cobrindo as mesmas colunas na mesma ordem.
- [ ] **Não Utilizados:** Índices criados mas nunca lidos pelo Query Planner (verificar `pg_stat_user_indexes` após algum uso).

### 🔍 Script de Validação de Índices FK
```sql
-- Lista FKs sem índices (Pode causar lentidão em Deletes e Joins)
SELECT
    c.conname AS constraint_name,
    t.relname AS table_name,
    a.attname AS column_name
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
LEFT JOIN pg_index i ON i.indrelid = c.conrelid AND a.attnum = ANY(i.indkey)
WHERE c.contype = 'f' -- Foreign Key
AND i.indexrelid IS NULL
AND t.relkind = 'r' 
AND t.relname NOT LIKE 'pg_%';
```

---

## 5. Lógica de Negócio e Triggers

### ✅ Automação de Escritório
- [ ] **Criação de Admin:** Ao criar um escritório (`offices`), o `owner_id` é adicionado automaticamente em `office_members` com role 'Admin'.
- [ ] **Unicidade de Handle:** O sistema impede a criação de dois escritórios com o mesmo `handle`.

### ✅ Soft Delete (Se aplicado)
- [ ] **Coluna:** A coluna `deleted_at` existe em `profiles`.
- [ ] **Função:** A função `delete_own_account` apenas preenche esta coluna, não apaga o registro.

---

## 6. Procedimento de "Go Live"

1.  **Backup Final:** Realizar um dump manual do banco de dados atual (se houver dados de seed/teste que deseja manter ou como referência).
2.  **Limpeza (Truncate):** Executar o script `CLEAN_DB.md` para remover todos os dados de teste (Mocks).
3.  **Deploy Edge Functions:** Garantir que as funções (ex: envio de e-mail, DataJud Proxy) estão deployadas com as variáveis de ambiente de produção (`--no-verify-jwt` se aplicável).
4.  **Verificação de Logs:** Monitorar `Database` > `Logs` no Supabase nas primeiras horas para capturar erros de RLS (permissão negada).

---

## Resumo Executivo

| Categoria | Status | Ação Necessária se Falha |
| :--- | :---: | :--- |
| **Tabelas e Tipos** | 🟢 | Rodar migração inicial. |
| **RLS Policies** | 🔴 | **CRÍTICO:** Rodar script de correção de RLS. Dados vazarão sem isso. |
| **Integridade Auth** | 🟡 | Rodar script de correção de órfãos. |
| **Índices FK** | 🟢 | Rodar script de otimização (`DB_OPTIMIZATION.md`). |
| **Triggers** | 🟢 | Recriar triggers de sistema. |
