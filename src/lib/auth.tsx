import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

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
    if (!isSupabaseConfigured) {
      console.error('Supabase not configured - auth disabled in UI');
      toast.error('تنظیمات Supabase ناقص است. لطفاً متغیرهای محیطی را بررسی کنید.');
      setLoading(false);
      return;
    }
    // set up auth state listener defensively and handle token refresh failures
    const result = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        if (!mounted) return;
        // Handle token refresh failures explicitly
  if ((event as string) === 'TOKEN_REFRESH_FAILED') {
          console.warn('Auth event: TOKEN_REFRESH_FAILED — clearing local session and redirecting to login');
          try {
            await supabase.auth.signOut();
          } catch (e) {
            console.warn('Error during signOut after token refresh failed', e);
          }
          if (mounted) {
            setUser(null);
            setSession(null);
            setProfile(null);
            setUserRole(null);
            setLoading(false);
            navigate('/login');
          }
          return;
        }

        console.debug('Auth state change:', { event, session, hasUser: !!session?.user });
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
            console.error('Error fetching profile/role on auth change:', err);
            if (mounted) {
              setProfile(null);
              setUserRole(null);
            }
          }
        } else {
          if (mounted) {
            setProfile(null);
            setUserRole(null);
          }
        }
      } catch (err) {
        console.error('Unhandled error in onAuthStateChange handler:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    });

    // Immediately check existing session on mount
    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.error('getSession error:', error);
          // If the error indicates bad refresh token, force sign out and redirect
          if ((error as any)?.message?.includes?.('Invalid Refresh Token')) {
            try { await supabase.auth.signOut(); } catch (e) { /* ignore */ }
            if (mounted) {
              localStorage.clear();
              setUser(null);
              setSession(null);
              setProfile(null);
              setUserRole(null);
              navigate('/login');
            }
          }
          return;
        }

        const session = data?.session ?? null;
        if (!mounted) return;
        setSession(session);
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
            console.error('Error loading user profile/role on init:', err);
          }
        }
      } catch (err: any) {
        console.error('Unexpected error while initializing session:', err);
        if (err?.message?.includes?.('Invalid Refresh Token')) {
          try { await supabase.auth.signOut(); } catch (e) { /* ignore */ }
          if (mounted) {
            localStorage.clear();
            setUser(null);
            setSession(null);
            setProfile(null);
            setUserRole(null);
            navigate('/login');
          }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      try {
        // handle different return shapes for the listener
        // @ts-ignore
        const subscription = result?.data?.subscription ?? result?.subscription;
        if (subscription && typeof subscription.unsubscribe === 'function') {
          subscription.unsubscribe();
        }
      } catch (e) {
        console.warn('Error during auth listener cleanup', e);
      }
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setUserRole(null);
    navigate('/login');
  };

  return (
    <AuthContext.Provider value={{ user, session, userRole, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
