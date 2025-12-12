
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
  updateProfile: (data: Partial<User>) => Promise<void>;
  requestReactivationOtp: (email: string) => Promise<void>;
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

  // Activity Monitor
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

  // Initial Session Check
  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      try {
        if (isSupabaseConfigured && supabase) {
          const { data, error } = await supabase.auth.getSession();
          
          if (error) {
            if (mounted) {
              logout(false);
              setIsLoading(false);
            }
            return;
          }

          if (mounted) {
              if (data.session?.user) {
                await handleUserSessionValidation(data.session);
              } else {
                setUser(null);
                setIsAuthenticated(false);
              }
          }
          
          const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!mounted) return;
            
            if (event === 'SIGNED_IN' && session?.user) {
               await handleUserSessionValidation(session);
            } else if (event === 'SIGNED_OUT') {
               setUser(null);
               setIsAuthenticated(false);
            } else if (session?.user) {
               // Refresh profile data on token refresh or other events
               await loadProfileAndMap(session.user);
            }
          });

          return () => subscription.unsubscribe();
        } else {
          // Fallback LocalStorage (Strictly Dev/Demo)
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

  const processPendingSetup = async (session: any) => {
    if (!isSupabaseConfigured || !supabase) return;

    const sbUser = session.user;
    const metadata = sbUser.user_metadata || {};
    
    if (metadata.pending_office_setup) {
        const { mode, name, handle } = metadata.pending_office_setup;
        
        try {
            await storageService.ensureProfileExists();
            
            // Wait a small delay to ensure triggers have run
            await new Promise(r => setTimeout(r, 1000));

            if (mode === 'create' && name && handle) {
                const newOffice = await storageService.createOffice({
                    name,
                    handle,
                    location: 'Brasil'
                }, sbUser.id); // Explicitly pass ID to avoid context race

                await supabase!.auth.updateUser({
                    data: { 
                        pending_office_setup: null,
                        offices: [newOffice.id],
                        currentOfficeId: newOffice.id
                    }
                });
                return true; 
            } else if (mode === 'join' && handle) {
                const joinedOffice = await storageService.joinOffice(handle);
                
                await supabase!.auth.updateUser({
                    data: { 
                        pending_office_setup: null,
                        offices: [joinedOffice.id],
                        currentOfficeId: joinedOffice.id
                    }
                });
                return true;
            }
        } catch (e) {
            console.error("Error processing pending office setup:", e);
        }
    }
    return false;
  };

  const handleUserSessionValidation = async (session: any) => {
      const sbUser = session.user;
      
      const status = await storageService.checkAccountStatus(sbUser.id);
      
      if (status.deleted_at) {
          const amr = session.user?.amr || []; 
          const isOtpLogin = amr.some((m: any) => m.method === 'otp' || m.method === 'magic_link' || m.method === 'link');

          if (isOtpLogin) {
              try {
                  await storageService.reactivateAccount();
                  addToast('Sua conta foi reativada com sucesso!', 'success');
                  await processPendingSetup(session);
                  if (supabase) {
                    const { data: { user: refreshedUser } } = await supabase.auth.getUser();
                    await loadProfileAndMap(refreshedUser || sbUser);
                  }
              } catch (e) {
                  await logout(false);
              }
          } else {
              await logout(false);
          }
      } else {
          const updated = await processPendingSetup(session);
          
          if (updated && supabase) {
             const { data: { user: refreshedUser } } = await supabase.auth.getUser();
             await loadProfileAndMap(refreshedUser || sbUser);
          } else {
             await loadProfileAndMap(sbUser);
          }
      }
  };

  const loadProfileAndMap = async (sbUser: any) => {
      let profileData = null;
      if (isSupabaseConfigured && supabase) {
          const { data } = await supabase
              .from('profiles')
              .select('full_name, username, avatar_url, phone, oab, email')
              .eq('id', sbUser.id)
              .single();
          profileData = data;
      }
      mapSupabaseUserToContext(sbUser, profileData);
  };

  const mapSupabaseUserToContext = (sbUser: any, profileData: any = null) => {
    const meta = sbUser.user_metadata || {};
    
    // Prefer data from public.profiles table if available (supports larger payloads)
    const name = profileData?.full_name || meta.full_name || meta.name || 'Usuário';
    const avatar = profileData?.avatar_url || meta.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff`;
    const username = profileData?.username || meta.username || '';
    const phone = profileData?.phone || meta.phone || '';
    const oab = profileData?.oab || meta.oab || '';

    const mappedUser: User = {
      id: sbUser.id,
      name,
      username,
      email: sbUser.email || '',
      avatar,
      provider: sbUser.app_metadata?.provider || 'email',
      offices: meta.offices || [],
      currentOfficeId: meta.currentOfficeId,
      twoFactorEnabled: false,
      emailVerified: !!sbUser.email_confirmed_at,
      phone,
      oab,
      role: meta.role || 'Advogado'
    };
    setUser(mappedUser);
    setIsAuthenticated(true);
  };

  const login = useCallback(async (email: string, password: string) => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);

      if (data.user) {
          const status = await storageService.checkAccountStatus(data.user.id);
          
          if (status.deleted_at) {
              await supabase.auth.signOut();
              const err = new Error('Esta conta foi excluída. Reative via e-mail.');
              (err as any).code = 'ACCOUNT_SUSPENDED'; 
              throw err;
          }
      }
    } else {
      const user = await authMockService.login(email, password);
      setUser(user);
      setIsAuthenticated(true);
      localStorage.setItem('@JurisControl:user', JSON.stringify(user));
      localStorage.setItem('@JurisControl:lastActivity', Date.now().toString());
    }
  }, []);

  const requestReactivationOtp = useCallback(async (email: string) => {
      if (isSupabaseConfigured && supabase) {
          const { error } = await supabase.auth.signInWithOtp({
              email,
              options: {
                  shouldCreateUser: false
              }
          });
          if (error) throw new Error("Erro ao enviar e-mail: " + error.message);
      } else {
          await storageService.reactivateAccount();
      }
  }, []);

  const register = useCallback(async (name: string, email: string, password: string, oab?: string, officeData?: OfficeRegistrationData): Promise<boolean> => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            role: 'Advogado',
            oab: oab || '',
            username: '@' + name.toLowerCase().replace(/\s+/g, ''),
            pending_office_setup: officeData 
          }
        }
      });
      
      if (error) throw new Error(error.message);
      if (data.user && data.user.identities && data.user.identities.length === 0) {
         throw new Error('Este email já está cadastrado.');
      }

      return !data.session; 
    } else {
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
    // 1. Optimistic Update (UI)
    setUser(prev => {
        if (!prev) return null;
        const newUser = { ...prev, ...data };
        if (!isSupabaseConfigured) {
            localStorage.setItem('@JurisControl:user', JSON.stringify(newUser));
        }
        return newUser;
    });

    // 2. Persist to Supabase
    if (isSupabaseConfigured && supabase) {
        // Update Auth Metadata (limitado, pode falhar com base64 grande)
        const authUpdates: any = {};
        if (data.name) authUpdates.full_name = data.name;
        if (data.avatar && data.avatar.length < 2048) authUpdates.avatar_url = data.avatar; // Only sync small avatars to auth
        if (data.phone) authUpdates.phone = data.phone;
        if (data.oab) authUpdates.oab = data.oab;
        if (data.username) authUpdates.username = data.username;
        if (data.offices) authUpdates.offices = data.offices;
        if (data.currentOfficeId) authUpdates.currentOfficeId = data.currentOfficeId;

        if (Object.keys(authUpdates).length > 0) {
            await supabase.auth.updateUser({ data: authUpdates });
        }

        // Update Profiles Table (Source of truth for large data like base64 avatars)
        if (user?.id) {
            const tableUpdates: any = {};
            if (data.name) tableUpdates.full_name = data.name;
            if (data.avatar) tableUpdates.avatar_url = data.avatar;
            if (data.phone) tableUpdates.phone = data.phone;
            if (data.oab) tableUpdates.oab = data.oab;
            if (data.username) tableUpdates.username = data.username;

            if (Object.keys(tableUpdates).length > 0) {
               const { error } = await supabase
                  .from('profiles')
                  .update(tableUpdates)
                  .eq('id', user.id);
               
               if (error) console.error("Error updating profiles table:", error);
            }
        }
    }
  }, [user]);

  const contextValue = useMemo(() => ({
    isAuthenticated,
    user,
    login,
    register,
    recoverPassword,
    socialLogin,
    updateProfile,
    requestReactivationOtp,
    logout: () => logout(false),
    isLoading
  }), [isAuthenticated, user, login, register, recoverPassword, socialLogin, updateProfile, requestReactivationOtp, logout, isLoading]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
