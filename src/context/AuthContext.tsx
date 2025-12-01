
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { User, AuthProvider as AuthProviderType } from '../types';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { authMockService } from '../services/authMockService';
import { storageService } from '../services/storageService';
import { useToast } from './ToastContext';

interface OfficeRegistrationData {
  mode: 'create' | 'join';
  name?: string; 
  handle: string; 
}

interface AuthContextData {
  isAuthenticated: boolean;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, oab?: string, officeData?: OfficeRegistrationData) => Promise<boolean>;
  recoverPassword: (email: string) => Promise<boolean>;
  socialLogin: (provider: AuthProviderType) => Promise<void>;
  updateProfile: (data: Partial<User>) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

const INACTIVITY_LIMIT = 30 * 60 * 1000; 
const ACTIVITY_THROTTLE = 5000; 

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { addToast } = useToast();
  const lastActivityUpdate = useRef<number>(Date.now());

  const logout = useCallback(async (isAutoLogout = false) => {
    try {
      if (isSupabaseConfigured && supabase) {
        await supabase.auth.signOut();
      }
    } catch (e) {
      console.error("Logout error", e);
    }
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('@JurisControl:user');
    localStorage.removeItem('@JurisControl:lastActivity');
    
    if (isAutoLogout) {
      addToast('Sessão expirada por inatividade.', 'warning');
    }
  }, [addToast]);

  // Monitor de Inatividade
  useEffect(() => {
    if (!isAuthenticated) return;

    let inactivityTimer: ReturnType<typeof setTimeout>;

    const resetInactivityTimer = () => {
      const now = Date.now();
      if (now - lastActivityUpdate.current > ACTIVITY_THROTTLE) {
          localStorage.setItem('@JurisControl:lastActivity', now.toString());
          lastActivityUpdate.current = now;
      }
      
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        logout(true);
      }, INACTIVITY_LIMIT);
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    
    const lastActivity = parseInt(localStorage.getItem('@JurisControl:lastActivity') || '0');
    if (lastActivity > 0 && Date.now() - lastActivity > INACTIVITY_LIMIT) {
      logout(true);
    } else {
      resetInactivityTimer();
      events.forEach(event => window.addEventListener(event, resetInactivityTimer));
    }

    return () => {
      clearTimeout(inactivityTimer);
      events.forEach(event => window.removeEventListener(event, resetInactivityTimer));
    };
  }, [isAuthenticated, logout]);

  // Verificação de Sessão Inicial
  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      try {
        if (isSupabaseConfigured && supabase) {
          const { data, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error("Session Check Error:", error.message);
            if (mounted) {
              logout(false);
              setIsLoading(false);
            }
            return;
          }

          if (mounted) {
              if (data.session?.user) {
                mapSupabaseUserToContext(data.session.user);
              } else {
                setUser(null);
                setIsAuthenticated(false);
              }
          }
          
          const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!mounted) return;
            if (session?.user) {
               mapSupabaseUserToContext(session.user);
            } else {
               setUser(null);
               setIsAuthenticated(false);
            }
          });

          return () => subscription.unsubscribe();
        } else {
          // Fallback LocalStorage
          const storedUser = localStorage.getItem('@JurisControl:user');
          if (storedUser && mounted) {
            try {
              setUser(JSON.parse(storedUser));
              setIsAuthenticated(true);
            } catch {
              localStorage.removeItem('@JurisControl:user');
            }
          }
        }
      } catch (error) {
        console.error("Session check failed:", error);
        if (mounted) {
          setUser(null);
          setIsAuthenticated(false);
        }
      } finally {
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

  const login = useCallback(async (email: string, password: string) => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
    } else {
      const user = await authMockService.login(email, password);
      setUser(user);
      setIsAuthenticated(true);
      localStorage.setItem('@JurisControl:user', JSON.stringify(user));
      localStorage.setItem('@JurisControl:lastActivity', Date.now().toString());
    }
  }, []);

  const register = useCallback(async (name: string, email: string, password: string, oab?: string, officeData?: OfficeRegistrationData): Promise<boolean> => {
    if (isSupabaseConfigured && supabase) {
      // 1. Create User
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            role: 'Advogado',
            oab: oab || '',
            username: '@' + name.toLowerCase().replace(/\s+/g, '')
          }
        }
      });
      
      if (error) throw new Error(error.message);
      if (data.user && data.user.identities && data.user.identities.length === 0) {
         throw new Error('Este email já está cadastrado.');
      }

      // Se a sessão for criada (auto-confirm ou mock), criamos o escritório
      if (data.user && officeData) {
          try {
              if (officeData.mode === 'create' && officeData.name) {
                  // Passamos o ID explicitamente pois a sessão pode não estar propagada no contexto do storageService ainda
                  const newOffice = await storageService.createOffice({
                      name: officeData.name,
                      handle: officeData.handle,
                      location: 'Brasil'
                  }, data.user.id, { name, email });
                  
                  await supabase.auth.updateUser({
                      data: { 
                          offices: [newOffice.id],
                          currentOfficeId: newOffice.id
                      }
                  });
              } else if (officeData.mode === 'join') {
                  const joinedOffice = await storageService.joinOffice(officeData.handle);
                  await supabase.auth.updateUser({
                      data: { 
                          offices: [joinedOffice.id],
                          currentOfficeId: joinedOffice.id
                      }
                  });
              }
          } catch (officeError: any) {
              console.error("Falha ao configurar escritório:", officeError);
          }
      }

      return !data.session; // Retorna true se precisar verificar email
    } else {
      // Mock Service
      const user = await authMockService.register(name, email, password, oab, officeData);
      setUser(user);
      setIsAuthenticated(true);
      localStorage.setItem('@JurisControl:user', JSON.stringify(user));
      localStorage.setItem('@JurisControl:lastActivity', Date.now().toString());
      return false; 
    }
  }, []);

  const recoverPassword = useCallback(async (email: string): Promise<boolean> => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/#/reset-password',
      });
      if (error) throw new Error(error.message);
      return true;
    } else {
      return authMockService.recoverPassword(email);
    }
  }, []);

  const socialLogin = useCallback(async (provider: AuthProviderType) => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider as any,
      });
      if (error) throw new Error(error.message);
    } else {
      const user = await authMockService.loginSocial(provider);
      setUser(user);
      setIsAuthenticated(true);
      localStorage.setItem('@JurisControl:user', JSON.stringify(user));
      localStorage.setItem('@JurisControl:lastActivity', Date.now().toString());
    }
  }, []);

  const updateProfile = useCallback(async (data: Partial<User>) => {
    setUser(prev => {
        if (!prev) return null;
        const newUser = { ...prev, ...data };
        if (!isSupabaseConfigured) {
            localStorage.setItem('@JurisControl:user', JSON.stringify(newUser));
        }
        return newUser;
    });

    if (isSupabaseConfigured && supabase) {
        const updates: any = {};
        if (data.name) updates.full_name = data.name;
        if (data.avatar) updates.avatar_url = data.avatar;
        if (data.phone) updates.phone = data.phone;
        if (data.oab) updates.oab = data.oab;
        if (data.username) updates.username = data.username;
        if (data.offices) updates.offices = data.offices;
        if (data.currentOfficeId) updates.currentOfficeId = data.currentOfficeId;

        await supabase.auth.updateUser({ data: updates });
    }
  }, []);

  const contextValue = useMemo(() => ({
    isAuthenticated,
    user,
    login,
    register,
    recoverPassword,
    socialLogin,
    updateProfile,
    logout: () => logout(false),
    isLoading
  }), [isAuthenticated, user, login, register, recoverPassword, socialLogin, updateProfile, logout, isLoading]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
