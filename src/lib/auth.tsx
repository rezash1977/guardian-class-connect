import { supabase } from '@/integrations/supabase/client';
import { Session, User } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  signOut: () => Promise<void>;
  loading: boolean;
  userRole: string | null;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ✅ گرفتن نقش کاربر از جدول user_roles
  const fetchUserRole = async (userId: string) => {
    console.log('AuthProvider: Fetching user role for:', userId);
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('AuthProvider: Error fetching user role:', error);
        setUserRole(null);
        return;
      }

      if (data?.role) {
        console.log('AuthProvider: User role found:', data.role);
        setUserRole(data.role);
      } else {
        console.log('AuthProvider: No role found for this user');
        setUserRole(null);
      }
    } catch (err) {
      console.error('AuthProvider: Exception while fetching role:', err);
      setUserRole(null);
    }
  };

  // ✅ مقداردهی اولیه و listener برای تغییر وضعیت Auth
  useEffect(() => {
    let initialized = false;

    const initAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) console.error('AuthProvider: getSession error:', error);

        const currentSession = data?.session ?? null;
        const currentUser = currentSession?.user ?? null;

        setSession(currentSession);
        setUser(currentUser);

        if (currentUser) await fetchUserRole(currentUser.id);
      } catch (err) {
        console.error('AuthProvider: initAuth error:', err);
      } finally {
        initialized = true;
        setLoading(false); // ✅ همیشه false می‌شود
      }
    };

    initAuth();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('AuthProvider: Auth state changed:', event);
        setSession(session);
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          await fetchUserRole(currentUser.id);
        } else {
          setUserRole(null);
        }

        if (initialized) setLoading(false);
      }
    );

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    console.log('AuthProvider: Signing out...');
    setLoading(true);
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setUserRole(null);
    setLoading(false);
  };

  const value = {
    session,
    user,
    signOut,
    loading,
    userRole,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
