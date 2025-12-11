
# Configuração de Storage (Buckets) - JurisControl

Execute o script abaixo no **SQL Editor** do Supabase.

### O que este script faz?
1. Cria um bucket privado chamado `documents`.
2. Cria uma política de segurança (RLS) que **isola** os arquivos.
   - O sistema de arquivos funcionará assim: `documents/{OFFICE_ID}/{NOME_DO_ARQUIVO}`.
   - A política SQL extrai o `{OFFICE_ID}` do caminho do arquivo.
   - Ela verifica na tabela `public.office_members` se o usuário atual pertence a esse escritório.
   - Se pertencer, o acesso (Leitura/Escrita) é liberado. Caso contrário, é bloqueado.

```sql
-- ============================================================
-- 1. CRIAÇÃO DO BUCKET 'documents'
-- ============================================================

-- Insere o bucket 'documents' se ele não existir
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES (
  'documents', 
  'documents', 
  FALSE, -- FALSE = Privado (Requer autenticação via RLS ou Token Assinado)
  FALSE,
  52428800, -- Limite de 50MB
  ARRAY[
    'image/png',
    'image/jpeg',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = FALSE,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY[
    'image/png',
    'image/jpeg',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];

-- ============================================================
-- 2. FUNÇÃO AUXILIAR (Caso não tenha sido criada no setup)
-- ============================================================

-- Esta função verifica se o usuário atual é membro do escritório informado (UUID)
CREATE OR REPLACE FUNCTION public.check_is_member(_office_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.office_members 
    WHERE office_id = _office_id 
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 3. POLÍTICAS DE SEGURANÇA (RLS)
-- ============================================================

-- Removemos políticas antigas para garantir uma configuração limpa
DROP POLICY IF EXISTS "Office Members Access" ON storage.objects;
DROP POLICY IF EXISTS "Acesso restrito por escritório" ON storage.objects;
DROP POLICY IF EXISTS "Upload restrito por escritório" ON storage.objects;
DROP POLICY IF EXISTS "Delete restrito por escritório" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder 1oj01k_0" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder 1oj01k_1" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder 1oj01k_2" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder 1oj01k_3" ON storage.objects;

-- POLÍTICA DE ISOLAMENTO POR ESCRITÓRIO
-- Lógica: O caminho do arquivo é sempre "OFFICE_ID/nome_arquivo".
-- A função `storage.foldername(name)` retorna um array das pastas.
-- Pegamos o primeiro item `[1]`, convertemos para UUID e checamos a permissão.

CREATE POLICY "Office Isolation Policy"
ON storage.objects
FOR ALL
USING (
  bucket_id = 'documents' 
  AND auth.role() = 'authenticated' 
  AND (
    -- Verifica se o nome da primeira pasta (Office ID) é um escritório onde o usuário é membro
    public.check_is_member( (storage.foldername(name))[1]::uuid )
  )
)
WITH CHECK (
  bucket_id = 'documents' 
  AND auth.role() = 'authenticated' 
  AND (
    public.check_is_member( (storage.foldername(name))[1]::uuid )
  )
);

-- ============================================================
-- 4. FINALIZAÇÃO
-- ============================================================
-- Agora, qualquer upload feito pelo frontend deve incluir o ID do escritório no início do caminho.
-- Exemplo no JS: supabase.storage.from('documents').upload(`${user.currentOfficeId}/contrato.pdf`, file)
```
