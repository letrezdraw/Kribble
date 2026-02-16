import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../services/api';

interface User {
  id: string;
  username: string;
  email?: string;
  avatarId: string;
  level: number;
  xp: number;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  guest: (username?: string) => Promise<void>;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}


const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (!token) {
      setLoading(false);
      return;
    }

    // First set user from localStorage for immediate display
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        // Invalid JSON, continue to fetch from server
      }
    }

    try {
      const response = await api.get('/auth/me');
      setUser(response.data.user);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    } catch (error) {
      // Only clear storage if token is actually invalid, not for network errors
      const isAuthError = (error as any).response?.status === 401;
      if (isAuthError) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
      }
      // If it's a network error, keep the stored user data
    } finally {
      setLoading(false);
    }
  };



  const login = async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', response.data.token);
    localStorage.setItem('user', JSON.stringify(response.data.user));
    setUser(response.data.user);
  };

  const register = async (username: string, email: string, password: string) => {
    const response = await api.post('/auth/register', { username, email, password });
    localStorage.setItem('token', response.data.token);
    localStorage.setItem('user', JSON.stringify(response.data.user));
    setUser(response.data.user);
  };

  const guest = async (username?: string) => {
    const response = await api.post('/auth/guest', { username });
    localStorage.setItem('token', response.data.token);
    localStorage.setItem('user', JSON.stringify(response.data.user));
    setUser(response.data.user);
  };

  const logout = () => {

    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };


  const updateUser = (updates: Partial<User>) => {
    setUser(prev => prev ? { ...prev, ...updates } : null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, guest, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );

}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
