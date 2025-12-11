
# Configuração de Storage (Buckets) - JurisControl

Execute o script abaixo no **SQL Editor** do Supabase para configurar o armazenamento de arquivos com segurança robusta.

Este script cria um bucket privado e configura políticas RLS para que usuários só acessem arquivos que estão dentro da pasta do seu respectivo escritório.

```sql
-- ============================================================
-- 1. CRIAÇÃO DO BUCKET 'documents'
-- ============================================================

-- Tenta inserir o bucket se ele não existir
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES (
  'documents', 
  'documents', 
  FALSE, -- Importante: FALSE para bucket privado (requer autenticação)
  FALSE,
  52428800, -- Limite de 50MB (em bytes)
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
-- 2. SEGURANÇA (RLS)
-- ============================================================

-- Habilita RLS na tabela de objetos do Storage (caso não esteja)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Remove políticas antigas para evitar conflitos/duplicidade
DROP POLICY IF EXISTS "Acesso restrito por escritório" ON storage.objects;
DROP POLICY IF EXISTS "Upload restrito por escritório" ON storage.objects;
DROP POLICY IF EXISTS "Delete restrito por escritório" ON storage.objects;
DROP POLICY IF EXISTS "Office Members Access" ON storage.objects;

-- ============================================================
-- 3. POLÍTICAS DE ACESSO (CRUD)
-- A lógica baseia-se no caminho do arquivo: "office_uuid/filename.ext"
-- Extraímos a primeira parte do caminho (office_uuid) e verificamos a permissão.
-- ============================================================

-- POLÍTICA UNIFICADA DE ACESSO (SELECT, INSERT, UPDATE, DELETE)
-- Permite que membros do escritório gerenciem arquivos dentro da pasta do seu escritório.
CREATE POLICY "Office Members Access"
ON storage.objects
FOR ALL
USING (
  bucket_id = 'documents' 
  AND auth.role() = 'authenticated' 
  AND (
    -- Extrai o primeiro segmento do caminho (o ID do escritório) e verifica membresia
    -- A função public.check_is_member foi criada no setup do banco de dados
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
-- 4. VERIFICAÇÃO
-- ============================================================
-- Para testar, tente fazer upload de um arquivo via frontend. 
-- O caminho deve ser obrigatóriamente: {OFFICE_ID}/{NOME_ARQUIVO}
```
