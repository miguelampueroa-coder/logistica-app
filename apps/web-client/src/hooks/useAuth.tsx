'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { api } from '@/lib/api';
import { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  profile: any | null;
  token: string | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, phone?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setUser(session.user);
          setToken(session.access_token);
          
          const profileData = await api.user.getProfile(session.access_token);
          setProfile(profileData.profile);
        }
      } catch (error) {
        console.error('Session check error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          setUser(session.user);
          setToken(session.access_token);
          
          const profileData = await api.user.getProfile(session.access_token);
          setProfile(profileData.profile);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
          setToken(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { token: authToken, user: userData } = await api.auth.login({ email, password });
    setToken(authToken);
    
    const { data: { session } } = await supabase.auth.signInWithPassword({ email, password });
    if (session) {
      setUser(session.user);
    }
    
    const profileData = await api.user.getProfile(authToken);
    setProfile(profileData.profile);
  };

  const signUp = async (email: string, password: string, name: string, phone?: string) => {
    const { token: authToken, user: userData } = await api.auth.register({
      email,
      password,
      name,
      phone,
      role: 'client',
    });
    setToken(authToken);
    
    const { data: { session } } = await supabase.auth.signInWithPassword({ email, password });
    if (session) {
      setUser(session.user);
    }
    
    const profileData = await api.user.getProfile(authToken);
    setProfile(profileData.profile);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        token,
        isLoading,
        signIn,
        signUp,
        signOut,
      }}
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
