
# Plano de Correção Pós-Diagnóstico

Dependendo da saída do script `DB_FULL_DIAGNOSTIC.md`, siga as instruções abaixo:

## Cenário A: Conflito de Arquitetura (JSONB vs Tabelas)
**Sintoma:** O aviso `⚠️ CONFLITO DETECTADO: Existem tanto a coluna JSONB... quanto a tabela...` apareceu.

**Causa:** Scripts anteriores tentaram normalizar o banco criando tabelas filhas (`client_alerts`, `case_movements`), mas o código do frontend (`src/services/storageService.ts`) ainda salva tudo dentro de colunas JSONB nas tabelas pai (`clients`, `cases`).

**Solução:**
1.  **Priorize o JSONB** (padrão atual do código Frontend).
2.  Ignore ou remova as tabelas separadas se estiverem vazias para evitar confusão.
3.  **Atenção:** As políticas RLS criadas em `FIX_RLS_FINAL.md` para tabelas como `case_movements` são inúteis se o dado está no JSONB da tabela `cases`. O importante é que a tabela `cases` tenha RLS correto.

## Cenário B: Usuários Sem Perfil
**Sintoma:** `❌ ERRO DE INTEGRIDADE: Existem X usuários no Auth sem perfil...`

**Solução:**
Execute este SQL imediato para criar os perfis faltantes e destravar o sistema:
```sql
INSERT INTO public.profiles (id, email, full_name, username)
SELECT 
  id, 
  email, 
  COALESCE(raw_user_meta_data->>'full_name', 'Usuário Recuperado'),
  COALESCE(raw_user_meta_data->>'username', '@user_' || substr(id::text, 1, 8))
FROM auth.users
ON CONFLICT (id) DO NOTHING;
```

## Cenário C: Funções Vulneráveis
**Sintoma:** `⚠️ ALERTA: Existem X funções SECURITY DEFINER com search_path vulnerável.`

**Solução:**
Execute o script contido no arquivo `FIX_SECURITY_WARNINGS.md` gerado anteriormente. Isso previne que usuários maliciosos sequestrem funções do sistema.

## Cenário D: Coluna Deleted_At Ausente
**Sintoma:** `❌ FALHA: Coluna "deleted_at" ausente...`

**Solução:**
```sql
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;
```
