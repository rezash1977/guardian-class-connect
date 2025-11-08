import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { GraduationCap } from 'lucide-react';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const navigate = useNavigate();

  // ---------------------------
  // ✅ تابع ورود با لاگ و مدیریت خطا
  // ---------------------------
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    console.clear();
    console.groupCollapsed('%c🧭 LOGIN DEBUG START', 'color: green; font-weight: bold');

    if (!isSupabaseConfigured) {
      toast.error('تنظیمات Supabase ناقص است.');
      console.error('❌ Supabase config missing');
      setLoading(false);
      return;
    }

    try {
      if (!username || !password) {
        toast.error('نام کاربری یا رمز عبور خالی است');
        console.warn('⚠️ Missing credentials:', { username, password });
        return;
      }

      console.log('1️⃣ Fetching profile for username:', username);
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('email')
        .eq('username', username)
        .maybeSingle();

      console.log('Profile result:', { profile, profileError });

      if (profileError) {
        toast.error('خطا در بررسی نام کاربری');
        console.error('❌ Profile fetch error:', profileError);
        setLoading(false);
        return;
      }

      if (!profile?.email) {
        toast.error('کاربری با این نام یافت نشد');
        console.warn('⚠️ No profile found for username:', username);
        setLoading(false);
        return;
      }

      console.log('2️⃣ Attempting signInWithPassword for email:', profile.email);
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password,
      });

      console.log('SignIn response:', { data, signInError });

      if (signInError) {
        console.error('❌ Sign-in error:', signInError);
        toast.error('ورود ناموفق: ' + signInError.message);
        setLoading(false);
        return;
      }

      if (!data?.session) {
        console.warn('⚠️ Sign-in succeeded but no session returned:', data);
        toast.warning('ورود انجام شد ولی session دریافت نشد');
      }

      console.log('3️⃣ Signed in successfully:', {
        user: data.user,
        session: data.session,
      });

      toast.success('ورود موفقیت‌آمیز بود. در حال انتقال...');
      await new Promise((r) => setTimeout(r, 500));
      navigate('/dashboard');
    } catch (error: any) {
      console.error('💥 Unexpected login error:', error);
      toast.error('خطای غیرمنتظره: ' + error.message);
    } finally {
      console.groupEnd();
      setLoading(false);
    }
  };

  // ---------------------------
  // ✅ تابع ثبت‌نام
  // ---------------------------
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName, username } },
      });

      if (signUpError) {
        console.error('❌ Signup error:', signUpError);
        toast.error(`خطا در ثبت‌نام: ${signUpError.message}`);
      } else {
        console.log('✅ Signup success:', authData);
        toast.success('ثبت‌نام موفقیت‌آمیز بود. ایمیل خود را بررسی کنید.');
      }
    } catch (error: any) {
      console.error('💥 Signup exception:', error);
      toast.error(`خطای غیرمنتظره در ثبت‌نام: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------
  // ✅ رابط کاربری
  // ---------------------------
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center">
            <GraduationCap className="w-9 h-9 text-primary-foreground" />
          </div>
          <CardTitle className="text-3xl font-bold">سیستم مدیریت هنرستان آل محمد ص</CardTitle>
          <CardDescription>برای ورود به پنل خود، اطلاعات را وارد کنید</CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="login" className="w-full" dir="rtl">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">ورود</TabsTrigger>
              <TabsTrigger value="signup">ثبت‌نام</TabsTrigger>
            </TabsList>

            {/* --- ورود --- */}
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-username">نام کاربری</Label>
                  <Input
                    id="login-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    dir="rtl"
                    className="text-right"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">رمز عبور</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    dir="rtl"
                    className="text-right"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'در حال ورود...' : 'ورود'}
                </Button>
              </form>
            </TabsContent>

            {/* --- ثبت‌نام --- */}
            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-fullname">نام کامل</Label>
                  <Input
                    id="signup-fullname"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    dir="rtl"
                    className="text-right"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">ایمیل</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    dir="ltr"
                    className="text-left"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-username">نام کاربری</Label>
                  <Input
                    id="signup-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    dir="rtl"
                    className="text-right"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">رمز عبور</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    dir="rtl"
                    className="text-right"
                    minLength={6}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'در حال ثبت‌نام...' : 'ثبت‌نام'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
