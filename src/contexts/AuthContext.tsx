import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { rateLimiter } from "@/lib/rateLimiter";

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  avatar?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (mounted && data?.session?.user) {
          const u = data.session.user;
          setUser({
            id: u.id,
            name: u.user_metadata.name || u.email?.split('@')[0] || 'User',
            email: u.email || '',
            role: u.user_metadata.role || 'user',
            avatar: u.user_metadata.avatar_url,
          });
        }
      } catch (err) {
        console.error("Auth init error:", err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        if (session?.user) {
          setUser({
            id: session.user.id,
            name: session.user.user_metadata.name || session.user.email?.split('@')[0] || 'User',
            email: session.user.email || '',
            role: session.user.user_metadata.role || 'user',
            avatar: session.user.user_metadata.avatar_url,
          });
        } else {
          setUser(null);
        }
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    try {
      // Use rate limiter to prevent exceeding Supabase limits
      // Login has higher priority (1) than other requests
      const { error } = await rateLimiter.execute(
        () => supabase.auth.signInWithPassword({ email, password }),
        1 // High priority for auth
      );

      if (error) {
        // Check if it's a rate limiting error
        if (error.message?.includes('too many') || error.message?.includes('rate')) {
          return { 
            success: false, 
            error: 'Too many login attempts. Please wait a moment and try again.' 
          };
        }
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      console.error('Login error:', err);
      return { success: false, error: err.message || 'Login failed. Please try again.' };
    }
  };

  const register = async (name: string, email: string, password: string) => {
    try {
      // Use rate limiter for registration
      const { error } = await rateLimiter.execute(
        () => supabase.auth.signUp({
          email, password,
          options: { data: { name, role: 'user' } }
        }),
        1 // High priority for auth
      );

      if (error) {
        if (error.message?.includes('too many') || error.message?.includes('rate')) {
          return { 
            success: false, 
            error: 'Too many registration attempts. Please wait a moment and try again.' 
          };
        }
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      console.error('Registration error:', err);
      return { success: false, error: err.message || 'Registration failed. Please try again.' };
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error(err);
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, login, register, logout, 
      isAuthenticated: !!user, isLoading 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
