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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ExcelImportDialog } from './ExcelImportDialog';

interface Subject { id: string; name: string; }
interface Teacher { id: string; profiles: { full_name: string } | null; }
interface ClassSubject {
  id: string;
  subjects: { name: string } | null;
  teachers: { profiles: { full_name: string } | null } | null;
}
interface Class {
  id: string;
  name: string;
  grade: string;
  class_subjects: ClassSubject[];
}

const ClassesManagement = () => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog states
  const [classDialogOpen, setClassDialogOpen] = useState(false);
  const [subjectDialogOpen, setSubjectDialogOpen] = useState(false);
  
  // Form states
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [className, setClassName] = useState('');
  const [grade, setGrade] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [classesRes, teachersRes, subjectsRes] = await Promise.all([
      supabase.from('classes').select(`
        id, name, grade,
        class_subjects (
          id,
          subjects (name),
          teachers (
            profiles (full_name)
          )
        )
      `),
      supabase.from('teachers').select('id, profiles(full_name)'),
      supabase.from('subjects').select('id, name')
    ]);

    if (classesRes.error) toast.error('خطا در بارگذاری کلاس‌ها: ' + classesRes.error.message);
    else setClasses(classesRes.data as Class[] || []);

    if (teachersRes.error) toast.error('خطا در بارگذاری معلم‌ها');
    else setTeachers(teachersRes.data as Teacher[] || []);

    if (subjectsRes.error) toast.error('خطا در بارگذاری درس‌ها');
    else setSubjects(subjectsRes.data || []);
    
    setLoading(false);
  };

  const handleClassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingClass) {
      const { error } = await supabase.from('classes').update({ name: className, grade }).eq('id', editingClass.id);
      if (error) toast.error('خطا در ویرایش کلاس');
      else toast.success('کلاس با موفقیت ویرایش شد');
    } else {
      const { error } = await supabase.from('classes').insert({ name: className, grade });
      if (error) toast.error('خطا در افزودن کلاس');
      else toast.success('کلاس با موفقیت اضافه شد');
    }
    setClassDialogOpen(false);
    resetClassForm();
    fetchData();
  };

  const handleClassSubjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClass || !selectedSubject || !selectedTeacher) {
        toast.error("لطفا تمام فیلدها را انتخاب کنید.");
        return;
    }
    const { error } = await supabase.from('class_subjects').insert({
      class_id: editingClass.id,
      subject_id: selectedSubject,
      teacher_id: selectedTeacher
    });
    if (error) {
        toast.error("خطا در تخصیص درس: " + error.message);
    }
    else {
        toast.success("درس با موفقیت به کلاس تخصیص داده شد.");
        setSubjectDialogOpen(false);
        resetSubjectForm();
        fetchData();
    }
  };
  
  const handleClassDelete = async (classId: string) => {
    const { error } = await supabase.from('classes').delete().eq('id', classId);
    if(error) toast.error("خطا در حذف کلاس: " + error.message);
    else toast.success("کلاس و تمام درس‌های مرتبط با آن حذف شد.");
    fetchData();
  }
  
  const handleClassSubjectDelete = async (classSubjectId: string) => {
     const { error } = await supabase.from('class_subjects').delete().eq('id', classSubjectId);
     if(error) toast.error("خطا در حذف درس از کلاس: " + error.message);
     else toast.success("درس از کلاس حذف شد.");
     fetchData();
  }

  const openClassDialog = (cls: Class | null) => {
    if (cls) {
      setEditingClass(cls);
      setClassName(cls.name);
      setGrade(cls.grade);
    } else {
      resetClassForm();
    }
    setClassDialogOpen(true);
  };
  
  const openSubjectDialog = (cls: Class) => {
      setEditingClass(cls);
      resetSubjectForm();
      setSubjectDialogOpen(true);
  }

  const resetClassForm = () => { setEditingClass(null); setClassName(''); setGrade(''); };
  const resetSubjectForm = () => { setSelectedSubject(''); setSelectedTeacher(''); };
  
  const handleClassImport = async (data: any[]) => {
    const { error } = await supabase.from('classes').insert(data.map(row => ({
      name: row.class_name,
      grade: row.grade,
    })));
    if (error) return { success: false, errors: [error.message] };
    fetchData();
    return { success: true };
  };

  const filteredClasses = useMemo(() => {
    if (!searchTerm) return classes;
    return classes.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [classes, searchTerm]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div><CardTitle>مدیریت کلاس‌ها</CardTitle><CardDescription>افزودن کلاس و تخصیص دروس</CardDescription></div>
          <div className="flex gap-2">
             <ExcelImportDialog
                triggerButton={<Button variant="outline" className="gap-2"><Upload className="w-4 h-4" />وارد کردن کلاس‌ها</Button>}
                onImport={handleClassImport}
                requiredFields={{ class_name: "نام کلاس", grade: "پایه تحصیلی" }}
                templateFileName="classes-template.xlsx"
            />
            <Dialog open={classDialogOpen} onOpenChange={(isOpen) => { setClassDialogOpen(isOpen); if (!isOpen) resetClassForm(); }}>
              <DialogTrigger asChild><Button className="gap-2" onClick={() => openClassDialog(null)}><Plus className="w-4 h-4" />افزودن کلاس</Button></DialogTrigger>
              <DialogContent dir="rtl">
                <DialogHeader><DialogTitle>{editingClass ? 'ویرایش کلاس' : 'افزودن کلاس جدید'}</DialogTitle></DialogHeader>
                <form onSubmit={handleClassSubmit} className="space-y-4 pt-4">
                  <div className="space-y-2"><Label>نام کلاس</Label><Input value={className} onChange={(e) => setClassName(e.target.value)} required /></div>
                  <div className="space-y-2"><Label>پایه تحصیلی</Label><Input value={grade} onChange={(e) => setGrade(e.target.value)} required /></div>
                  <Button type="submit" className="w-full">{editingClass ? 'ویرایش' : 'افزودن'}</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
         <div className="relative mt-4"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="جستجوی نام کلاس..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" dir="rtl"/></div>
      </CardHeader>
      <CardContent>
        {loading ? <div className="text-center py-8">در حال بارگذاری...</div> : (
          <div className="space-y-4">
            {filteredClasses.map(cls => (
              <Card key={cls.id}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div><CardTitle className="text-xl">{cls.name} ({cls.grade})</CardTitle></div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openClassDialog(cls)}><Pencil className="w-4 h-4 ml-1" /> ویرایش نام</Button>
                    <Dialog open={subjectDialogOpen && editingClass?.id === cls.id} onOpenChange={(isOpen) => { setSubjectDialogOpen(isOpen); if(!isOpen) resetSubjectForm(); }}>
                       <DialogTrigger asChild><Button size="sm" onClick={() => openSubjectDialog(cls)}><Plus className="w-4 h-4 ml-1" /> افزودن درس</Button></DialogTrigger>
                       <DialogContent dir="rtl">
                           <DialogHeader><DialogTitle>تخصیص درس به کلاس {cls.name}</DialogTitle></DialogHeader>
                           <form onSubmit={handleClassSubjectSubmit} className="space-y-4 pt-4">
                               <div className="space-y-2"><Label>درس</Label><Select value={selectedSubject} onValueChange={setSelectedSubject}><SelectTrigger><SelectValue placeholder="انتخاب درس" /></SelectTrigger><SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
                               <div className="space-y-2"><Label>معلم</Label><Select value={selectedTeacher} onValueChange={setSelectedTeacher}><SelectTrigger><SelectValue placeholder="انتخاب معلم" /></SelectTrigger><SelectContent>{teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.profiles?.full_name || 'نامشخص'}</SelectItem>)}</SelectContent></Select></div>
                               <Button type="submit" className="w-full">تخصیص</Button>
                           </form>
                       </DialogContent>
                    </Dialog>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button variant="destructive" size="sm"><Trash2 className="w-4 h-4" /></Button></AlertDialogTrigger>
                      <AlertDialogContent dir="rtl">
                          <AlertDialogHeader><AlertDialogTitle>آیا از حذف کلاس مطمئن هستید؟</AlertDialogTitle><AlertDialogDescription>این عمل تمام درس‌های تخصیص داده شده به این کلاس را نیز حذف می‌کند.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel>انصراف</AlertDialogCancel><AlertDialogAction onClick={() => handleClassDelete(cls.id)}>حذف</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table dir="rtl">
                    <TableHeader><TableRow><TableHead className="w-1/2 text-right">درس</TableHead><TableHead className="w-1/2 text-right">معلم</TableHead><TableHead className="text-right">عملیات</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {cls.class_subjects.length === 0 ? <TableRow><TableCell colSpan={3} className="text-center h-24">هیچ درسی به این کلاس تخصیص داده نشده.</TableCell></TableRow> :
                       cls.class_subjects.map(cs => (
                        <TableRow key={cs.id}>
                          <TableCell>{cs.subjects?.name || 'نامشخص'}</TableCell>
                          <TableCell>{cs.teachers?.profiles?.full_name || 'نامشخص'}</TableCell>
                          <TableCell><Button variant="ghost" size="icon" onClick={() => handleClassSubjectDelete(cs.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
             {filteredClasses.length === 0 && <div className="text-center py-8 text-muted-foreground">هیچ کلاسی یافت نشد.</div>}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ClassesManagement;

