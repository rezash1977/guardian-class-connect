import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../integrations/supabase/client'; // بازگشت به مسیر نسبی
import { useNavigate } from 'react-router-dom';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  userRole: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); // شروع با حالت لودینگ
  const navigate = useNavigate();

  useEffect(() => {
    // onAuthStateChange به تنهایی کافی است
    // این تابع بلافاصله پس از بارگذاری کامپوننت با وضعیت فعلی (از حافظه) اجرا می‌شود
    // و سپس منتظر تغییرات می‌ماند
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // اگر کاربر لاگین بود، نقش او را واکشی کن
          const { data: roleRow } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', session.user.id)
            .maybeSingle();
          setUserRole(roleRow?.role ?? null);
        } else {
          // اگر کاربر لاگین نبود، نقش را پاک کن
          setUserRole(null);
        }
        
        // در هر صورت (چه کاربر لاگین بود چه نبود)،
        // کار بررسی وضعیت تمام شده و لودینگ باید متوقف شود
        setLoading(false);
      }
    );

    // پاک کردن لیسنر هنگام آن-مانت شدن کامپوننت
    return () => subscription.unsubscribe();
  }, []); // اجرای فقط یک بار در زمان مانت شدن

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setUserRole(null);
    navigate('/login');
  };

  return (
    <AuthContext.Provider value={{ user, session, userRole, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
