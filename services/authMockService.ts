
import { User, AuthProvider, Office } from '../types';
import { storageService } from './storageService';

// Simula atraso de rede
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const authMockService = {
  async login(email: string, password: string): Promise<User> {
    await delay(1200);
    
    // Simulação básica: qualquer email com senha válida entra
    if (password.length < 6) {
      throw new Error('Senha incorreta.');
    }

    return {
      id: 'u1',
      name: 'Dr. Usuário', // Simulando retorno do banco
      username: '@drusuario',
      email: email,
      avatar: `https://ui-avatars.com/api/?name=Dr+Usuario&background=6366f1&color=fff`,
      provider: 'email',
      offices: ['1'], // IDs dos escritórios que participa
      currentOfficeId: '1',
      twoFactorEnabled: false,
      emailVerified: false, // Inicia como falso para demonstrar a funcionalidade
      phone: '(11) 99999-8888',
      oab: 'SP/123.456',
      role: 'Sócio Fundador'
    };
  },

  async register(name: string, email: string, password: string, oab?: string, officeData?: { mode: 'create' | 'join', name?: string, handle: string }): Promise<User> {
    await delay(1500);

    // Simula validação de email existente
    if (email === 'erro@lexglass.com') {
      throw new Error('Este e-mail já está em uso.');
    }

    // Gerar username automático
    const username = '@' + name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '').substring(0, 15);
    const userId = 'u_new_' + Date.now();

    // Setup initial user object without office
    let user: User = {
      id: userId,
      name: name,
      username: username,
      email: email,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=10b981&color=fff`,
      provider: 'email',
      offices: [], 
      currentOfficeId: undefined,
      twoFactorEnabled: false,
      emailVerified: false,
      phone: '',
      oab: oab || '',
      role: 'Advogado'
    };

    // CRITICAL: Store user temporarily to simulate authenticated state for storage service calls
    localStorage.setItem('@JurisControl:user', JSON.stringify(user));

    try {
      if (officeData) {
        let office: Office;
        if (officeData.mode === 'create' && officeData.name) {
           office = await storageService.createOffice({
             name: officeData.name,
             handle: officeData.handle,
             location: 'Brasil'
           });
        } else {
           office = await storageService.joinOffice(officeData.handle);
        }
        
        user.offices = [office.id];
        user.currentOfficeId = office.id;
        
        // Update user in storage with new office linkage so dashboard can load
        localStorage.setItem('@JurisControl:user', JSON.stringify(user));
      }
    } catch (e) {
      console.error("Mock register office error", e);
      // If office creation fails (e.g. handle taken), we might want to bubble up the error or handle gracefully
      throw e;
    }

    return user;
  },

  async loginSocial(provider: AuthProvider): Promise<User> {
    await delay(2000); // OAuth redirects take time

    const names = {
      'google': 'Usuário via Google',
      'apple': 'Usuário via Apple',
      'microsoft': 'Usuário via Microsoft'
    };

    return {
      id: `u_social_${provider}_1`,
      name: names[provider] || 'Usuário Social',
      username: `@social${provider}`,
      email: `user.${provider}@email.com`,
      avatar: `https://ui-avatars.com/api/?name=User+Social&background=random`,
      provider: provider,
      offices: [], // Novo usuário social também entra sem escritório
      currentOfficeId: undefined,
      twoFactorEnabled: true, // Social logins often count as MFA
      emailVerified: true, // Login social geralmente implica verificação
      phone: '',
      oab: '',
      role: 'Advogado'
    };
  },

  async recoverPassword(email: string): Promise<boolean> {
    await delay(1000);
    return true;
  }
};