# JurisControl - Guia de Deploy e Configuração de Segurança

## Status do Projeto

### ✅ Componentes Funcional
- **GitHub**: Repositório público com 33 commits e estrutura completa
- **Vercel**: Deploy em produção estável (Ready status)
- **Supabase**: Banco de dados estruturado com 8 tabelas
- **Google AI Studio**: Integração e templates preparados

### ⚠️ Problemas Críticos Encontrados

#### 1. RLS (Row Level Security) Desconfigurado
**Problema**: O Supabase tem RLS ativado, mas sem policies, bloqueando acesso a dados
**Solução**: Implementar policies RLS para cada tabela

#### 2. Variáveis de Ambiente Incompletas
**Problema**: `CLIENT_KEY_` incompleto no Vercel
**Solução**: Configurar adequadamente no Vercel Settings

#### 3. Arquivo .env.example Corrompido
**Status**: ✅ Corrigido - Arquivo restaurado com configurações corretas

## Configuração do Supabase - RLS Policies

### Policies Recomendadas por Tabela

```sql
-- Profiles Table: Usuários podem ler/atualizar seu próprio perfil
CREATE POLICY "Users can view their own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id);

-- Cases Table: Autenticados podem ler/criar casos
CREATE POLICY "Authenticated users can view cases"
ON cases FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create cases"
ON cases FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Clients Table
CREATE POLICY "Authenticated users can view clients"
ON clients FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create clients"
ON clients FOR INSERT
WITH CHECK (auth.role() = 'authenticated');
```

## Variáveis de Ambiente Requeridas

### Vercel (.env.production)
```
VITE_SUPABASE_URL=https://[seu-projeto].supabase.co
VITE_SUPABASE_ANON_KEY=[chave-anonima-supabase]
VITE_GOOGLE_API_KEY=[sua-chave-google-ai]
VITE_API_URL=https://juris-control.vercel.app
```

### Local (.env)
```
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=eyJ...token...anonimo
VITE_API_URL=http://localhost:5173
VITE_GOOGLE_API_KEY=[sua-chave-google-ai]
```

## Etapas Finais de Deploy

1. **Supabase**:
   - [ ] Acessar Authentication → Policies
   - [ ] Implementar as RLS policies acima
   - [ ] Testar acesso via API

2. **Vercel**:
   - [ ] Settings → Environment Variables
   - [ ] Atualizar todas as variáveis com valores reais
   - [ ] Fazer novo deploy (push para main branch)

3. **Testes**:
   - [ ] Verificar login na aplicação
   - [ ] Criar um caso de teste
   - [ ] Validar persistência de dados

## Links Importantes

- **Vercel Deploy**: https://juris-control.vercel.app
- **Supabase Project**: https://supabase.com/dashboard/project/yzrxprmrcxwhgbgkwptn
- **GitHub Repository**: https://github.com/advmikerosa/JurisControl

## Segurança

- NUNCA fazer commit de arquivos .env com valores reais
- Usar secrets do Vercel para variáveis sensíveis
- Revisar RLS policies regularmente
- Manter dependências atualizadas (yarn upgrade)
