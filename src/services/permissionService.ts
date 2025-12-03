
import { MemberRole, PermissionResource, PermissionAction, Office, User } from '../types';

/**
 * Matriz de Permissões Padrão
 * Define o que cada papel pode fazer por padrão.
 */
const ROLE_CAPABILITIES: Record<MemberRole, Record<PermissionResource, PermissionAction[]>> = {
  'Admin': {
    financial: ['view', 'create', 'edit', 'delete', 'export'],
    cases: ['view', 'create', 'edit', 'delete', 'export'],
    clients: ['view', 'create', 'edit', 'delete', 'export'],
    documents: ['view', 'create', 'edit', 'delete', 'export'],
    settings: ['view', 'edit'],
    team: ['view', 'create', 'edit', 'delete']
  },
  'Advogado': {
    financial: ['view'], // Pode ver, mas não editar financeiro
    cases: ['view', 'create', 'edit', 'export'], // Não pode deletar
    clients: ['view', 'create', 'edit', 'export'],
    documents: ['view', 'create', 'edit'],
    settings: [], // Sem acesso a configurações globais
    team: ['view']
  },
  'Estagiário': {
    financial: [],
    cases: ['view', 'create'], // Pode criar rascunhos, ver
    clients: ['view'],
    documents: ['view', 'create'],
    settings: [],
    team: []
  },
  'Financeiro': {
    financial: ['view', 'create', 'edit', 'delete', 'export'],
    cases: ['view'],
    clients: ['view'],
    documents: ['view'],
    settings: [],
    team: []
  }
};

class PermissionService {
  /**
   * Verifica se um usuário tem permissão para realizar uma ação em um recurso dentro de um escritório.
   */
  can(
    user: User | null,
    office: Office | null,
    resource: PermissionResource,
    action: PermissionAction
  ): boolean {
    if (!user || !office) return false;

    // 1. Verificar se é o Dono (Super Admin do escritório) - Prioridade máxima
    if (office.ownerId === user.id) return true;

    // 2. Encontrar o membro dentro do escritório
    const member = office.members.find(m => m.userId === user.id);
    
    // Se não for membro, acesso negado
    if (!member) return false;

    // 3. Verificar permissões baseadas no Papel (Role)
    const roleCaps = ROLE_CAPABILITIES[member.role];
    if (!roleCaps) return false;

    const allowedActions = roleCaps[resource];
    if (allowedActions && allowedActions.includes(action)) {
      return true;
    }

    // 4. (Opcional) Verificar permissões granulares/customizadas
    if (resource === 'financial' && member.permissions.financial && action === 'view') return true;
    if (resource === 'cases' && member.permissions.cases && action === 'view') return true;
    if (resource === 'documents' && member.permissions.documents && action === 'view') return true;
    if (resource === 'settings' && member.permissions.settings && action === 'view') return true;
    
    return false;
  }

  /**
   * Explica o motivo da negação (para logs ou UI de debug)
   */
  explain(
    user: User | null,
    office: Office | null,
    resource: PermissionResource,
    action: PermissionAction
  ): string {
    if (!user) return 'Usuário não autenticado.';
    if (!office) return 'Contexto de escritório inválido.';
    
    if (office.ownerId === user.id) return 'Acesso permitido (Proprietário).';

    const member = office.members.find(m => m.userId === user.id);
    if (!member) return 'Usuário não pertence a este escritório.';

    const roleCaps = ROLE_CAPABILITIES[member.role];
    if (roleCaps && roleCaps[resource]?.includes(action)) {
      return `Acesso permitido pelo papel de ${member.role}.`;
    }

    return `Acesso negado. O papel ${member.role} não possui a capacidade '${action}' em '${resource}'.`;
  }
}

export const permissionService = new PermissionService();
