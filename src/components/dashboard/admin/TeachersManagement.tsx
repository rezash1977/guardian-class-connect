import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil, Search, UserPlus, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ExcelImportDialog } from './ExcelImportDialog';
import { useSortableData } from '@/hooks/use-sortable-data';

interface Teacher {
  id: string;
  profile_id: string;
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
  const [searchTerm, setSearchTerm] = useState('');

  const { items: sortedItems, requestSort, sortConfig } = useSortableData(teachers, { key: 'profiles.full_name', direction: 'ascending' });

  useEffect(() => {
    fetchTeachers();
  }, []);

  const fetchTeachers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('teachers')
      .select('*, profiles(full_name, username, email)');
    
    if (error) {
      toast.error('خطا در بارگذاری معلم‌ها');
    } else {
      setTeachers((data as Teacher[]) || []);
    }
    setLoading(false);
  };

  const handleAddOrEditTeacher = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingTeacher) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', editingTeacher.profile_id);

      if (profileError) {
        toast.error('خطا در ویرایش پروفایل: ' + profileError.message);
        return;
      }
      toast.success('معلم با موفقیت ویرایش شد');
    } else {
      // Use Edge Function for adding a new teacher
      const { data, error } = await supabase.functions.invoke('bulk-signup', {
        body: {
          users: [{
            email,
            password,
            user_metadata: { full_name: fullName, username },
            role: 'teacher'
          }]
        },
      });

      if (error || !data.success || (data.errors && data.errors.length > 0)) {
        toast.error(`خطا در افزودن معلم: ${error?.message || (data.errors && data.errors[0]) || 'خطای ناشناخته'}`);
        return;
      }
      toast.success('معلم با موفقیت اضافه شد.');
    }

    setOpen(false);
    resetForm();
    await fetchTeachers();
  };

  const handleTeacherImport = async (data: any[]) => {
      const users = data.map(row => ({
          email: row.email,
          password: String(row.password),
          user_metadata: { full_name: row.full_name, username: row.username },
          role: 'teacher'
      }));

      const { data: result, error } = await supabase.functions.invoke('bulk-signup', {
          body: { users }
      });

      if (error || !result.success) {
          return { success: false, errors: (result && result.errors) || [error?.message || "خطای سرور ناشناخته"] };
      }
      
      await fetchTeachers();
      return { success: true, errors: result.errors };
  };

  const handleDeleteTeacher = async (teacher: Teacher) => {
    // Note: Deleting the auth user requires an Edge Function.
    // For now, we only delete from our public tables which will cascade.
    const { error } = await supabase.from('profiles').delete().eq('id', teacher.profile_id);
    if (error) {
      toast.error('خطا در حذف معلم: ' + error.message);
    } else {
      toast.success(`معلم (${teacher.profiles.full_name}) و پروفایل مرتبط حذف شدند.`);
      fetchTeachers();
    }
  };

  const openEditDialog = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setFullName(teacher.profiles.full_name);
    setUsername(teacher.profiles.username);
    setEmail(teacher.profiles.email || '');
    setPassword('');
    setOpen(true);
  };

  const resetForm = () => {
    setEditingTeacher(null);
    setFullName('');
    setUsername('');
    setEmail('');
    setPassword('');
  };
  
  const filteredTeachers = useMemo(() => {
    if (!sortedItems) return [];
    return sortedItems.filter(teacher => 
      teacher.profiles.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teacher.profiles.username.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [sortedItems, searchTerm]);

  const SortableHeader = ({ sortKey, children }: { sortKey: string, children: React.ReactNode }) => {
    const icon = !sortConfig || sortConfig.key !== sortKey
        ? <ArrowUpDown className="mr-2 h-4 w-4 opacity-50" />
        : sortConfig.direction === 'ascending'
        ? <ArrowUp className="mr-2 h-4 w-4" />
        : <ArrowDown className="mr-2 h-4 w-4" />;
    return <Button variant="ghost" onClick={() => requestSort(sortKey)}>{children}{icon}</Button>
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>مدیریت معلم‌ها</CardTitle>
            <CardDescription>افزودن، ویرایش، حذف و جستجوی معلم‌ها</CardDescription>
          </div>
          <div className="flex gap-2">
            <ExcelImportDialog
              triggerButton={<Button variant="outline" className="gap-2"><UserPlus className="w-4 h-4" />وارد کردن از فایل</Button>}
              requiredFields={{
                full_name: "نام کامل",
                username: "نام کاربری",
                email: "ایمیل",
                password: "رمز عبور"
              }}
              onImport={handleTeacherImport}
              templateFileName="teachers-template.xlsx"
            />
            <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) resetForm(); }}>
              <DialogTrigger asChild><Button className="gap-2"><Plus className="w-4 h-4" />افزودن معلم</Button></DialogTrigger>
              <DialogContent dir="rtl">
                <DialogHeader><DialogTitle>{editingTeacher ? 'ویرایش معلم' : 'افزودن معلم جدید'}</DialogTitle></DialogHeader>
                <form onSubmit={handleAddOrEditTeacher} className="space-y-4 pt-4">
                  <div className="space-y-2"><Label htmlFor="fullName">نام و نام خانوادگی</Label><Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required /></div>
                  <div className="space-y-2"><Label htmlFor="email">ایمیل</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required={!editingTeacher} disabled={!!editingTeacher} dir="ltr" className="text-left"/></div>
                  <div className="space-y-2"><Label htmlFor="username">نام کاربری</Label><Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} required={!editingTeacher} disabled={!!editingTeacher} /></div>
                  {!editingTeacher && (<div className="space-y-2"><Label htmlFor="password">رمز عبور</Label><Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} /></div>)}
                  <Button type="submit" className="w-full">{editingTeacher ? 'ویرایش' : 'افزودن'}</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <div className="relative mt-4"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="جستجوی معلم..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" dir="rtl"/></div>
      </CardHeader>
      <CardContent>
        {loading ? <div className="text-center py-8">در حال بارگذاری...</div> : (
          <Table dir="rtl">
            <TableHeader>
              <TableRow>
                <TableHead className="text-right"><SortableHeader sortKey="profiles.full_name">نام</SortableHeader></TableHead>
                <TableHead className="text-right"><SortableHeader sortKey="profiles.username">نام کاربری</SortableHeader></TableHead>
                <TableHead className="text-right"><SortableHeader sortKey="profiles.email">ایمیل</SortableHeader></TableHead>
                <TableHead className="text-right">عملیات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTeachers.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">هیچ معلمی یافت نشد</TableCell></TableRow> : (
                filteredTeachers.map((teacher) => (
                  <TableRow key={teacher.id}>
                    <TableCell>{teacher.profiles.full_name}</TableCell>
                    <TableCell>{teacher.profiles.username}</TableCell>
                    <TableCell dir="ltr" className="text-right">{teacher.profiles.email}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEditDialog(teacher)}><Pencil className="w-4 h-4" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="destructive" size="sm"><Trash2 className="w-4 h-4" /></Button></AlertDialogTrigger>
                          <AlertDialogContent dir="rtl">
                            <AlertDialogHeader><AlertDialogTitle>آیا از حذف مطمئن هستید؟</AlertDialogTitle><AlertDialogDescription>این عمل کاربر مرتبط را نیز از سیستم حذف می‌کند و قابل بازگشت نیست.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>انصراف</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteTeacher(teacher)}>حذف</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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

