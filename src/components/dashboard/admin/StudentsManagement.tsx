import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Trash2, Upload, Pencil, Search } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ExcelImportDialog } from './ExcelImportDialog';

interface Student {
  id: string;
  full_name: string;
  class_id: string | null;
  parent_id: string | null;
  classes: { name: string; } | null;
  profiles: { full_name: string; } | null;
}
interface Parent { id: string; full_name: string; username: string; }
interface Class { id: string; name: string; grade: string; }


const StudentsManagement = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [parents, setParents] = useState<Parent[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [studentDialogOpen, setStudentDialogOpen] = useState(false);
  const [parentDialogOpen, setParentDialogOpen] = useState(false);
  
  // Form states
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [studentName, setStudentName] = useState('');
  const [classId, setClassId] = useState('');
  const [parentId, setParentId] = useState('');
  
  const [parentFullName, setParentFullName] = useState('');
  const [parentUsername, setParentUsername] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [parentPassword, setParentPassword] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [filterClassId, setFilterClassId] = useState('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [studentsRes, classesRes, parentsRes] = await Promise.all([
      supabase.from('students').select('*, classes(name), profiles(full_name)'),
      supabase.from('classes').select('id, name, grade'),
      supabase.from('user_roles').select('profiles!inner(id, full_name, username)').eq('role', 'parent')
    ]);

    if(studentsRes.error) toast.error("خطا در بارگذاری دانش‌آموزان: " + studentsRes.error.message);
    else setStudents(studentsRes.data as Student[] || []);

    if(classesRes.error) toast.error("خطا در بارگذاری کلاس‌ها");
    else setClasses(classesRes.data as Class[] || []);

    if(parentsRes.error) toast.error("خطا در بارگذاری اولیا");
    else setParents(parentsRes.data.map((p: any) => p.profiles) as Parent[] || []);
    
    setLoading(false);
  };

  const handleParentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data, error } = await supabase.functions.invoke('bulk-signup', {
      body: {
        users: [{
          email: parentEmail,
          password: parentPassword,
          full_name: parentFullName,
          username: parentUsername,
          role: 'parent'
        }]
      }
    });

    if (error) {
      toast.error("خطا در ارتباط با سرور: " + error.message);
    } else if (data.results && data.results[0] && !data.results[0].success) {
      toast.error("خطا در افزودن ولی: " + data.results[0].error);
    } else {
      toast.success('ولی با موفقیت اضافه شد. ایمیل تایید ارسال شد.');
      setParentDialogOpen(false);
      resetParentForm();
      fetchData(); // Refetch parents
    }
  };

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const studentData = {
      full_name: studentName,
      class_id: classId || null,
      parent_id: parentId || null
    };

    if (editingStudent) {
      const { error } = await supabase.from('students').update(studentData).eq('id', editingStudent.id);
      if(error) toast.error("خطا در ویرایش: " + error.message);
      else toast.success("دانش‌آموز با موفقیت ویرایش شد.");
    } else {
      const { error } = await supabase.from('students').insert(studentData);
      if(error) toast.error("خطا در افزودن: " + error.message);
      else toast.success("دانش‌آموز با موفقیت اضافه شد.");
    }
    setStudentDialogOpen(false);
    resetStudentForm();
    fetchData();
  };
  
  const handleStudentImport = async (importedData: any[]) => {
      // We assume parent_username and class_name are provided and exist.
      // A more robust solution would be to create parents/classes if they don't exist.
      const { data: parentsData } = await supabase.from('profiles').select('id, username');
      const { data: classesData } = await supabase.from('classes').select('id, name');

      const parentMap = new Map(parentsData?.map(p => [p.username, p.id]));
      const classMap = new Map(classesData?.map(c => [c.name, c.id]));

      const studentsToInsert = importedData.map(row => ({
          full_name: row.full_name,
          parent_id: parentMap.get(row.parent_username),
          class_id: classMap.get(row.class_name),
      }));

      const { error } = await supabase.from('students').insert(studentsToInsert);
      if (error) return { success: false, errors: [error.message] };
      
      fetchData();
      return { success: true };
  };

  const handleStudentDelete = async (studentId: string) => {
    const { error } = await supabase.from('students').delete().eq('id', studentId);
    if (error) toast.error("خطا در حذف: " + error.message);
    else toast.success("دانش‌آموز حذف شد.");
    fetchData();
  };

  const openStudentDialog = (student: Student | null) => {
    if (student) {
      setEditingStudent(student);
      setStudentName(student.full_name);
      setClassId(student.class_id || '');
      setParentId(student.parent_id || '');
    } else {
      resetStudentForm();
    }
    setStudentDialogOpen(true);
  };
  
  const resetParentForm = () => { setParentFullName(''); setParentUsername(''); setParentEmail(''); setParentPassword(''); };
  const resetStudentForm = () => { setEditingStudent(null); setStudentName(''); setClassId(''); setParentId(''); };

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const searchTermLower = searchTerm.toLowerCase();
      const nameMatch = s.full_name.toLowerCase().includes(searchTermLower) || s.profiles?.full_name.toLowerCase().includes(searchTermLower);
      const classMatch = filterClassId === 'all' || s.class_id === filterClassId;
      return nameMatch && classMatch;
    });
  }, [students, searchTerm, filterClassId]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div><CardTitle>مدیریت دانش‌آموزان</CardTitle><CardDescription>افزودن، ویرایش و حذف دانش‌آموزان</CardDescription></div>
          <div className="flex gap-2">
             <ExcelImportDialog
                triggerButton={<Button variant="outline" className="gap-2"><Upload className="w-4 h-4" />وارد کردن دانش‌آموزان</Button>}
                onImport={handleStudentImport}
                requiredFields={{ full_name: "نام کامل دانش‌آموز", parent_username: "نام کاربری ولی", class_name: "نام کلاس" }}
                templateFileName="students-template.xlsx"
            />
            <Dialog open={parentDialogOpen} onOpenChange={setParentDialogOpen}>
              <DialogTrigger asChild><Button variant="outline" className="gap-2"><Plus className="w-4 h-4" />افزودن ولی</Button></DialogTrigger>
              <DialogContent dir="rtl">
                <DialogHeader><DialogTitle>افزودن ولی جدید</DialogTitle></DialogHeader>
                <form onSubmit={handleParentSubmit} className="space-y-4 pt-4">
                  <div className="space-y-2"><Label>نام و نام خانوادگی</Label><Input value={parentFullName} onChange={e => setParentFullName(e.target.value)} required /></div>
                  <div className="space-y-2"><Label>ایمیل</Label><Input type="email" value={parentEmail} onChange={e => setParentEmail(e.target.value)} required dir="ltr" className="text-left"/></div>
                  <div className="space-y-2"><Label>نام کاربری</Label><Input value={parentUsername} onChange={e => setParentUsername(e.target.value)} required /></div>
                  <div className="space-y-2"><Label>رمز عبور</Label><Input type="password" value={parentPassword} onChange={e => setParentPassword(e.target.value)} required minLength={6} /></div>
                  <Button type="submit" className="w-full">افزودن ولی</Button>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog open={studentDialogOpen} onOpenChange={(isOpen) => { setStudentDialogOpen(isOpen); if (!isOpen) resetStudentForm(); }}>
              <DialogTrigger asChild><Button className="gap-2" onClick={() => openStudentDialog(null)}><Plus className="w-4 h-4" />افزودن دانش‌آموز</Button></DialogTrigger>
              <DialogContent dir="rtl">
                <DialogHeader><DialogTitle>{editingStudent ? 'ویرایش دانش‌آموز' : 'افزودن دانش‌آموز جدید'}</DialogTitle></DialogHeader>
                <form onSubmit={handleStudentSubmit} className="space-y-4 pt-4">
                  <div className="space-y-2"><Label>نام دانش‌آموز</Label><Input value={studentName} onChange={(e) => setStudentName(e.target.value)} required /></div>
                  <div className="space-y-2"><Label>کلاس</Label><Select value={classId} onValueChange={setClassId}><SelectTrigger><SelectValue placeholder="انتخاب کلاس" /></SelectTrigger><SelectContent>{classes.map((cls) => <SelectItem key={cls.id} value={cls.id}>{cls.name} - {cls.grade}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><Label>ولی</Label><Select value={parentId} onValueChange={setParentId}><SelectTrigger><SelectValue placeholder="انتخاب ولی" /></SelectTrigger><SelectContent>{parents.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name} ({p.username})</SelectItem>)}</SelectContent></Select></div>
                  <Button type="submit" className="w-full">{editingStudent ? 'ذخیره تغییرات' : 'افزودن'}</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
            <div className="relative flex-grow"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="جستجوی دانش‌آموز یا ولی..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" dir="rtl"/></div>
            <Select value={filterClassId} onValueChange={setFilterClassId}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="فیلتر کلاس" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه کلاس‌ها</SelectItem>
                {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <div className="text-center py-8">در حال بارگذاری...</div> : (
          <Table dir="rtl">
            <TableHeader><TableRow><TableHead className="text-right">نام دانش‌آموز</TableHead><TableHead className="text-right">کلاس</TableHead><TableHead className="text-right">ولی</TableHead><TableHead className="text-right">عملیات</TableHead></TableRow></TableHeader>
            <TableBody>
              {filteredStudents.map((student) => (
                <TableRow key={student.id}>
                  <TableCell>{student.full_name}</TableCell>
                  <TableCell>{student.classes?.name || 'تعیین نشده'}</TableCell>
                  <TableCell>{student.profiles?.full_name || 'تعیین نشده'}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => openStudentDialog(student)}><Pencil className="w-4 h-4" /></Button>
                      <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="destructive" size="sm"><Trash2 className="w-4 h-4" /></Button></AlertDialogTrigger>
                          <AlertDialogContent dir="rtl">
                            <AlertDialogHeader><AlertDialogTitle>آیا از حذف این دانش‌آموز مطمئن هستید؟</AlertDialogTitle><AlertDialogDescription>این عمل قابل بازگشت نیست.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>انصراف</AlertDialogCancel><AlertDialogAction onClick={() => handleStudentDelete(student.id)}>حذف</AlertDialogAction></AlertDialogFooter>
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

export default StudentsManagement;

