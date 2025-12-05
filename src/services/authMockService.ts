
import { User, AuthProvider, Office } from '../types';
import { storageService } from './storageService';

// Simula atraso de rede
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Chave para armazenar usuários registrados no LocalStorage (apenas para simulação)
const MOCK_USERS_KEY = '@JurisControl:mock_users';

export const authMockService = {
  async login(email: string, password: string): Promise<User> {
    await delay(1200);
    
    // Recupera usuários registrados localmente + Usuários hardcoded para teste
    const storedUsers = JSON.parse(localStorage.getItem(MOCK_USERS_KEY) || '[]');
    const defaultUsers = ['advmikerosa@outlook.com', 'demo@juriscontrol.com', 'admin@admin.com'];
    
    // Verifica se o usuário existe (Hardcoded ou Registrado)
    const userExists = defaultUsers.includes(email) || storedUsers.some((u: any) => u.email === email);

    if (!userExists) {
      throw new Error('Usuário não encontrado. Verifique o e-mail ou crie uma conta.');
    }

    // Simulação básica de senha
    if (password.length < 6) {
      throw new Error('Senha incorreta.');
    }

    // Retorna o usuário (busca do storage se existir, senão cria o mock padrão)
    const storedUser = storedUsers.find((u: any) => u.email === email);
    
    if (storedUser) return storedUser;

    return {
      id: 'u1',
      name: 'Dr. Usuário Demo', 
      username: '@drusuario',
      email: email,
      avatar: `https://ui-avatars.com/api/?name=Dr+Usuario&background=6366f1&color=fff`,
      provider: 'email',
      offices: ['office-1'], 
      currentOfficeId: 'office-1',
      twoFactorEnabled: false,
      emailVerified: true, 
      phone: '(11) 99999-8888',
      oab: 'SP/123.456',
      role: 'Sócio Fundador'
    };
  },

  async register(name: string, email: string, password: string, oab?: string, officeData?: { mode: 'create' | 'join', name?: string, handle: string }): Promise<User> {
    await delay(1500);

    const storedUsers = JSON.parse(localStorage.getItem(MOCK_USERS_KEY) || '[]');

    // Simula validação de email existente
    if (storedUsers.some((u: any) => u.email === email) || email === 'erro@lexglass.com') {
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
      emailVerified: true, // No mock já nasce verificado
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
        
        // Update the user object with the new office data immediately
        user.offices = [office.id];
        user.currentOfficeId = office.id;
        
        // Update user in session
        localStorage.setItem('@JurisControl:user', JSON.stringify(user));
      }
    } catch (e) {
      console.error("Mock register office error", e);
      throw e;
    }

    // Salva no "banco de dados" fake para persistir login futuro
    storedUsers.push(user);
    localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(storedUsers));

    return user;
  },

  async loginSocial(provider: AuthProvider): Promise<User> {
    await delay(2000); // OAuth redirects take time

    const names: Record<string, string> = {
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
      offices: [],
      currentOfficeId: undefined,
      twoFactorEnabled: true, 
      emailVerified: true, 
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
