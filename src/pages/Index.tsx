// Index.tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // بررسی هَش در URL برای بازیابی رمز عبور
    const hash = window.location.hash;
    if (hash && hash.includes('access_token') && hash.includes('type=recovery')) {
      navigate(`/auth/reset-password${hash}`);
      return;
    }

    // هدایت کاربر بر اساس وضعیت لاگین
    if (!loading) {
      if (user) {
        navigate('/dashboard'); // کاربر لاگین است → به داشبورد
      } else {
        navigate('/login'); // کاربر لاگین نیست → به صفحه ورود
      }
    }
  }, [user, loading, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-xl font-semibold">در حال بارگذاری...</div>
    </div>
  );
};

export default Index;
