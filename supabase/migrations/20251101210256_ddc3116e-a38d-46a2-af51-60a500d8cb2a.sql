-- ایجاد جدول subjects (دروس)
CREATE TABLE IF NOT EXISTS public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ایجاد جدول class_subjects (رابطه کلاس و دروس)
CREATE TABLE IF NOT EXISTS public.class_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(class_id, subject_id)
);

-- اضافه کردن فیلدهای جدید به جدول attendance
ALTER TABLE public.attendance 
  ADD COLUMN IF NOT EXISTS lesson_period INTEGER,
  ADD COLUMN IF NOT EXISTS is_justified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS medical_certificate_url TEXT,
  ADD COLUMN IF NOT EXISTS class_subject_id UUID REFERENCES public.class_subjects(id) ON DELETE SET NULL;

-- فعال کردن RLS برای جداول جدید
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_subjects ENABLE ROW LEVEL SECURITY;

-- پالیسی‌های RLS برای subjects
CREATE POLICY "همه کاربران می‌توانند دروس را مشاهده کنند"
ON public.subjects FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "ادمین‌ها می‌توانند دروس را مدیریت کنند"
ON public.subjects FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- پالیسی‌های RLS برای class_subjects
CREATE POLICY "همه کاربران می‌توانند ارتباط کلاس-درس را مشاهده کنند"
ON public.class_subjects FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "ادمین‌ها می‌توانند ارتباط کلاس-درس را مدیریت کنند"
ON public.class_subjects FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- ایجاد index برای بهبود performance
CREATE INDEX IF NOT EXISTS idx_class_subjects_class_id ON public.class_subjects(class_id);
CREATE INDEX IF NOT EXISTS idx_class_subjects_subject_id ON public.class_subjects(subject_id);
CREATE INDEX IF NOT EXISTS idx_class_subjects_teacher_id ON public.class_subjects(teacher_id);
CREATE INDEX IF NOT EXISTS idx_attendance_class_subject_id ON public.attendance(class_subject_id);