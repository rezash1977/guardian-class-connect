import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // فقط زمانی که loading تمام شده باشد و در حال ناوبری نباشیم
    if (loading) return;

    const timer = setTimeout(() => {
      if (user) {
        navigate('/dashboard', { replace: true });
      } else {
        navigate('/login', { replace: true });
      }
    }, 200); // تأخیر کوچک برای اطمینان از اینکه React Router در موبایل آماده است

    return () => clearTimeout(timer);
  }, [user, loading, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-lg text-center animate-pulse">در حال بارگذاری...</div>
    </div>
  );
};

export default Index;
