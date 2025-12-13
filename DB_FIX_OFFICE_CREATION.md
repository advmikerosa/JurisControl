
# Correção de Trigger para Criação de Escritório

O erro `PGRST204` ocorre porque o frontend estava enviando a coluna `members` para a tabela `offices`.
Além da correção no código TypeScript, execute este script para garantir que o banco de dados insira o dono automaticamente na tabela de membros com as permissões corretas e status ativo.

```sql
-- 1. Recriar a função trigger com a lógica de status 'active'
CREATE OR REPLACE FUNCTION public.add_creator_as_admin()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.office_members (office_id, user_id, role, permissions, status)
  VALUES (
    new.id,
    new.owner_id,
    'Admin',
    '{"cases": true, "financial": true, "documents": true, "settings": true}'::jsonb,
    'active' -- Importante: Dono já entra como ativo, sem necessidade de aprovação
  )
  ON CONFLICT (office_id, user_id) DO NOTHING;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, temp;

-- 2. Garantir que o trigger está aplicado
DROP TRIGGER IF EXISTS on_office_created ON public.offices;

CREATE TRIGGER on_office_created
  AFTER INSERT ON public.offices
  FOR EACH ROW EXECUTE PROCEDURE public.add_creator_as_admin();

-- 3. Verificação (Opcional)
-- Se você tentou criar escritórios que falharam anteriormente, pode haver inconsistências.
-- Este comando lista escritórios sem membros (órfãos):
/*
SELECT * FROM public.offices o
WHERE NOT EXISTS (SELECT 1 FROM public.office_members m WHERE m.office_id = o.id);
*/
```
