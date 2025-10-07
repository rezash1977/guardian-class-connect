import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Trash2, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      // Check if username already exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .maybeSingle();

      if (existingProfile) {
        toast.error('این نام کاربری قبلاً استفاده شده است');
        return;
      }

      const email = `${username}@school.local`;
      
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        if (authError.message.includes('User already registered')) {
          toast.error('این نام کاربری قبلاً ثبت شده است');
        } else {
          toast.error('خطا در ایجاد کاربر: ' + authError.message);
        }
        return;
      }
      
      if (!authData.user) {
        toast.error('کاربر ایجاد نشد');
        return;
      }

      // Wait a bit for auth user to be created
      await new Promise(resolve => setTimeout(resolve, 500));

      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          full_name: fullName,
          username,
          email,
        });

      if (profileError) {
        console.error('Profile error:', profileError);
        toast.error('خطا در ایجاد پروفایل: ' + profileError.message);
        return;
      }

      // Assign teacher role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({ user_id: authData.user.id, role: 'teacher' });

      if (roleError) {
        console.error('Role error:', roleError);
        toast.error('خطا در تعیین نقش: ' + roleError.message);
        return;
      }

      // Create teacher record
      const { error: teacherError } = await supabase
        .from('teachers')
        .insert({
          profile_id: authData.user.id,
          subject,
        });

      if (teacherError) {
        console.error('Teacher error:', teacherError);
        toast.error('خطا در ایجاد معلم: ' + teacherError.message);
        return;
      }

      toast.success('معلم با موفقیت اضافه شد');
      setOpen(false);
      resetForm();
      fetchTeachers();
    } catch (error: any) {
      console.error('Add teacher error:', error);
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

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    try {
      if (fileExtension === 'csv') {
        Papa.parse(file, {
          header: true,
          complete: async (results) => {
            await processImportData(results.data);
          },
          error: (error) => {
            toast.error('خطا در خواندن فایل CSV');
            console.error(error);
          }
        });
      } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          await processImportData(jsonData);
        };
        reader.readAsArrayBuffer(file);
      } else {
        toast.error('فرمت فایل باید CSV یا Excel باشد');
      }
    } catch (error) {
      toast.error('خطا در پردازش فایل');
      console.error(error);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const processImportData = async (data: any[]) => {
    let successCount = 0;
    let errorCount = 0;

    for (const row of data) {
      if (!row.full_name || !row.username || !row.password) {
        errorCount++;
        continue;
      }

      try {
        // Check if username already exists
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', row.username)
          .maybeSingle();

        if (existingProfile) {
          console.log('Username already exists:', row.username);
          errorCount++;
          continue;
        }

        const email = `${row.username}@school.local`;
        
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password: row.password,
        });

        if (authError) {
          if (!authError.message.includes('User already registered')) {
            console.error('Auth error for', row.username, ':', authError);
          }
          errorCount++;
          continue;
        }
        
        if (!authData.user) {
          errorCount++;
          continue;
        }

        // Wait a bit for auth user to be created
        await new Promise(resolve => setTimeout(resolve, 300));

        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: authData.user.id,
            full_name: row.full_name,
            username: row.username,
            email,
          });

        if (profileError) {
          console.error('Profile error for', row.username, ':', profileError);
          errorCount++;
          continue;
        }

        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({ user_id: authData.user.id, role: 'teacher' });

        if (roleError) {
          console.error('Role error for', row.username, ':', roleError);
          errorCount++;
          continue;
        }

        const { error: teacherError } = await supabase
          .from('teachers')
          .insert({
            profile_id: authData.user.id,
            subject: row.subject || null,
          });

        if (teacherError) {
          console.error('Teacher error for', row.username, ':', teacherError);
          errorCount++;
          continue;
        }

        successCount++;
      } catch (error) {
        console.error('Error importing teacher:', error);
        errorCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} معلم با موفقیت افزوده شد`);
      fetchTeachers();
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} معلم با خطا مواجه شد`);
    }
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
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileImport}
              className="hidden"
            />
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4" />
              وارد کردن از فایل
            </Button>
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
