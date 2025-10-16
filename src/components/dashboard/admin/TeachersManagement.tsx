import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Trash2, Upload, Pencil, Search } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ExcelImportDialog } from './ExcelImportDialog';

interface Teacher {
  id: string;
  profile_id: string;
  subject: string | null;
  profiles: {
    full_name: string;
    username: string;
    email: string | null;
  } | null;
}

const TeachersManagement = () => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  
  // Form state
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [subject, setSubject] = useState('');

  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchTeachers();
  }, []);

  const fetchTeachers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('teachers')
      .select('*, profiles(full_name, username, email)');
    
    if (error) {
      toast.error('خطا در بارگذاری معلم‌ها: ' + error.message);
    } else {
      setTeachers(data as Teacher[] || []);
    }
    setLoading(false);
  };

  const handleAddOrEditTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingTeacher) {
      // Logic for editing an existing teacher
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', editingTeacher.profile_id);

      if (profileError) {
        toast.error('خطا در ویرایش پروفایل: ' + profileError.message);
        return;
      }
      
      const { error: teacherError } = await supabase
          .from('teachers')
          .update({ subject: subject || null })
          .eq('id', editingTeacher.id);

      if (teacherError) {
        toast.error('خطا در ویرایش اطلاعات معلم: ' + teacherError.message);
      } else {
        toast.success('معلم با موفقیت ویرایش شد');
        setOpen(false);
        resetForm();
        fetchTeachers();
      }

    } else {
      // Logic for adding a new teacher via Edge Function
      const { data, error } = await supabase.functions.invoke('bulk-signup', {
        body: {
          users: [{
            email,
            password,
            full_name: fullName,
            username,
            role: 'teacher',
            subject: subject || null,
          }]
        }
      });

      if (error) {
        toast.error("خطا در ارتباط با سرور: " + error.message);
      } else if (data.results && data.results[0] && !data.results[0].success) {
        toast.error("خطا در افزودن معلم: " + data.results[0].error);
      } else {
        toast.success('معلم با موفقیت اضافه شد. ایمیل تایید ارسال شد.');
        setOpen(false);
        resetForm();
        fetchTeachers();
      }
    }
  };

  const handleEditClick = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setFullName(teacher.profiles?.full_name || '');
    setUsername(teacher.profiles?.username || '');
    setEmail(teacher.profiles?.email || '');
    setSubject(teacher.subject || '');
    setPassword(''); // Clear password field for editing
    setOpen(true);
  };

  const handleDeleteTeacher = async (teacher: Teacher) => {
     // This is a sensitive operation. For full user deletion, an Edge Function is recommended.
     // For now, we will delete from our public tables.
    const { error: teacherError } = await supabase.from('teachers').delete().eq('id', teacher.id);
    if(teacherError) {
        toast.error("خطا در حذف معلم: " + teacherError.message);
        return;
    }
    const { error: profileError } = await supabase.from('profiles').delete().eq('id', teacher.profile_id);
    if (profileError) {
        toast.warning('رکورد معلم حذف شد اما پروفایل حذف نشد.');
    } else {
        toast.success('معلم و پروفایل مرتبط حذف شدند.');
    }
    fetchTeachers();
  };

  const resetForm = () => {
    setEditingTeacher(null);
    setFullName('');
    setUsername('');
    setEmail('');
    setPassword('');
    setSubject('');
  };

  const handleTeacherImport = async (importedData: any[]) => {
    const users = importedData.map(row => ({
      email: row.email,
      password: row.password,
      full_name: row.full_name,
      username: row.username,
      role: 'teacher',
      subject: row.subject || null,
    }));

    const { data, error } = await supabase.functions.invoke('bulk-signup', { body: { users } });

    if (error) {
      return { success: false, errors: [error.message] };
    }

    const failedImports = data.results.filter((r: any) => !r.success);
    if (failedImports.length > 0) {
      return { success: false, errors: failedImports.map((f: any) => `${f.email}: ${f.error}`) };
    }

    fetchTeachers();
    return { success: true };
  };

  const filteredTeachers = useMemo(() => {
    if (!searchTerm) return teachers;
    return teachers.filter(t => t.profiles?.full_name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [teachers, searchTerm]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div><CardTitle>مدیریت معلم‌ها</CardTitle><CardDescription>افزودن، ویرایش و حذف معلم‌ها</CardDescription></div>
          <div className="flex gap-2">
            <ExcelImportDialog
                triggerButton={<Button variant="outline" className="gap-2"><Upload className="w-4 h-4" />وارد کردن از فایل</Button>}
                onImport={handleTeacherImport}
                requiredFields={{ email: "ایمیل", password: "رمز عبور", full_name: "نام کامل", username: "نام کاربری", subject: "درس تخصصی (اختیاری)" }}
                templateFileName="teachers-template.xlsx"
            />
            <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) resetForm(); }}>
              <DialogTrigger asChild><Button className="gap-2"><Plus className="w-4 h-4" />افزودن معلم</Button></DialogTrigger>
              <DialogContent dir="rtl">
                <DialogHeader><DialogTitle>{editingTeacher ? 'ویرایش معلم' : 'افزودن معلم جدید'}</DialogTitle></DialogHeader>
                <form onSubmit={handleAddOrEditTeacher} className="space-y-4 pt-4">
                  <div className="space-y-2"><Label>نام و نام خانوادگی</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} required /></div>
                  <div className="space-y-2"><Label>ایمیل</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required={!editingTeacher} disabled={!!editingTeacher} dir="ltr" className="text-left"/></div>
                  <div className="space-y-2"><Label>نام کاربری</Label><Input value={username} onChange={(e) => setUsername(e.target.value)} required={!editingTeacher} disabled={!!editingTeacher} /></div>
                  {!editingTeacher && <div className="space-y-2"><Label>رمز عبور</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} /></div>}
                  <div className="space-y-2"><Label>درس تخصصی (اختیاری)</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
                  <Button type="submit" className="w-full">{editingTeacher ? 'ذخیره تغییرات' : 'افزودن'}</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <div className="relative mt-4"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="جستجوی نام معلم..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" dir="rtl"/></div>
      </CardHeader>
      <CardContent>
        {loading ? <div className="text-center py-8">در حال بارگذاری...</div> : (
          <Table dir="rtl">
            <TableHeader><TableRow><TableHead className="text-right">نام</TableHead><TableHead className="text-right">نام کاربری</TableHead><TableHead className="text-right">ایمیل</TableHead><TableHead className="text-right">درس تخصصی</TableHead><TableHead className="text-right">عملیات</TableHead></TableRow></TableHeader>
            <TableBody>
              {filteredTeachers.map((teacher) => (
                <TableRow key={teacher.id}>
                  <TableCell>{teacher.profiles?.full_name || 'N/A'}</TableCell>
                  <TableCell>{teacher.profiles?.username || 'N/A'}</TableCell>
                  <TableCell dir="ltr" className="text-right">{teacher.profiles?.email || 'N/A'}</TableCell>
                  <TableCell>{teacher.subject || '-'}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEditClick(teacher)}><Pencil className="w-4 h-4" /></Button>
                      <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="destructive" size="sm"><Trash2 className="w-4 h-4" /></Button></AlertDialogTrigger>
                          <AlertDialogContent dir="rtl">
                            <AlertDialogHeader><AlertDialogTitle>آیا از حذف این معلم مطمئن هستید؟</AlertDialogTitle><AlertDialogDescription>این عمل قابل بازگشت نیست و پروفایل کاربر را نیز حذف می‌کند.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>انصراف</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteTeacher(teacher)}>حذف</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default TeachersManagement;

