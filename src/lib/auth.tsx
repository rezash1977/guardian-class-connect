import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface Profile {
  id: string;
  full_name: string;
  username: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: string | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  userRole: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      try {
        // بارگذاری session موجود
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        const currentSession = data?.session ?? null;
        if (!mounted) return;

        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          // بارگذاری پروفایل و نقش
          const [{ data: profileData }, { data: roleRow }] = await Promise.all([
            supabase
              .from('profiles')
              .select('id, full_name, username')
              .eq('id', currentSession.user.id)
              .maybeSingle(),
            supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', currentSession.user.id)
              .maybeSingle(),
          ]);

          if (!mounted) return;
          setProfile(profileData ?? null);
          setUserRole(roleRow?.role ?? null);
        }
      } catch (err) {
        console.error('Error initializing session:', err);
        setUser(null);
        setSession(null);
        setProfile(null);
        setUserRole(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initialize();

    // لیسنر تغییر وضعیت احراز هویت
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      setSession(session ?? null);
      setUser(session?.user ?? null);

      if (session?.user) {
        try {
          const [{ data: profileData }, { data: roleRow }] = await Promise.all([
            supabase
              .from('profiles')
              .select('id, full_name, username')
              .eq('id', session.user.id)
              .maybeSingle(),
            supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', session.user.id)
              .maybeSingle(),
          ]);
          if (!mounted) return;
          setProfile(profileData ?? null);
          setUserRole(roleRow?.role ?? null);
        } catch (err) {
          console.error('Error loading profile/role on auth change:', err);
          setProfile(null);
          setUserRole(null);
        }
      } else {
        setProfile(null);
        setUserRole(null);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setUserRole(null);
    setProfile(null);
    navigate('/login', { replace: true });
  };

  return (
    <AuthContext.Provider value={{ user, session, userRole, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
