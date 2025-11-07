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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!isSupabaseConfigured) {
      toast.error('تنظیمات Supabase ناقص است. ورود ممکن نیست.');
      setLoading(false);
      return;
    }

    try {
      if (!username || !password) {
        toast.error('لطفاً نام کاربری و رمز عبور را وارد کنید');
        return;
      }

      // First check if user exists in profiles
      console.debug('Login: fetching profile for username', username);
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('email')
        .eq('username', username)
        .maybeSingle();

      console.debug('Login: profile response', { profile, profileError });

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        toast.error('خطا در بررسی اطلاعات کاربری: ' + (profileError.message ?? profileError.toString()));
        setLoading(false);  // Important: reset loading on error
        return;
      }

      if (!profile?.email) {
        toast.error('کاربری با این نام کاربری یافت نشد');
        setLoading(false);  // Important: reset loading on error
        return;
      }

      // Then try to sign in
      console.debug('Login: attempting signInWithPassword for', profile.email);
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password,
      });

      console.debug('Login: sign-in response', { data, signInError });

      if (signInError) {
        console.error('Sign in error:', signInError);
        const msg = signInError?.message ?? JSON.stringify(signInError);
        if (typeof msg === 'string' && msg.includes('Invalid login credentials')) {
          toast.error('رمز عبور اشتباه است');
        } else {
          toast.error('خطا در ورود: ' + msg);
        }
        setLoading(false);  // Important: reset loading on error
        return;
      }

      if (!data?.user) {
        console.error('Sign in succeeded but no user object returned', data);
        toast.error('خطا در دریافت اطلاعات کاربری پس از ورود');
        setLoading(false);  // Important: reset loading on error
        return;
      }

      // Add debug log for successful login
      console.debug('Login successful, user:', { 
        id: data.user.id,
        email: data.user.email,
        hasSession: !!data.session
      });

      toast.success('ورود موفقیت‌آمیز بود');
      navigate('/dashboard');
    } catch (error) {
      console.error('Unexpected error during login:', error);
      toast.error('خطای غیرمنتظره در ورود');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            username: username,
            // The role will be set to 'parent' by default in the trigger if not specified
          },
        },
      });

      if (signUpError) {
        toast.error(`خطا در ثبت‌نام: ${signUpError.message}`);
      } else {
        toast.success('ثبت‌نام موفقیت‌آمیز بود. لطفاً ایمیل خود را برای فعال‌سازی حساب کاربری چک کنید.');
      }
    } catch (error: any) {
      toast.error(`خطا در ثبت‌نام: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

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

