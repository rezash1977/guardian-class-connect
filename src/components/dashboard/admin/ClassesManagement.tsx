import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil } from 'lucide-react';

interface Class {
  id: string;
  name: string;
  grade: string;
  teacher_id: string | null;
  teachers: {
    profiles: {
      full_name: string;
    };
  } | null;
}

interface Teacher {
  id: string;
  profiles: {
    full_name: string;
  };
}

const ClassesManagement = () => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [className, setClassName] = useState('');
  const [grade, setGrade] = useState('');
  const [teacherId, setTeacherId] = useState('');

  useEffect(() => {
    fetchClasses();
    fetchTeachers();
  }, []);

  const fetchClasses = async () => {
    const { data, error } = await supabase
      .from('classes')
      .select('*, teachers(profiles(full_name))');
    
    if (error) {
      toast.error('خطا در بارگذاری کلاس‌ها');
    } else {
      setClasses(data || []);
    }
    setLoading(false);
  };

  const fetchTeachers = async () => {
    const { data } = await supabase
      .from('teachers')
      .select('id, profiles(full_name)');
    setTeachers(data || []);
  };

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingClass) {
      const { error } = await supabase
        .from('classes')
        .update({
          name: className,
          grade,
          teacher_id: teacherId || null,
        })
        .eq('id', editingClass.id);

      if (error) {
        toast.error('خطا در ویرایش کلاس');
      } else {
        toast.success('کلاس با موفقیت ویرایش شد');
        setOpen(false);
        resetForm();
        fetchClasses();
      }
    } else {
      const { error } = await supabase
        .from('classes')
        .insert({
          name: className,
          grade,
          teacher_id: teacherId || null,
        });

      if (error) {
        toast.error('خطا در افزودن کلاس');
      } else {
        toast.success('کلاس با موفقیت اضافه شد');
        setOpen(false);
        resetForm();
        fetchClasses();
      }
    }
  };

  const handleEditClass = (cls: Class) => {
    setEditingClass(cls);
    setClassName(cls.name);
    setGrade(cls.grade);
    setTeacherId(cls.teacher_id || '');
    setOpen(true);
  };

  const handleDeleteClass = async (classId: string) => {
    if (!confirm('آیا از حذف این کلاس مطمئن هستید؟')) return;

    const { error } = await supabase
      .from('classes')
      .delete()
      .eq('id', classId);

    if (error) {
      toast.error('خطا در حذف کلاس');
    } else {
      toast.success('کلاس حذف شد');
      fetchClasses();
    }
  };

  const resetForm = () => {
    setEditingClass(null);
    setClassName('');
    setGrade('');
    setTeacherId('');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>مدیریت کلاس‌ها</CardTitle>
            <CardDescription>افزودن، ویرایش و حذف کلاس‌ها</CardDescription>
          </div>
          <Dialog open={open} onOpenChange={(isOpen) => {
            setOpen(isOpen);
            if (!isOpen) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                افزودن کلاس
              </Button>
            </DialogTrigger>
            <DialogContent dir="rtl">
              <DialogHeader>
                <DialogTitle>{editingClass ? 'ویرایش کلاس' : 'افزودن کلاس جدید'}</DialogTitle>
                <DialogDescription>
                  {editingClass ? 'اطلاعات کلاس را ویرایش کنید' : 'اطلاعات کلاس جدید را وارد کنید'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddClass} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="className">نام کلاس</Label>
                  <Input
                    id="className"
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    required
                    dir="rtl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="grade">پایه تحصیلی</Label>
                  <Input
                    id="grade"
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    required
                    dir="rtl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="teacher">معلم کلاس</Label>
                  <Select value={teacherId} onValueChange={setTeacherId}>
                    <SelectTrigger dir="rtl">
                      <SelectValue placeholder="انتخاب معلم" />
                    </SelectTrigger>
                    <SelectContent dir="rtl">
                      {teachers.map((teacher) => (
                        <SelectItem key={teacher.id} value={teacher.id}>
                          {teacher.profiles.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full">
                  {editingClass ? 'ویرایش' : 'افزودن'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">در حال بارگذاری...</div>
        ) : (
          <Table dir="rtl">
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">نام کلاس</TableHead>
                <TableHead className="text-right">پایه</TableHead>
                <TableHead className="text-right">معلم</TableHead>
                <TableHead className="text-right">عملیات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    هیچ کلاسی یافت نشد
                  </TableCell>
                </TableRow>
              ) : (
                classes.map((cls) => (
                  <TableRow key={cls.id}>
                    <TableCell>{cls.name}</TableCell>
                    <TableCell>{cls.grade}</TableCell>
                    <TableCell>{cls.teachers?.profiles.full_name || 'تعیین نشده'}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditClass(cls)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteClass(cls.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default ClassesManagement;
