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
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        try {
          setSession(session);
          setUser(session?.user ?? null);
          
          if (session?.user) {
            // Fetch both role and profile data
            const [{ data: profileData, error: profileError }, { data: roleRow, error: roleError }] = await Promise.all([
              supabase
                .from('profiles')
                .select('id, full_name, username')
                .eq('id', session.user.id)
                .maybeSingle(),
              supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', session.user.id)
                .maybeSingle()
            ]);

            if (profileError) {
              console.error('Error fetching profile:', profileError);
            }
            if (roleError) {
              console.error('Error fetching role:', roleError);
            }

            // Only update state if we got valid data
            if (profileData && roleRow?.role) {
              setProfile(profileData);
              setUserRole(roleRow.role);
            } else {
              console.error('Missing profile or role data:', { profileData, roleRow });
            }
          } else {
            setProfile(null);
            setUserRole(null);
          }
        } catch (error) {
          console.error('Error in auth state change:', error);
        } finally {
          setLoading(false);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      try {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Fetch both role and profile data
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
              .maybeSingle()
          ]);

          // Only update state if we got valid data
          if (profileData && roleRow?.role) {
            setProfile(profileData);
            setUserRole(roleRow.role);
          } else {
            console.error('Missing profile or role data:', { profileData, roleRow });
          }
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      } finally {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
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
