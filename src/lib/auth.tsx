import { createContext, useContext, useEffect, useState, ReactNode } from 'react'; // Import ReactNode
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: string | null;
  loading: boolean; // Indicates initial auth state loading
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  userRole: null,
  loading: true, // Start as true
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

// Define props type for AuthProvider
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => { // Use defined props type
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); // Initialize loading state
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true; // Flag to prevent state updates on unmounted component
    setLoading(true); // Ensure loading is true at the start

    // --- Check initial session ---
    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      if (!isMounted) return; // Don't update state if component unmounted

      setSession(initialSession);
      setUser(initialSession?.user ?? null);

      if (initialSession?.user) {
        // Fetch role only if session exists initially
        try {
            const { data, error } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', initialSession.user.id)
              .maybeSingle();

            if (error && isMounted) {
                 console.error("Error fetching initial role:", error);
                 setUserRole(null);
            } else if (isMounted) {
                 setUserRole(data?.role ?? null);
            }
        } catch(e) {
             if (isMounted) {
                 console.error("Exception fetching initial role:", e);
                 setUserRole(null);
             }
        } finally {
             if (isMounted) setLoading(false); // Set loading to false *after* initial check
        }
      } else {
        // No initial session
        if (isMounted) {
            setUserRole(null);
            setLoading(false); // Set loading to false *after* initial check
        }
      }
    }).catch(error => {
         // Handle potential errors during getSession itself
         if (isMounted) {
             console.error("Error in getSession:", error);
             setUserRole(null);
             setLoading(false);
         }
    });


    // --- Set up auth state listener ---
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (!isMounted) return; // Don't update state if component unmounted

        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          // Fetch role when auth state changes to signed in
          try {
              const { data, error } = await supabase
                  .from('user_roles')
                  .select('role')
                  .eq('user_id', newSession.user.id)
                  .maybeSingle();

              if (error && isMounted) {
                   console.error("Error fetching role on auth change:", error);
                   setUserRole(null);
              } else if (isMounted) {
                   setUserRole(data?.role ?? null);
              }
          } catch(e) {
               if(isMounted) {
                   console.error("Exception fetching role on auth change:", e);
                   setUserRole(null);
               }
          } finally {
               // Ensure loading is false if this is the first effective auth check
               if (loading && isMounted) setLoading(false);
          }
        } else {
          // User signed out
          if (isMounted) {
              setUserRole(null);
              // Ensure loading is false if this is the first effective auth check
               if (loading) setLoading(false);
          }
        }
      }
    );

    // Cleanup function
    return () => {
        isMounted = false; // Set flag when component unmounts
        subscription?.unsubscribe();
    };
  }, []); // Run only once on mount

  const signOut = async () => {
    setLoading(true); // Indicate loading during sign out
    try {
        await supabase.auth.signOut();
        // State updates (user, session, role) will happen via onAuthStateChange listener
        navigate('/login');
    } catch (error) {
        console.error("Sign out error:", error);
        toast.error("خطا در خروج از سیستم.");
    } finally {
         // It's okay if loading remains true briefly, as listener will set it false
         // setLoading(false); // Can be omitted as listener handles it
    }
  };

  // Provide the loading state from AuthProvider
  return (
    <AuthContext.Provider value={{ user, session, userRole, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
