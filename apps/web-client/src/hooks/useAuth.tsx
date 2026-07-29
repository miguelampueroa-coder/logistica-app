'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from '@/lib/api';

const TOKEN_KEY = 'enviazo_token';

interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  profile: any | null;
  token: string | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, phone?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      const stored = localStorage.getItem(TOKEN_KEY);

      if (!stored) {
        setIsLoading(false);
        return;
      }

      try {
        const { profile: profileData } = await api.user.getProfile(stored);
        setToken(stored);
        setProfile(profileData);
        setUser({
          id: profileData.id,
          email: profileData.email,
          name: profileData.name,
          role: profileData.role,
        });
      } catch {
        localStorage.removeItem(TOKEN_KEY);
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  const applySession = async (authToken: string, userData: AuthUser) => {
    localStorage.setItem(TOKEN_KEY, authToken);
    setToken(authToken);
    setUser(userData);

    const { profile: profileData } = await api.user.getProfile(authToken);
    setProfile(profileData);
  };

  const signIn = async (email: string, password: string) => {
    const { token: authToken, user: userData } = await api.auth.login({ email, password });
    await applySession(authToken, userData);
  };

  const signUp = async (email: string, password: string, name: string, phone?: string) => {
    const { token: authToken, user: userData } = await api.auth.register({
      email,
      password,
      name,
      phone,
      role: 'client',
    });
    await applySession(authToken, userData);
  };

  const signOut = async () => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setProfile(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, profile, token, isLoading, signIn, signUp, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
