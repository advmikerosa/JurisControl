import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthProvider as AuthProviderType } from '../types';
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
    const storedAuth = localStorage.getItem('@JurisControl:auth');
    if (storedAuth) {
      try {
        const parsedUser = JSON.parse(storedAuth);
        setUser(parsedUser);
        setIsAuthenticated(true);
      } catch (e) {
        localStorage.removeItem('@JurisControl:auth');
      }
    }
    setIsLoading(false);
  }, []);

  const saveSession = (userData: User) => {
    localStorage.setItem('@JurisControl:auth', JSON.stringify(userData));
    setUser(userData);
    setIsAuthenticated(true);
  };

  const login = async (email: string, password: string) => {
    const userData = await authMockService.login(email, password);
    saveSession(userData);
  };

  const register = async (name: string, email: string, password: string) => {
    const userData = await authMockService.register(name, email, password);
    saveSession(userData);
  };

  const socialLogin = async (provider: AuthProviderType) => {
    const userData = await authMockService.loginSocial(provider);
    saveSession(userData);
  };

  const updateProfile = (data: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...data };
      saveSession(updatedUser);
    }
  };

  const logout = () => {
    localStorage.removeItem('@JurisControl:auth');
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, register, socialLogin, updateProfile, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);