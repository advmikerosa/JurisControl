
import { User, AuthProvider } from '../types';

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

  async register(name: string, email: string, password: string): Promise<User> {
    await delay(1500);

    // Simula validação de email existente
    if (email === 'erro@lexglass.com') {
      throw new Error('Este e-mail já está em uso.');
    }

    return {
      id: 'u_new_' + Date.now(),
      name: name,
      email: email,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=10b981&color=fff`,
      provider: 'email',
      offices: ['1'], // Novo usuário já entra no escritório padrão
      currentOfficeId: '1',
      twoFactorEnabled: false,
      emailVerified: false,
      phone: '',
      oab: '',
      role: 'Advogado Associado'
    };
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
      email: `user.${provider}@email.com`,
      avatar: `https://ui-avatars.com/api/?name=User+Social&background=random`,
      provider: provider,
      offices: ['1'],
      currentOfficeId: '1',
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
