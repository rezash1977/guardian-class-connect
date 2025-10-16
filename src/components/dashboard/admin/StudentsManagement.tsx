import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil, Search, UserPlus, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ExcelImportDialog } from './ExcelImportDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSortableData } from '@/hooks/use-sortable-data';

// Define interfaces for better type safety
interface Profile {
  id: string;
  full_name: string;
  username: string;
}

interface ClassInfo {
  id: string;
  name: string;
}

interface Student {
  id: string;
  full_name: string;
  class_id: string | null;
  parent_id: string | null;
  classes: { name: string } | null;
  profiles: { full_name: string } | null;
}

const StudentsManagement = () => {
  // State variables
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [parents, setParents] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog and Form states
  const [open, setOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [studentName, setStudentName] = useState('');
  const [classId, setClassId] = useState<string | undefined>('');
  const [parentSelectionTab, setParentSelectionTab] = useState('existing');
  const [parentId, setParentId] = useState<string | undefined>('');
  const [parentFullName, setParentFullName] = useState('');
  const [parentUsername, setParentUsername] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [parentPassword, setParentPassword] = useState('');

  // Filtering and Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClassId, setFilterClassId] = useState('all');

  const { items: sortedItems, requestSort, sortConfig } = useSortableData(students, { key: 'full_name', direction: 'ascending' });

  // Fetch initial data on component mount
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchStudents(), fetchClasses(), fetchParents()]);
    setLoading(false);
  };

  const fetchStudents = async () => {
    const { data, error } = await supabase
      .from('students')
      .select('*, classes(name), profiles(full_name)');
    if (error) toast.error('خطا در بارگذاری دانش‌آموزان');
    else setStudents((data as Student[]) || []);
  };

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('id, name');
    setClasses(data || []);
  };

  const fetchParents = async () => {
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'parent');

    if (roleError || !roleData || roleData.length === 0) {
      if(roleError) toast.error("خطا در واکشی نقش‌های والدین: " + roleError.message);
      setParents([]);
      return;
    }

    const parentIds = roleData.map(r => r.user_id);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, username')
      .in('id', parentIds);

    if (error) toast.error("خطا در واکشی پروفایل والدین: " + error.message);
    else setParents((data as Profile[]) || []);
  };

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let finalParentId = parentId;

    if (!editingStudent && parentSelectionTab === 'new') {
        const { data, error } = await supabase.functions.invoke('bulk-signup', {
            body: {
                users: [{
                    email: parentEmail,
                    password: parentPassword,
                    user_metadata: { full_name: parentFullName, username: parentUsername },
                    role: 'parent'
                }]
            },
        });

        if (error || !data.success || (data.errors && data.errors.length > 0)) {
            toast.error(`خطا در ایجاد ولی: ${error?.message || (data.errors && data.errors[0]) || 'خطای ناشناخته'}`);
            return;
        }
        finalParentId = data.results[0].id;
        toast.success(`ولی جدید (${parentFullName}) با موفقیت ایجاد شد.`);
        await fetchParents(); // Refresh parent list
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
    await fetchStudents();
  };

  const handleDeleteStudent = async (studentId: string) => {
    const { error } = await supabase.from('students').delete().eq('id', studentId);
    if (error) toast.error('خطا در حذف دانش‌آموز');
    else {
      toast.success('دانش‌آموز حذف شد');
      fetchStudents();
    }
  };

  const handleStudentImport = async (data: any[]) => {
      const parentsToCreate = data.filter(row => row.parent_email && row.parent_password);
      const parentUsers = parentsToCreate.map(row => ({
          email: row.parent_email,
          password: row.parent_password,
          user_metadata: { full_name: row.parent_full_name, username: row.parent_username },
          role: 'parent',
          temp_student_name: row.full_name // For mapping later
      }));

      let newParentResults: { email: string; id: string; temp_student_name: string }[] = [];
      if (parentUsers.length > 0) {
          const { data: result, error } = await supabase.functions.invoke('bulk-signup', {
              body: { users: parentUsers }
          });
          if (error || !result.success) {
              return { success: false, errors: result?.errors || [error.message] };
          }
          newParentResults = result.results;
      }

      const studentsToInsert = data.map(row => {
          let pId = row.parent_id;
          if (!pId) {
              const newParent = newParentResults.find(p => p.temp_student_name === row.full_name);
              if (newParent) pId = newParent.id;
          }
          return {
              full_name: row.full_name,
              class_id: row.class_id,
              parent_id: pId || null
          };
      });

      const { error: studentInsertError } = await supabase.from('students').insert(studentsToInsert);
      if (studentInsertError) {
          return { success: false, errors: [studentInsertError.message] };
      }

      await fetchData();
      return { success: true };
  };

  const openEditDialog = (student: Student) => {
    setEditingStudent(student);
    setStudentName(student.full_name);
    setClassId(student.class_id || undefined);
    setParentId(student.parent_id || undefined);
    setOpen(true);
  };

  const resetForm = () => {
    setEditingStudent(null);
    setStudentName('');
    setClassId(undefined);
    setParentId(undefined);
    setParentSelectionTab('existing');
    setParentFullName('');
    setParentUsername('');
    setParentEmail('');
    setParentPassword('');
  };

  const filteredStudents = useMemo(() => {
    if(!sortedItems) return [];
    return sortedItems.filter(student => {
      const searchTermLower = searchTerm.toLowerCase();
      const nameMatch = (student.full_name?.toLowerCase() || '').includes(searchTermLower) || (student.profiles?.full_name?.toLowerCase() || '').includes(searchTermLower);
      const classMatch = filterClassId === 'all' || student.class_id === filterClassId;
      return nameMatch && classMatch;
    });
  }, [sortedItems, searchTerm, filterClassId]);
  
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
            <CardTitle>مدیریت دانش‌آموزان</CardTitle>
            <CardDescription>افزودن، ویرایش، حذف، جستجو و فیلتر دانش‌آموزان</CardDescription>
          </div>
          <div className="flex gap-2">
            <ExcelImportDialog
                triggerButton={<Button variant="outline" className="gap-2"><UserPlus className="w-4 h-4" />وارد کردن از فایل</Button>}
                requiredFields={{ 
                  full_name: "نام کامل دانش آموز", 
                  class_id: "شناسه کلاس (اختیاری)", 
                  parent_id: "شناسه ولی موجود (اختیاری)",
                  parent_full_name: "نام کامل ولی جدید (اختیاری)",
                  parent_username: "نام کاربری ولی جدید (اختیاری)",
                  parent_email: "ایمیل ولی جدید (اختیاری)",
                  parent_password: "رمز عبور ولی جدید (اختیاری)",
                }}
                onImport={handleStudentImport}
                templateFileName="students-template.xlsx"
            />
            <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) resetForm(); }}>
              <DialogTrigger asChild><Button className="gap-2"><Plus className="w-4 h-4" />افزودن دانش‌آموز</Button></DialogTrigger>
              <DialogContent dir="rtl" className="sm:max-w-[480px]">
                <DialogHeader><DialogTitle>{editingStudent ? 'ویرایش دانش‌آموز' : 'افزودن دانش‌آموز جدید'}</DialogTitle></DialogHeader>
                <form onSubmit={handleStudentSubmit} className="space-y-4">
                  <div className="space-y-2"><Label>نام دانش‌آموز</Label><Input value={studentName} onChange={(e) => setStudentName(e.target.value)} required /></div>
                  <div className="space-y-2"><Label>کلاس</Label><Select value={classId} onValueChange={setClassId}><SelectTrigger><SelectValue placeholder="انتخاب کلاس" /></SelectTrigger><SelectContent>{classes.map((cls) => (<SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>))}</SelectContent></Select></div>
                  
                  {!editingStudent && (
                    <Tabs value={parentSelectionTab} onValueChange={setParentSelectionTab}>
                        <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="existing">ولی موجود</TabsTrigger><TabsTrigger value="new">ولی جدید</TabsTrigger></TabsList>
                        <TabsContent value="existing" className="pt-4">
                           <div className="space-y-2"><Label>انتخاب ولی</Label><Select value={parentId} onValueChange={setParentId}><SelectTrigger><SelectValue placeholder="انتخاب ولی" /></SelectTrigger><SelectContent>{parents.map((parent) => (<SelectItem key={parent.id} value={parent.id}>{parent.full_name} ({parent.username})</SelectItem>))}</SelectContent></Select></div>
                        </TabsContent>
                        <TabsContent value="new" className="pt-4 space-y-4">
                           <div className="space-y-2"><Label>نام کامل ولی</Label><Input value={parentFullName} onChange={(e) => setParentFullName(e.target.value)} required={parentSelectionTab === 'new'} /></div>
                           <div className="space-y-2"><Label>ایمیل ولی</Label><Input type="email" value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} required={parentSelectionTab === 'new'} dir="ltr" className="text-left"/></div>
                           <div className="space-y-2"><Label>نام کاربری ولی</Label><Input value={parentUsername} onChange={(e) => setParentUsername(e.target.value)} required={parentSelectionTab === 'new'} /></div>
                           <div className="space-y-2"><Label>رمز عبور ولی</Label><Input type="password" value={parentPassword} onChange={(e) => setParentPassword(e.target.value)} required={parentSelectionTab === 'new'} /></div>
                        </TabsContent>
                    </Tabs>
                  )}
                   {editingStudent && (
                     <div className="space-y-2"><Label>ولی</Label><Select value={parentId} onValueChange={setParentId}><SelectTrigger><SelectValue placeholder="انتخاب ولی" /></SelectTrigger><SelectContent>{parents.map((parent) => (<SelectItem key={parent.id} value={parent.id}>{parent.full_name} ({parent.username})</SelectItem>))}</SelectContent></Select></div>
                   )}
                  <Button type="submit" className="w-full">{editingStudent ? 'ویرایش' : 'افزودن'}</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-4">
            <div className="relative flex-grow min-w-[200px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="جستجوی نام دانش آموز یا ولی..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" dir="rtl"/></div>
            <Select value={filterClassId} onValueChange={setFilterClassId}><SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="فیلتر کلاس" /></SelectTrigger><SelectContent><SelectItem value="all">همه کلاس‌ها</SelectItem>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <div className="text-center py-8">در حال بارگذاری...</div> : (
          <Table dir="rtl">
            <TableHeader><TableRow>
                <TableHead className="text-right"><SortableHeader sortKey="full_name">نام دانش آموز</SortableHeader></TableHead>
                <TableHead className="text-right"><SortableHeader sortKey="classes.name">کلاس</SortableHeader></TableHead>
                <TableHead className="text-right"><SortableHeader sortKey="profiles.full_name">ولی</SortableHeader></TableHead>
                <TableHead className="text-right">عملیات</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filteredStudents.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">هیچ دانش‌آموزی یافت نشد</TableCell></TableRow> : (
                filteredStudents.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell>{student.full_name}</TableCell>
                    <TableCell>{student.classes?.name || 'تعیین نشده'}</TableCell>
                    <TableCell>{student.profiles?.full_name || 'تعیین نشده'}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEditDialog(student)}><Pencil className="w-4 h-4" /></Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild><Button variant="destructive" size="sm"><Trash2 className="w-4 h-4" /></Button></AlertDialogTrigger>
                            <AlertDialogContent dir="rtl">
                                <AlertDialogHeader><AlertDialogTitle>آیا مطمئن هستید؟</AlertDialogTitle><AlertDialogDescription>این عمل قابل بازگشت نیست و این دانش‌آموز به طور کامل حذف خواهد شد.</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter><AlertDialogCancel>انصراف</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteStudent(student.id)}>حذف</AlertDialogAction></AlertDialogFooter>
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

export default StudentsManagement;

