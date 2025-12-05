
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
               // Apenas atualização de token ou initial session
               // Para evitar loop, chamamos map diretamente se não for SIGNED_IN
               mapSupabaseUserToContext(session.user);
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

  /**
   * Process Pending Office Setup
   * Checks if user has a pending office creation request from sign up and executes it.
   */
  const processPendingSetup = async (session: any) => {
    if (!isSupabaseConfigured || !supabase) return;

    const sbUser = session.user;
    const metadata = sbUser.user_metadata || {};
    
    if (metadata.pending_office_setup) {
        console.log("Found pending office setup, processing...", metadata.pending_office_setup);
        const { mode, name, handle } = metadata.pending_office_setup;
        
        try {
            await storageService.ensureProfileExists();

            if (mode === 'create' && name && handle) {
                const newOffice = await storageService.createOffice({
                    name,
                    handle,
                    location: 'Brasil'
                }); // uses session implicitly via storageService internals

                // Update metadata: clear pending, set current office (cache)
                // Use non-null assertion (!) because we guarded isSupabaseConfigured && supabase at top
                await supabase!.auth.updateUser({
                    data: { 
                        pending_office_setup: null,
                        offices: [newOffice.id],
                        currentOfficeId: newOffice.id
                    }
                });
                return true; // Indicates an update happened
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
            // We don't clear the pending setup on error so it might retry later or user can manually fix
        }
    }
    return false;
  };

  /**
   * Lógica Central de Validação de Usuário (Soft Delete / Reactivation / Pending Setup)
   */
  const handleUserSessionValidation = async (session: any) => {
      const sbUser = session.user;
      
      // 1. Checar status da conta (Soft Delete) no banco
      const status = await storageService.checkAccountStatus(sbUser.id);
      
      if (status.deleted_at) {
          // A conta está marcada como deletada.
          const amr = session.user?.amr || []; 
          const isOtpLogin = amr.some((m: any) => m.method === 'otp' || m.method === 'magic_link' || m.method === 'link');

          if (isOtpLogin) {
              // Usuário clicou no link de reativação -> Reativar automaticamente
              try {
                  await storageService.reactivateAccount();
                  addToast('Sua conta foi reativada com sucesso!', 'success');
                  // Process pending setup after reactivation if needed
                  await processPendingSetup(session);
                  // Refresh user data
                  if (supabase) {
                    const { data: { user: refreshedUser } } = await supabase.auth.getUser();
                    mapSupabaseUserToContext(refreshedUser || sbUser);
                  }
              } catch (e) {
                  console.error("Erro na reativação automática", e);
                  await logout(false);
              }
          } else {
              // Login por senha ou sessão antiga -> Bloquear
              console.warn("Bloqueando acesso: Conta suspensa e login não foi via OTP.");
              await logout(false);
          }
      } else {
          // Conta ativa normal
          const updated = await processPendingSetup(session);
          
          if (updated && supabase) {
             // If we updated metadata (processed office), fetch fresh user object
             const { data: { user: refreshedUser } } = await supabase.auth.getUser();
             mapSupabaseUserToContext(refreshedUser || sbUser);
          } else {
             mapSupabaseUserToContext(sbUser);
          }
      }
  };

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
      // 1. Authenticate with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);

      // 2. Check "Soft Delete" status immediately AFTER login
      if (data.user) {
          const status = await storageService.checkAccountStatus(data.user.id);
          
          if (status.deleted_at) {
              // IMPORTANTE: Forçar logout imediato para não manter sessão válida
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
          // Mock mode: Just re-enable immediately
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
            // CRITICAL: Save office intent in metadata for execution after email confirmation/login
            pending_office_setup: officeData 
          }
        }
      });
      
      if (error) throw new Error(error.message);
      if (data.user && data.user.identities && data.user.identities.length === 0) {
         throw new Error('Este email já está cadastrado.');
      }

      // If we have a session immediately (auto-confirm enabled), we can try to process immediately to avoid delay
      // Otherwise, the handleUserSessionValidation logic will pick it up on first login
      if (data.session && data.user && officeData) {
          try {
              if (officeData.mode === 'create' && officeData.name) {
                  const newOffice = await storageService.createOffice({
                      name: officeData.name,
                      handle: officeData.handle,
                      location: 'Brasil'
                  }, data.user.id, { name, email });
                  
                  // Clear pending setup since we did it
                  await supabase.auth.updateUser({
                      data: { 
                          pending_office_setup: null,
                          offices: [newOffice.id], 
                          currentOfficeId: newOffice.id 
                      }
                  });

              } else if (officeData.mode === 'join') {
                  const joinedOffice = await storageService.joinOffice(officeData.handle);
                  await supabase.auth.updateUser({
                      data: { 
                          pending_office_setup: null,
                          offices: [joinedOffice.id], 
                          currentOfficeId: joinedOffice.id 
                      }
                  });
              }
          } catch (officeError: any) {
              console.warn("Immediate office creation failed (likely expected if session weak), will retry on login:", officeError);
              // Do not throw here, user is created. We rely on the pending_office_setup metadata fallback.
          }
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
