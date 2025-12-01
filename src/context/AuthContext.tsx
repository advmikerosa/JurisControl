
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { User, AuthProvider as AuthProviderType } from '../types';
import { authMockService } from '../services/authMockService';
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
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('@JurisControl:user');
    localStorage.removeItem('@JurisControl:lastActivity');
    
    if (isAutoLogout) {
      addToast('Sessão expirada por inatividade.', 'warning');
    }
  }, [addToast]);

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

  useEffect(() => {
    // Check LocalStorage Session
    const storedUser = localStorage.getItem('@JurisControl:user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
        setIsAuthenticated(true);
      } catch {
        localStorage.removeItem('@JurisControl:user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const user = await authMockService.login(email, password);
    setUser(user);
    setIsAuthenticated(true);
    localStorage.setItem('@JurisControl:user', JSON.stringify(user));
    localStorage.setItem('@JurisControl:lastActivity', Date.now().toString());
  }, []);

  const register = useCallback(async (name: string, email: string, password: string, oab?: string, officeData?: OfficeRegistrationData): Promise<boolean> => {
    const user = await authMockService.register(name, email, password, oab, officeData);
    setUser(user);
    setIsAuthenticated(true);
    localStorage.setItem('@JurisControl:user', JSON.stringify(user));
    localStorage.setItem('@JurisControl:lastActivity', Date.now().toString());
    return false; 
  }, []);

  const recoverPassword = useCallback(async (email: string): Promise<boolean> => {
    return authMockService.recoverPassword(email);
  }, []);

  const socialLogin = useCallback(async (provider: AuthProviderType) => {
    const user = await authMockService.loginSocial(provider);
    setUser(user);
    setIsAuthenticated(true);
    localStorage.setItem('@JurisControl:user', JSON.stringify(user));
    localStorage.setItem('@JurisControl:lastActivity', Date.now().toString());
  }, []);

  const updateProfile = useCallback(async (data: Partial<User>) => {
    setUser(prev => {
        if (!prev) return null;
        const newUser = { ...prev, ...data };
        localStorage.setItem('@JurisControl:user', JSON.stringify(newUser));
        return newUser;
    });
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
