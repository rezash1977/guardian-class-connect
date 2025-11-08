import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // فقط زمانی که وضعیت کاربر مشخص شد، تصمیم به هدایت بگیر
  useEffect(() => {
    if (loading) return; // تا وقتی احراز هویت در حال انجام است کاری نکن
  
    // اگر کاربر وارد شده است به داشبورد برود
    if (user) {
      navigate('/dashboard');
    }
    // در غیر این صورت در صفحه لندینگ بماند
  }, [user, loading, navigate]);

  // صفحه لندینگ (نه صفحه لاگین)
  return (
    <div className="flex flex-col min-h-screen items-center justify-center bg-gray-50 text-center p-8">
      <h1 className="text-3xl font-bold mb-4">خوش آمدید به Guardian Class Connect</h1>
      <p className="text-gray-600 mb-6">
        این پلتفرم برای مدیریت کلاس‌ها، حضور و غیاب و ارتباط مؤثر بین معلمان و دانش‌آموزان طراحی شده است.
      </p>
      <div className="flex gap-4">
        <button
          onClick={() => navigate('/login')}
          className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition"
        >
          ورود
        </button>
        <button
          onClick={() => navigate('/signup')}
          className="px-6 py-2 border border-blue-600 text-blue-600 rounded-xl hover:bg-blue-50 transition"
        >
          ثبت‌نام
        </button>
      </div>
    </div>
  );
};

export default Index;
