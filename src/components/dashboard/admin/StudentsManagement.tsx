import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Trash2, Upload, Pencil } from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

interface Student {
  id: string;
  full_name: string;
  class_id: string | null;
  parent_id: string | null;
  classes: {
    name: string;
  } | null;
  profiles: {
    full_name: string;
  } | null;
}

const StudentsManagement = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [parents, setParents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [parentOpen, setParentOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [studentName, setStudentName] = useState('');
  const [classId, setClassId] = useState('');
  const [parentId, setParentId] = useState('');
  const [parentFullName, setParentFullName] = useState('');
  const [parentUsername, setParentUsername] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [parentPassword, setParentPassword] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchStudents();
    fetchClasses();
    fetchParents();
  }, []);

  const fetchStudents = async () => {
    const { data, error } = await supabase
      .from('students')
      .select('*, classes(name), profiles(full_name)');
    
    if (error) {
      toast.error('خطا در بارگذاری دانش‌آموزان');
    } else {
      setStudents(data || []);
    }
    setLoading(false);
  };

  const fetchClasses = async () => {
    const { data } = await supabase
      .from('classes')
      .select('id, name, grade');
    setClasses(data || []);
  };

  const fetchParents = async () => {
    const { data: roleRows } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'parent');

    const parentIds = (roleRows as any[] | null)?.map((r: any) => r.user_id) || [];
    if (parentIds.length === 0) {
      setParents([]);
      return;
    }

    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, username')
      .in('id', parentIds);

    setParents(data || []);
  };

  const handleAddParent = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { session: adminSession } } = await supabase.auth.getSession();

    try {
        const { data: existingProfile } = await supabase.from('profiles').select('id').or(`username.eq.${parentUsername},email.eq.${parentEmail}`).maybeSingle();
        if (existingProfile) {
            toast.error('این نام کاربری یا ایمیل قبلاً استفاده شده است');
            return;
        }

        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: parentEmail,
            password: parentPassword,
            options: {
                data: {
                    full_name: parentFullName,
                    username: parentUsername,
                    role: 'parent'
                }
            }
        });

        if (authError) throw authError;

        toast.success('ولی با موفقیت اضافه شد. لطفاً ایمیل تایید را چک کند.');
        setParentOpen(false);
        setParentFullName('');
        setParentUsername('');
        setParentEmail('');
        setParentPassword('');
        fetchParents();
    } catch (error: any) {
        toast.error('خطا در افزودن ولی: ' + error.message);
    } finally {
        if (adminSession) {
            await supabase.auth.setSession({ access_token: adminSession.access_token, refresh_token: adminSession.refresh_token });
        }
    }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingStudent) {
      const { error } = await supabase
        .from('students')
        .update({
          full_name: studentName,
          class_id: classId || null,
          parent_id: parentId || null,
        })
        .eq('id', editingStudent.id);

      if (error) {
        toast.error('خطا در ویرایش دانش‌آموز');
      } else {
        toast.success('دانش‌آموز با موفقیت ویرایش شد');
        setOpen(false);
        resetForm();
        fetchStudents();
      }
    } else {
      const { error } = await supabase
        .from('students')
        .insert({
          full_name: studentName,
          class_id: classId || null,
          parent_id: parentId || null,
        });

      if (error) {
        toast.error('خطا در افزودن دانش‌آموز');
      } else {
        toast.success('دانش‌آموز با موفقیت اضافه شد');
        setOpen(false);
        resetForm();
        fetchStudents();
      }
    }
  };

  const handleEditStudent = (student: Student) => {
    setEditingStudent(student);
    setStudentName(student.full_name);
    setClassId(student.class_id || '');
    setParentId(student.parent_id || '');
    setOpen(true);
  };

  const handleDeleteStudent = async (studentId: string) => {
    if (!confirm('آیا از حذف این دانش‌آموز مطمئن هستید؟')) return;

    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', studentId);

    if (error) {
      toast.error('خطا در حذف دانش‌آموز');
    } else {
      toast.success('دانش‌آموز حذف شد');
      fetchStudents();
    }
  };

  const resetForm = () => {
    setEditingStudent(null);
    setStudentName('');
    setClassId('');
    setParentId('');
  };
  
  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    toast.info('وارد کردن دسته جمعی در حال حاضر از این طریق پشتیبانی نمی‌شود.');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };


  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>مدیریت دانش‌آموزان</CardTitle>
            <CardDescription>افزودن، ویرایش و حذف دانش‌آموزان</CardDescription>
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
            <Dialog open={parentOpen} onOpenChange={setParentOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Plus className="w-4 h-4" />
                  افزودن ولی
                </Button>
              </DialogTrigger>
              <DialogContent dir="rtl">
                <DialogHeader>
                  <DialogTitle>افزودن ولی جدید</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddParent} className="space-y-4">
                  <div className="space-y-2">
                    <Label>نام و نام خانوادگی</Label>
                    <Input value={parentFullName} onChange={(e) => setParentFullName(e.target.value)} required dir="rtl" />
                  </div>
                  <div className="space-y-2">
                    <Label>ایمیل</Label>
                    <Input type="email" value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} required dir="ltr" className="text-left"/>
                  </div>
                  <div className="space-y-2">
                    <Label>نام کاربری</Label>
                    <Input value={parentUsername} onChange={(e) => setParentUsername(e.target.value)} required dir="rtl" />
                  </div>
                  <div className="space-y-2">
                    <Label>رمز عبور</Label>
                    <Input type="password" value={parentPassword} onChange={(e) => setParentPassword(e.target.value)} required minLength={6} dir="rtl" />
                  </div>
                  <Button type="submit" className="w-full">افزودن</Button>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog open={open} onOpenChange={(isOpen) => {
              setOpen(isOpen);
              if (!isOpen) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  افزودن دانش‌آموز
                </Button>
              </DialogTrigger>
              <DialogContent dir="rtl">
                <DialogHeader>
                  <DialogTitle>{editingStudent ? 'ویرایش دانش‌آموز' : 'افزودن دانش‌آموز جدید'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddStudent} className="space-y-4">
                  <div className="space-y-2">
                    <Label>نام دانش‌آموز</Label>
                    <Input value={studentName} onChange={(e) => setStudentName(e.target.value)} required dir="rtl" />
                  </div>
                  <div className="space-y-2">
                    <Label>کلاس</Label>
                    <Select value={classId} onValueChange={setClassId}>
                      <SelectTrigger dir="rtl">
                        <SelectValue placeholder="انتخاب کلاس" />
                      </SelectTrigger>
                      <SelectContent dir="rtl">
                        {classes.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>
                            {cls.name} - {cls.grade}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>ولی</Label>
                    <Select value={parentId} onValueChange={setParentId}>
                      <SelectTrigger dir="rtl">
                        <SelectValue placeholder="انتخاب ولی" />
                      </SelectTrigger>
                      <SelectContent dir="rtl">
                        {parents.map((parent) => (
                          <SelectItem key={parent.id} value={parent.id}>
                            {parent.full_name} ({parent.username})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full">{editingStudent ? 'ویرایش' : 'افزودن'}</Button>
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
                <TableHead className="text-right">کلاس</TableHead>
                <TableHead className="text-right">ولی</TableHead>
                <TableHead className="text-right">عملیات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    هیچ دانش‌آموزی یافت نشد
                  </TableCell>
                </TableRow>
              ) : (
                students.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell>{student.full_name}</TableCell>
                    <TableCell>{student.classes?.name || 'تعیین نشده'}</TableCell>
                    <TableCell>{student.profiles?.full_name || 'تعیین نشده'}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEditStudent(student)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDeleteStudent(student.id)}>
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

export default StudentsManagement;

