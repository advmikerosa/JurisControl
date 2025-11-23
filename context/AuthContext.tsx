import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthProvider as AuthProviderType } from '../types';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { authMockService } from '../services/authMockService';

interface AuthContextData {
  isAuthenticated: boolean;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
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
    const checkSession = async () => {
      if (isSupabaseConfigured && supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          mapSupabaseUserToContext(session.user);
        } else {
          setUser(null);
          setIsAuthenticated(false);
        }
        
        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          if (session?.user) {
             mapSupabaseUserToContext(session.user);
          } else {
             setUser(null);
             setIsAuthenticated(false);
          }
          setIsLoading(false);
        });

        setIsLoading(false);
        return () => subscription.unsubscribe();
      } else {
        // Fallback LocalStorage (Demo Mode)
        const storedUser = localStorage.getItem('@JurisControl:user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
          setIsAuthenticated(true);
        }
        setIsLoading(false);
      }
    };

    checkSession();
  }, []);

  const mapSupabaseUserToContext = (sbUser: any) => {
    const meta = sbUser.user_metadata || {};
    const mappedUser: User = {
      id: sbUser.id,
      name: meta.full_name || meta.name || 'Usuário',
      email: sbUser.email || '',
      avatar: meta.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(meta.full_name || 'User')}&background=6366f1&color=fff`,
      provider: sbUser.app_metadata?.provider || 'email',
      offices: ['default'],
      currentOfficeId: 'default',
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

  const register = async (name: string, email: string, password: string) => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            role: 'Advogado'
          }
        }
      });
      if (error) throw new Error(error.message);
    } else {
      const user = await authMockService.register(name, email, password);
      setUser(user);
      setIsAuthenticated(true);
      localStorage.setItem('@JurisControl:user', JSON.stringify(user));
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
