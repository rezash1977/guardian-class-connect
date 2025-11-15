import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // بررسی هَش برای بازیابی رمز عبور
    const hash = window.location.hash;
    if (hash && hash.includes('access_token') && hash.includes('type=recovery')) {
      navigate(`/auth/reset-password${hash}`, { replace: true });
      return;
    }

    // هدایت کاربر فقط وقتی loading تمام شد
    if (!loading) {
      if (user) {
        navigate('/dashboard', { replace: true }); // هدایت کاربر لاگین شده
      } else {
        navigate('/login', { replace: true }); // هدایت کاربر لاگین نشده
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
