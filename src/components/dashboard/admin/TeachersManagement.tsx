import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2 } from 'lucide-react';

interface Teacher {
  id: string;
  profile_id: string;
  subject: string;
  profiles: {
    full_name: string;
    username: string;
  };
}

const TeachersManagement = () => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [subject, setSubject] = useState('');

  useEffect(() => {
    fetchTeachers();
  }, []);

  const fetchTeachers = async () => {
    const { data, error } = await supabase
      .from('teachers')
      .select('*, profiles(full_name, username)');
    
    if (error) {
      toast.error('خطا در بارگذاری معلم‌ها');
    } else {
      setTeachers(data || []);
    }
    setLoading(false);
  };

  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: `${username}@school.local`,
        password,
      });

      if (authError) throw authError;

      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user!.id,
          role: 'teacher',
          full_name: fullName,
          username,
        });

      if (profileError) throw profileError;

      // Create teacher record
      const { error: teacherError } = await supabase
        .from('teachers')
        .insert({
          profile_id: authData.user!.id,
          subject,
        });

      if (teacherError) throw teacherError;

      toast.success('معلم با موفقیت اضافه شد');
      setOpen(false);
      resetForm();
      fetchTeachers();
    } catch (error: any) {
      toast.error('خطا در افزودن معلم: ' + error.message);
    }
  };

  const handleDeleteTeacher = async (teacherId: string, profileId: string) => {
    if (!confirm('آیا از حذف این معلم مطمئن هستید؟')) return;

    const { error } = await supabase
      .from('teachers')
      .delete()
      .eq('id', teacherId);

    if (error) {
      toast.error('خطا در حذف معلم');
    } else {
      toast.success('معلم حذف شد');
      fetchTeachers();
    }
  };

  const resetForm = () => {
    setFullName('');
    setUsername('');
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
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                افزودن معلم
              </Button>
            </DialogTrigger>
            <DialogContent dir="rtl">
              <DialogHeader>
                <DialogTitle>افزودن معلم جدید</DialogTitle>
                <DialogDescription>
                  اطلاعات معلم جدید را وارد کنید
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddTeacher} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">نام و نام خانوادگی</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    dir="rtl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">نام کاربری</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    dir="rtl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">رمز عبور</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    dir="rtl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject">درس تخصصی</Label>
                  <Input
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    dir="rtl"
                  />
                </div>
                <Button type="submit" className="w-full">
                  افزودن
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
                <TableHead className="text-right">نام</TableHead>
                <TableHead className="text-right">نام کاربری</TableHead>
                <TableHead className="text-right">درس تخصصی</TableHead>
                <TableHead className="text-right">عملیات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teachers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    هیچ معلمی یافت نشد
                  </TableCell>
                </TableRow>
              ) : (
                teachers.map((teacher) => (
                  <TableRow key={teacher.id}>
                    <TableCell>{teacher.profiles.full_name}</TableCell>
                    <TableCell>{teacher.profiles.username}</TableCell>
                    <TableCell>{teacher.subject || '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
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
