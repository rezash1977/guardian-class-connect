import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil } from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

interface Teacher {
  id: string;
  profile_id: string;
  subject: string;
  profiles: {
    full_name: string;
    username: string;
    email: string | null;
  };
}

const TeachersManagement = () => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [subject, setSubject] = useState('');
  useEffect(() => {
    fetchTeachers();
  }, []);

  const fetchTeachers = async () => {
    const { data, error } = await supabase
      .from('teachers')
      .select('*, profiles(full_name, username, email)');
    
    if (error) {
      toast.error('خطا در بارگذاری معلم‌ها');
    } else {
      setTeachers(data as Teacher[] || []);
    }
    setLoading(false);
  };

  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingTeacher) {
      try {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            full_name: fullName,
          })
          .eq('id', editingTeacher.profile_id);

        if (profileError) {
          toast.error('خطا در ویرایش پروفایل: ' + profileError.message);
          return;
        }

        const { error: teacherError } = await supabase
          .from('teachers')
          .update({
            subject,
          })
          .eq('id', editingTeacher.id);

        if (teacherError) {
          toast.error('خطا در ویرایش معلم: ' + teacherError.message);
          return;
        }

        toast.success('معلم با موفقیت ویرایش شد');
        setOpen(false);
        resetForm();
        fetchTeachers();
      } catch (error: any) {
        toast.error('خطا در ویرایش معلم: ' + error.message);
      }
    } else {
      try {
        const { data, error } = await supabase.functions.invoke('create-teacher', {
          body: {
            email,
            password,
            full_name: fullName,
            username,
            subject,
          },
        });

        if (error) {
          throw error;
        }

        if (data.error) {
          toast.error(data.error);
        } else {
          toast.success(data.message || 'معلم با موفقیت اضافه شد');
          setOpen(false);
          resetForm();
          fetchTeachers();
        }
      } catch (error: any) {
        console.error('Add teacher error:', error);
        const errorMessage = error.details || error.message || 'یک خطای پیش‌بینی نشده رخ داد';
        toast.error(errorMessage);
      }
    }
  };

  const handleEditTeacher = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setFullName(teacher.profiles.full_name);
    setUsername(teacher.profiles.username);
    setEmail(teacher.profiles.email || '');
    setSubject(teacher.subject || '');
    setPassword('');
    setOpen(true);
  };

  const handleDeleteTeacher = async (teacherId: string, profileId: string) => {
    if (!confirm('آیا از حذف این معلم مطمئن هستید؟ این عمل کاربر را نیز حذف می‌کند.')) return;

    // We need an edge function to delete auth user. This is a client-side placeholder.
    // For now, we only delete from our tables.
    const { error } = await supabase
      .from('teachers')
      .delete()
      .eq('id', teacherId);

    if (error) {
      toast.error('خطا در حذف معلم');
    } else {
       const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', profileId);

      if (profileError) {
         toast.error('معلم حذف شد اما پروفایل حذف نشد.');
      } else {
        toast.success('معلم و پروفایل حذف شدند.');
      }
      fetchTeachers();
    }
  };

  const resetForm = () => {
    setEditingTeacher(null);
    setFullName('');
    setUsername('');
    setEmail('');
    setPassword('');
    setSubject('');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>مدیریت معلم‌ها</CardTitle>
            <CardDescription>افزودن، ویرایش و حذف معلم‌ها</CardDescription>
          </div>
          <div className="flex gap-2">
            <Dialog open={open} onOpenChange={(isOpen) => {
              setOpen(isOpen);
              if (!isOpen) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  افزودن معلم
                </Button>
              </DialogTrigger>
            <DialogContent dir="rtl">
              <DialogHeader>
                <DialogTitle>{editingTeacher ? 'ویرایش معلم' : 'افزودن معلم جدید'}</DialogTitle>
                <DialogDescription>
                  {editingTeacher ? 'اطلاعات معلم را ویرایش کنید' : 'اطلاعات معلم جدید را وارد کنید'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddTeacher} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">نام و نام خانوادگی</Label>
                  <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required dir="rtl"/>
                </div>
                 <div className="space-y-2">
                  <Label htmlFor="email">ایمیل</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required={!editingTeacher} disabled={!!editingTeacher} dir="ltr" className="text-left"/>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">نام کاربری</Label>
                  <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} required={!editingTeacher} disabled={!!editingTeacher} dir="rtl"/>
                </div>
                {!editingTeacher && (
                  <div className="space-y-2">
                    <Label htmlFor="password">رمز عبور</Label>
                    <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} dir="rtl" />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="subject">درس تخصصی</Label>
                  <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} dir="rtl" />
                </div>
                <Button type="submit" className="w-full">
                  {editingTeacher ? 'ویرایش' : 'افزودن'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">در حال بارگذاری...</div>
        ) : (
          <Table dir="rtl">
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">نام</TableHead>
                <TableHead className="text-right">نام کاربری</TableHead>
                <TableHead className="text-right">ایمیل</TableHead>
                <TableHead className="text-right">درس تخصصی</TableHead>
                <TableHead className="text-right">عملیات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teachers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    هیچ معلمی یافت نشد
                  </TableCell>
                </TableRow>
              ) : (
                teachers.map((teacher) => (
                  <TableRow key={teacher.id}>
                    <TableCell>{teacher.profiles.full_name}</TableCell>
                    <TableCell>{teacher.profiles.username}</TableCell>
                    <TableCell dir="ltr" className="text-right">{teacher.profiles.email}</TableCell>
                    <TableCell>{teacher.subject || '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditTeacher(teacher)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteTeacher(teacher.id, teacher.profile_id)}
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

export default TeachersManagement;

