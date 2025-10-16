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
import { Plus, Trash2, Pencil, Search, Upload } from 'lucide-react';
import { ExcelImportDialog } from './ExcelImportDialog';

interface Class { id: string; name: string; grade: string; }
interface Parent { id: string; full_name: string | null; }
interface Student {
  id: string;
  full_name: string;
  class_id: string | null;
  parent_id: string | null;
  classes: { name: string; } | null;
  profiles: { full_name: string; } | null;
}

const StudentsManagement = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [parents, setParents] = useState<Parent[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog states
  const [open, setOpen] = useState(false);
  const [parentOpen, setParentOpen] = useState(false);

  // Form states
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [studentName, setStudentName] = useState('');
  const [classId, setClassId] = useState('');
  const [parentId, setParentId] = useState('');
  
  // States for unified parent+student form
  const [isNewParent, setIsNewParent] = useState(false);
  const [parentFullName, setParentFullName] = useState('');
  const [parentUsername, setParentUsername] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [parentPassword, setParentPassword] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [filterClassId, setFilterClassId] = useState('');


  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [studentsRes, classesRes, parentsRes] = await Promise.all([
      supabase.from('students').select('*, classes(name), profiles(full_name)'),
      supabase.from('classes').select('id, name, grade'),
      supabase.from('user_roles').select('profiles!inner(id, full_name)').eq('role', 'parent')
    ]);

    if (studentsRes.error) toast.error('خطا در بارگذاری دانش‌آموزان'); else setStudents(studentsRes.data || []);
    if (classesRes.error) toast.error('خطا در بارگذاری کلاس‌ها'); else setClasses(classesRes.data || []);
    if (parentsRes.error) toast.error('خطا در بارگذاری اولیا'); else setParents(parentsRes.data.map((p: any) => p.profiles) as Parent[]);

    setLoading(false);
  };
  
  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let finalParentId = parentId;

    if (isNewParent) {
      if (!parentFullName || !parentUsername || !parentEmail || !parentPassword) {
        toast.error("لطفا تمام فیلدهای ولی جدید را پر کنید.");
        return;
      }
      const { data, error } = await supabase.functions.invoke('bulk-signup', {
        body: { users: [{ full_name: parentFullName, username: parentUsername, email: parentEmail, password: parentPassword }], role: 'parent' },
      });

      if (error || (data.errors && data.errors.length > 0)) {
        toast.error(`خطا در افزودن ولی: ${error?.message || data.errors[0]}`);
        return;
      }
      if (data.createdUsers && data.createdUsers.length > 0) {
        finalParentId = data.createdUsers[0].id;
        toast.success("ولی جدید با موفقیت ایجاد شد.");
        fetchData(); // Refresh parents list
      } else {
        toast.error("خطا: شناسه ولی جدید دریافت نشد.");
        return;
      }
    }

    const studentData = {
      full_name: studentName,
      class_id: classId || null,
      parent_id: finalParentId || null,
    };

    if (editingStudent) {
      const { error } = await supabase.from('students').update(studentData).eq('id', editingStudent.id);
      if (error) toast.error('خطا در ویرایش دانش‌آموز: ' + error.message);
      else toast.success('دانش‌آموز با موفقیت ویرایش شد');
    } else {
      const { error } = await supabase.from('students').insert(studentData);
      if (error) toast.error('خطا در افزودن دانش‌آموز: ' + error.message);
      else toast.success('دانش‌آموز با موفقیت اضافه شد');
    }
    setOpen(false);
    resetForm();
    fetchData();
  };

  const handleEditStudent = (student: Student) => {
    setEditingStudent(student);
    setStudentName(student.full_name);
    setClassId(student.class_id || '');
    setParentId(student.parent_id || '');
    setIsNewParent(false);
    setOpen(true);
  };

  const handleDeleteStudent = async (studentId: string) => {
    const { error } = await supabase.from('students').delete().eq('id', studentId);
    if (error) toast.error('خطا در حذف دانش‌آموز');
    else {
      toast.success('دانش‌آموز حذف شد');
      fetchData();
    }
  };

  const resetForm = () => {
    setEditingStudent(null);
    setStudentName('');
    setClassId('');
    setParentId('');
    setIsNewParent(false);
    setParentFullName('');
    setParentUsername('');
    setParentEmail('');
    setParentPassword('');
  };

  const handleStudentImport = async (data: any[]) => {
    const { error } = await supabase.from('students').insert(data.map(row => ({
        full_name: row.student_name,
        // These need lookup based on name, better handled server-side or with more complex client logic
        // For now, leaving them out of bulk import to avoid complexity.
        // class_id: findClassIdByName(row.class_name), 
        // parent_id: findParentIdByName(row.parent_name),
    })));
    if (error) return { success: false, errors: [error.message] };
    fetchData();
    return { success: true };
  };

  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      const nameMatch = student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        student.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
      const classMatch = !filterClassId || student.class_id === filterClassId;
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
                triggerButton={<Button variant="outline" className="gap-2"><Upload className="w-4 h-4" />وارد کردن از فایل</Button>}
                onImport={handleStudentImport}
                requiredFields={{ student_name: "نام دانش‌آموز" }}
                templateFileName="students-template.xlsx"
            />
            <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) resetForm(); }}>
              <DialogTrigger asChild><Button className="gap-2"><Plus className="w-4 h-4" />افزودن دانش‌آموز</Button></DialogTrigger>
              <DialogContent dir="rtl" className="sm:max-w-[480px]">
                <DialogHeader><DialogTitle>{editingStudent ? 'ویرایش دانش‌آموز' : 'افزودن دانش‌آموز جدید'}</DialogTitle></DialogHeader>
                <form onSubmit={handleStudentSubmit} className="space-y-4 pt-4">
                  <div className="space-y-2"><Label>نام دانش‌آموز</Label><Input value={studentName} onChange={(e) => setStudentName(e.target.value)} required /></div>
                  <div className="space-y-2"><Label>کلاس</Label><Select value={classId} onValueChange={setClassId}><SelectTrigger><SelectValue placeholder="انتخاب کلاس" /></SelectTrigger><SelectContent>{classes.map((cls) => (<SelectItem key={cls.id} value={cls.id}>{cls.name} - {cls.grade}</SelectItem>))}</SelectContent></Select></div>
                  <div className="space-y-2"><Label>ولی</Label>
                    {!editingStudent && (<Button type="button" variant="link" onClick={() => setIsNewParent(!isNewParent)} className="p-0 h-auto mb-2">{isNewParent ? 'انتخاب از اولیای موجود' : 'ایجاد ولی جدید'}</Button>)}
                    {isNewParent ? (
                      <div className="border p-4 rounded-md space-y-3">
                        <div className="space-y-1"><Label>نام کامل ولی</Label><Input value={parentFullName} onChange={e => setParentFullName(e.target.value)} /></div>
                        <div className="space-y-1"><Label>ایمیل ولی</Label><Input type="email" value={parentEmail} onChange={e => setParentEmail(e.target.value)} dir="ltr" className="text-left"/></div>
                        <div className="space-y-1"><Label>نام کاربری ولی</Label><Input value={parentUsername} onChange={e => setParentUsername(e.target.value)} /></div>
                        <div className="space-y-1"><Label>رمز عبور ولی</Label><Input type="password" value={parentPassword} onChange={e => setParentPassword(e.target.value)} minLength={6} /></div>
                      </div>
                    ) : (
                      <Select value={parentId} onValueChange={setParentId}><SelectTrigger><SelectValue placeholder="انتخاب ولی" /></SelectTrigger><SelectContent>{parents.map((parent) => (<SelectItem key={parent.id} value={parent.id}>{parent.full_name}</SelectItem>))}</SelectContent></Select>
                    )}
                  </div>
                  <Button type="submit" className="w-full">{editingStudent ? 'ویرایش' : 'افزودن'}</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
            <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="جستجوی نام دانش‌آموز یا ولی..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" dir="rtl"/></div>
            <Select value={filterClassId} onValueChange={setFilterClassId}><SelectTrigger><SelectValue placeholder="فیلتر بر اساس کلاس" /></SelectTrigger><SelectContent>{[{id: '', name: 'همه کلاس‌ها'}, ...classes].map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <div className="text-center py-8">در حال بارگذاری...</div> : (
          <Table dir="rtl">
            <TableHeader><TableRow><TableHead className="text-right">نام</TableHead><TableHead className="text-right">کلاس</TableHead><TableHead className="text-right">ولی</TableHead><TableHead className="text-right">عملیات</TableHead></TableRow></TableHeader>
            <TableBody>
              {filteredStudents.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">هیچ دانش‌آموزی یافت نشد</TableCell></TableRow> :
               filteredStudents.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell>{student.full_name}</TableCell>
                    <TableCell>{student.classes?.name || 'تعیین نشده'}</TableCell>
                    <TableCell>{student.profiles?.full_name || 'تعیین نشده'}</TableCell>
                    <TableCell><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => handleEditStudent(student)}><Pencil className="w-4 h-4" /></Button><Button variant="destructive" size="sm" onClick={() => handleDeleteStudent(student.id)}><Trash2 className="w-4 h-4" /></Button></div></TableCell>
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

