

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthProvider as AuthProviderType } from '../types';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { authMockService } from '../services/authMockService';

interface AuthContextData {
  isAuthenticated: boolean;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, oab?: string) => Promise<boolean>; // Retorna true se precisar de verificação de email
  socialLogin: (provider: AuthProviderType) => Promise<void>;
  updateProfile: (data: Partial<User>) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check current session
    let mounted = true;

    const checkSession = async () => {
      if (isSupabaseConfigured && supabase) {
        // PERFORMANCE: Use getUser() instead of getSession() for stricter security,
        // but getSession is faster for checking local state initially.
        const { data: { session } } = await supabase.auth.getSession();
        
        if (mounted) {
            if (session?.user) {
              mapSupabaseUserToContext(session.user);
            } else {
              setUser(null);
              setIsAuthenticated(false);
            }
            setIsLoading(false);
        }
        
        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          if (!mounted) return;
          if (session?.user) {
             mapSupabaseUserToContext(session.user);
          } else {
             setUser(null);
             setIsAuthenticated(false);
          }
          setIsLoading(false);
        });

        return () => subscription.unsubscribe();
      } else {
        // Fallback LocalStorage (Demo Mode)
        const storedUser = localStorage.getItem('@JurisControl:user');
        if (storedUser && mounted) {
          setUser(JSON.parse(storedUser));
          setIsAuthenticated(true);
        }
        if (mounted) setIsLoading(false);
      }
    };

    checkSession();
    return () => { mounted = false; };
  }, []);

  const mapSupabaseUserToContext = (sbUser: any) => {
    const meta = sbUser.user_metadata || {};
    const mappedUser: User = {
      id: sbUser.id,
      name: meta.full_name || meta.name || 'Usuário',
      username: meta.username || '',
      email: sbUser.email || '',
      avatar: meta.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(meta.full_name || 'User')}&background=6366f1&color=fff`,
      provider: sbUser.app_metadata?.provider || 'email',
      offices: meta.offices || [],
      currentOfficeId: meta.currentOfficeId,
      twoFactorEnabled: false,
      emailVerified: !!sbUser.email_confirmed_at,
      phone: meta.phone || '',
      oab: meta.oab || '',
      role: meta.role || 'Advogado'
    };
    setUser(mappedUser);
    setIsAuthenticated(true);
  };

  const login = async (email: string, password: string) => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
    } else {
      const user = await authMockService.login(email, password);
      setUser(user);
      setIsAuthenticated(true);
      localStorage.setItem('@JurisControl:user', JSON.stringify(user));
    }
  };

  const register = async (name: string, email: string, password: string, oab?: string): Promise<boolean> => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            role: 'Advogado',
            oab: oab || '',
            username: '@' + name.toLowerCase().replace(/\s+/g, '') // Basic generation for supabase
          }
        }
      });
      if (error) throw new Error(error.message);
      
      // Se o Supabase estiver configurado para confirmar email, a sessão pode vir nula ou usuário identities vazio
      if (data.user && data.user.identities && data.user.identities.length === 0) {
         throw new Error('Este email já está cadastrado.');
      }
      
      // Se não tem sessão ativa logo após o cadastro, significa que precisa confirmar email
      return !data.session;
    } else {
      const user = await authMockService.register(name, email, password, oab);
      // Em modo mock, NÃO loga automaticamente para simular confirmação de e-mail (ou apenas retorna true)
      
      // Armazenamos o usuário "pendente" ou apenas simulamos que foi criado no "backend"
      // Para fins de demo, vamos assumir que o login subsequente funcionará com as credenciais criadas.
      
      // IMPORTANTE: Para o fluxo de "novo usuário sem escritório", o authMockService.register
      // já retorna um usuário com offices: [] e username gerado.
      return true; 
    }
  };

  const socialLogin = async (provider: AuthProviderType) => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider as any, // 'google', 'apple', 'azure' (microsoft)
      });
      if (error) throw new Error(error.message);
    } else {
      const user = await authMockService.loginSocial(provider);
      setUser(user);
      setIsAuthenticated(true);
      localStorage.setItem('@JurisControl:user', JSON.stringify(user));
    }
  };

  const updateProfile = async (data: Partial<User>) => {
    // Atualiza estado local para UI instantânea
    setUser(prev => {
        const newUser = prev ? ({ ...prev, ...data }) : null;
        if (!isSupabaseConfigured && newUser) {
            localStorage.setItem('@JurisControl:user', JSON.stringify(newUser));
        }
        return newUser;
    });

    if (isSupabaseConfigured && supabase) {
        // Mapear campos para metadata do Supabase
        const updates: any = {};
        if (data.name) updates.full_name = data.name;
        if (data.avatar) updates.avatar_url = data.avatar;
        if (data.phone) updates.phone = data.phone;
        if (data.oab) updates.oab = data.oab;
        if (data.username) updates.username = data.username;
        
        // Escritório
        if (data.offices) updates.offices = data.offices;
        if (data.currentOfficeId) updates.currentOfficeId = data.currentOfficeId;

        const { error } = await supabase.auth.updateUser({
            data: updates
        });
        if (error) console.error("Error updating Supabase profile", error);
    }
  };

  const logout = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('@JurisControl:user');
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, register, socialLogin, updateProfile, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
