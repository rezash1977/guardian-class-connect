import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return; // صبر تا session کامل بارگذاری شود

    const hash = window.location.hash;
    if (hash && hash.includes('access_token') && hash.includes('type=recovery')) {
      navigate(`/auth/reset-password${hash}`, { replace: true });
      return;
    }

    if (user) {
      navigate('/dashboard', { replace: true }); // کاربر لاگین شده → داشبورد
    } else {
      navigate('/login', { replace: true }); // کاربر لاگین نشده → لاگین
    }
  }, [user, loading, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-xl font-semibold">در حال بارگذاری...</div>
    </div>
  );
};

export default Index;
