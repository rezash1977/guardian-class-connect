import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if we have a hash in the URL (for password reset)
    const hash = window.location.hash;
    if (hash && hash.includes('access_token') && hash.includes('type=recovery')) {
      navigate(`/auth/reset-password${hash}`);
      return;
    }

    if (!loading) {
      }
  }, [user, loading, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-xl">در حال بارگذاری...</div>
    </div>
  );
};

export default Index;
