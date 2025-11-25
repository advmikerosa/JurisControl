import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { User, AuthProvider as AuthProviderType } from '../types';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { authMockService } from '../services/authMockService';
import { useToast } from './ToastContext';

interface AuthContextData {
  isAuthenticated: boolean;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, oab?: string) => Promise<boolean>;
  recoverPassword: (email: string) => Promise<boolean>;
  socialLogin: (provider: AuthProviderType) => Promise<void>;
  updateProfile: (data: Partial<User>) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

// Time in milliseconds (30 minutes)
const INACTIVITY_LIMIT = 30 * 60 * 1000; 
const ACTIVITY_THROTTLE = 5000; // Only update activity timestamp at most every 5 seconds

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { addToast } = useToast();
  const lastActivityUpdate = useRef<number>(Date.now());

  // Memoized logout function
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

  // Activity Monitoring with Throttling
  useEffect(() => {
    if (!isAuthenticated) return;

    let inactivityTimer: ReturnType<typeof setTimeout>;

    const resetInactivityTimer = () => {
      const now = Date.now();
      // Optimization: Throttle updates to local storage
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
    
    // Check immediate expiration on load
    const lastActivity = parseInt(localStorage.getItem('@JurisControl:lastActivity') || '0');
    if (lastActivity > 0 && Date.now() - lastActivity > INACTIVITY_LIMIT) {
      logout(true);
    } else {
      resetInactivityTimer(); // Start timer
      events.forEach(event => window.addEventListener(event, resetInactivityTimer));
    }

    return () => {
      clearTimeout(inactivityTimer);
      events.forEach(event => window.removeEventListener(event, resetInactivityTimer));
    };
  }, [isAuthenticated, logout]);

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      if (isSupabaseConfigured && supabase) {
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
          try {
            setUser(JSON.parse(storedUser));
            setIsAuthenticated(true);
          } catch {
            localStorage.removeItem('@JurisControl:user');
          }
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

  const register = useCallback(async (name: string, email: string, password: string, oab?: string): Promise<boolean> => {
    if (isSupabaseConfigured && supabase) {
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
      return !data.session;
    } else {
      await authMockService.register(name, email, password, oab);
      return true; 
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

        const { error } = await supabase.auth.updateUser({ data: updates });
        if (error) console.error("Error updating Supabase profile", error);
    }
  }, []);

  // Performance Optimization: Memoize the context value to prevent unnecessary re-renders
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