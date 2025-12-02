
import { describe, it, expect } from 'vitest';
import { permissionService } from '../services/permissionService';
import { User, Office, OfficeMember } from '../types';

describe('RBAC Access Control', () => {
  
  const mockOffice: Office = {
    id: 'office-1',
    name: 'Test Office',
    handle: '@test',
    ownerId: 'owner-id',
    location: 'BR',
    members: [],
    createdAt: '',
    social: {}
  };

  const createMockUser = (id: string, role: string): { user: User, office: Office } => {
    const user: User = {
      id,
      name: 'Test User',
      email: 'test@test.com',
      avatar: '',
      provider: 'email',
      offices: ['office-1'],
      currentOfficeId: 'office-1',
      twoFactorEnabled: false,
      emailVerified: true
    };

    const member: OfficeMember = {
      userId: id,
      name: 'Test User',
      role: role as any,
      permissions: { financial: true, cases: true, documents: true, settings: true } // Permissions flag legacy support
    };

    const office = { ...mockOffice, members: [member] };
    return { user, office };
  };

  it('should allow Owner to do everything', () => {
    const { user, office } = createMockUser('owner-id', 'Admin');
    expect(permissionService.can(user, office, 'financial', 'delete')).toBe(true);
    expect(permissionService.can(user, office, 'settings', 'edit')).toBe(true);
  });

  it('should allow Admin to edit settings', () => {
    const { user, office } = createMockUser('admin-id', 'Admin');
    expect(permissionService.can(user, office, 'settings', 'edit')).toBe(true);
  });

  it('should prevent Lawyer from deleting financial records', () => {
    const { user, office } = createMockUser('lawyer-id', 'Advogado');
    expect(permissionService.can(user, office, 'financial', 'delete')).toBe(false);
  });

  it('should allow Lawyer to view financial records', () => {
    const { user, office } = createMockUser('lawyer-id', 'Advogado');
    expect(permissionService.can(user, office, 'financial', 'view')).toBe(true);
  });

  it('should prevent Intern from accessing settings', () => {
    const { user, office } = createMockUser('intern-id', 'Estagiário');
    expect(permissionService.can(user, office, 'settings', 'view')).toBe(false);
  });

  it('should deny access if user is not in the office member list', () => {
    const user: User = { id: 'stranger', name: '', email: '', avatar: '', provider: 'email', offices: [], twoFactorEnabled: false, emailVerified: true };
    const office = { ...mockOffice, members: [] }; // Empty members
    expect(permissionService.can(user, office, 'cases', 'view')).toBe(false);
  });
});
