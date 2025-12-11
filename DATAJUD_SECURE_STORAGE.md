
# Migração de Segurança - Armazenamento de API Key DataJud e Logs

Execute este script no **SQL Editor** do Supabase para configurar a segurança da API DataJud.

```sql
-- 1. Adicionar colunas de segurança na tabela profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS datajud_api_key_encrypted text,
ADD COLUMN IF NOT EXISTS datajud_api_key_hash text,
ADD COLUMN IF NOT EXISTS datajud_key_created_at timestamp with time zone;

-- 2. Criar tabela de Logs de Auditoria para DataJud
CREATE TABLE IF NOT EXISTS public.datajud_api_access_log (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint_used text,
  cnj_searched text,
  status_code int,
  error_message text,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Habilitar RLS na tabela de logs
ALTER TABLE public.datajud_api_access_log ENABLE ROW LEVEL SECURITY;

-- 4. Política: Usuários só podem inserir seus próprios logs
CREATE POLICY "Insert own logs" 
ON public.datajud_api_access_log 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- 5. Política: Usuários só podem ver seus próprios logs (opcional, para auditoria pessoal)
CREATE POLICY "View own logs" 
ON public.datajud_api_access_log 
FOR SELECT 
USING (auth.uid() = user_id);
```
