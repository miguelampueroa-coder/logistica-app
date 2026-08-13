import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';
import { registerForPushNotifications, setupNotificationHandler } from '../services/push';

interface AuthContextType {
  user: any | null;
  profile: any | null;
  token: string | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, phone?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setupNotificationHandler();
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('auth_token');
      const storedUser = await AsyncStorage.getItem('auth_user');
      const storedProfile = await AsyncStorage.getItem('auth_profile');

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        if (storedProfile) {
          setProfile(JSON.parse(storedProfile));
        }
        registerForPushNotifications(storedToken).catch((err) =>
          console.error('Error registering push token:', err)
        );
      }
    } catch (error) {
      console.error('Error loading stored auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { token: authToken, user: userData } = await api.auth.login({ email, password });

    setToken(authToken);
    setUser(userData);

    const profileData = await api.user.getProfile(authToken);
    setProfile(profileData.profile);

    await AsyncStorage.setItem('auth_token', authToken);
    await AsyncStorage.setItem('auth_user', JSON.stringify(userData));
    await AsyncStorage.setItem('auth_profile', JSON.stringify(profileData.profile));

    registerForPushNotifications(authToken).catch((err) =>
      console.error('Error registering push token:', err)
    );
  };

  const signUp = async (email: string, password: string, name: string, phone?: string) => {
    const { token: authToken, user: userData } = await api.auth.register({
      email,
      password,
      name,
      phone,
      role: 'provider',
    });

    setToken(authToken);
    setUser(userData);

    const profileData = await api.user.getProfile(authToken);
    setProfile(profileData.profile);

    await AsyncStorage.setItem('auth_token', authToken);
    await AsyncStorage.setItem('auth_user', JSON.stringify(userData));
    await AsyncStorage.setItem('auth_profile', JSON.stringify(profileData.profile));

    registerForPushNotifications(authToken).catch((err) =>
      console.error('Error registering push token:', err)
    );
  };

  const signOut = async () => {
    setUser(null);
    setProfile(null);
    setToken(null);
    await AsyncStorage.multiRemove(['auth_token', 'auth_user', 'auth_profile']);
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
