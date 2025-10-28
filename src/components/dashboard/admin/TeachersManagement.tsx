import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil, Search, Upload, Loader2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { ExcelImportDialog } from './ExcelImportDialog';
import { useSortableData, SortConfig } from '@/hooks/use-sortable-data'; // Import hook and type

interface TeacherProfile {
  id: string; // profile id
  full_name: string;
  username: string;
  email: string | null;
}
interface TeacherRecord {
  id: string; // teacher id
  profile_id: string;
  profiles: TeacherProfile | null; // Join result can be null
}

const teacherImportFields = {
  required: {
    full_name: "نام کامل*",
    username: "نام کاربری*",
    email: "ایمیل*",
    password: "رمز عبور*",
  },
  optional: {},
};

// Helper component for Sortable Headers
const SortableHeader = ({ sortKey, children, sortConfig, requestSort }: { sortKey: string, children: React.ReactNode, sortConfig: SortConfig<TeacherRecord> | null, requestSort: (key: string) => void }) => {
    const isSorted = sortConfig?.key === sortKey;
    const direction = isSorted ? sortConfig?.direction : null;
    const icon = !isSorted
        ? <ArrowUpDown className="ml-2 h-4 w-4 opacity-30 group-hover:opacity-100" />
        : direction === 'ascending'
        ? <ArrowUp className="ml-2 h-4 w-4 text-primary" />
        : <ArrowDown className="ml-2 h-4 w-4 text-primary" />;
    return <Button variant="ghost" onClick={() => requestSort(sortKey)} className="group px-1 py-1 h-auto -ml-2">{children}{icon}</Button>
};


const TeachersManagement = () => {
  const [teachers, setTeachers] = useState<TeacherRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<TeacherRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Search state
  const [searchTerm, setSearchTerm] = useState('');

  // Use the sortable hook
  const { items: sortedTeachers, requestSort, sortConfig } = useSortableData<TeacherRecord>(teachers, { key: 'profiles.full_name', direction: 'ascending' });


  useEffect(() => {
    fetchTeachers();
  }, []);

  const fetchTeachers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('teachers')
      .select('id, profile_id, profiles(id, full_name, username, email)');

    if (error) {
      toast.error('خطا در بارگذاری معلم‌ها: ' + error.message);
    } else {
      setTeachers((data as TeacherRecord[]) || []);
    }
    setLoading(false);
  };

  const handleAddOrEditTeacher = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setIsSubmitting(true);

    let profileData: Partial<TeacherProfile> = {
      full_name: fullName,
    };

    try {
      if (editingTeacher && editingTeacher.profile_id) {
        // --- Edit existing teacher ---
        const { error: profileError } = await supabase
          .from('profiles')
          .update(profileData)
          .eq('id', editingTeacher.profile_id);

        if (profileError) throw profileError;

        toast.success('اطلاعات معلم با موفقیت ویرایش شد');

      } else {
        // --- Add new teacher using Edge Function ---
        const teacherData = {
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                    username: username,
                    role: 'teacher'
                }
            },
            teacher_info: {} // For potential future teacher-specific data
        };

        const { data: result, error: functionError } = await supabase.functions.invoke('bulk-signup', {
          // Pass data in the expected format for the Edge Function (even for single user)
          body: { users: [teacherData], userType: 'teacher' }, // Specify userType
        });

        if (functionError) throw functionError;

        if (result.errors && result.errors.length > 0) {
           toast.error(`خطا در افزودن معلم: ${result.errors[0]}`);
        } else {
           toast.success('معلم با موفقیت اضافه شد. لطفاً ایمیل تایید را چک کند.');
        }
      }

      setOpen(false);
      resetForm();
      fetchTeachers(); // Refresh list
    } catch (error: any) {
      console.error("Add/Edit teacher error:", error);
      toast.error(`خطا: ${error.message || 'عملیات ناموفق بود'}`);
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleDeleteTeacher = async (teacherId: string, profileId: string) => {
    // Note: Deleting the auth user requires an admin-privileged server-side operation (Edge Function)
    const { error: teacherDeleteError } = await supabase
      .from('teachers')
      .delete()
      .eq('id', teacherId);

    if (teacherDeleteError) {
      toast.error('خطا در حذف رکورد معلم: ' + teacherDeleteError.message);
      return;
    }

    const { error: profileDeleteError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', profileId);

    if (profileDeleteError) {
       toast.error('رکورد معلم حذف شد اما پروفایل حذف نشد: ' + profileDeleteError.message);
    } else {
      toast.success('معلم و پروفایل مرتبط حذف شدند.');
    }
    fetchTeachers(); // Refresh the list
  };

  const openEditModal = (teacher: TeacherRecord) => {
    setEditingTeacher(teacher);
    setFullName(teacher.profiles?.full_name || '');
    setUsername(teacher.profiles?.username || '');
    setEmail(teacher.profiles?.email || '');
    setPassword(''); // Clear password field for editing
    setOpen(true);
  };

  const openAddModal = () => {
    setEditingTeacher(null);
    resetForm();
    setOpen(true);
  };

  const resetForm = () => {
    setFullName('');
    setUsername('');
    setEmail('');
    setPassword('');
    setEditingTeacher(null);
  };

  // --- Excel Import Logic ---
  const handleTeacherImport = async (dataToImport: Record<string, any>[]) => {
    setIsLoading(true);
    const usersToSignup = dataToImport.map(item => ({
        email: item.email,
        password: String(item.password),
        options: {
            data: {
                full_name: item.full_name,
                username: item.username,
                role: 'teacher'
            }
        },
         teacher_info: {}
    }));

    const { data: result, error: functionError } = await supabase.functions.invoke('bulk-signup', {
      body: { users: usersToSignup, userType: 'teacher' }, // Specify userType
    });

    setIsLoading(false);

    if (functionError) {
        console.error("Edge function error:", functionError);
        return { success: false, errors: [`خطا در ارتباط با سرور: ${functionError.message}`] };
    }
    if (result.errors && result.errors.length > 0) {
        console.error("Bulk signup errors:", result.errors);
        return { success: false, errors: result.errors };
    }

    fetchTeachers(); // Refresh teacher list on success
    return { success: true, results: result.results || [] };
  };

   // --- Excel Template Generation ---
   const generateTeacherTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      Object.values(teacherImportFields.required) // Use display names for headers
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "معلمان");
    XLSX.writeFile(wb, "teachers_template.xlsx");
  };

  // --- Filtering Logic ---
   const filteredTeachers = useMemo(() => {
    if (!sortedTeachers) return [];
    const lowerSearchTerm = searchTerm.toLowerCase();
    return sortedTeachers.filter(teacher =>
      teacher.profiles?.full_name.toLowerCase().includes(lowerSearchTerm) ||
      teacher.profiles?.username.toLowerCase().includes(lowerSearchTerm) ||
      teacher.profiles?.email?.toLowerCase().includes(lowerSearchTerm)
    );
  }, [sortedTeachers, searchTerm]);


  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>مدیریت معلم‌ها</CardTitle>
            <CardDescription>افزودن، ویرایش، حذف و وارد کردن دسته‌جمعی معلم‌ها</CardDescription>
          </div>
          <div className="flex w-full sm:w-auto gap-2">
            <ExcelImportDialog
                requiredFields={teacherImportFields.required}
                optionalFields={teacherImportFields.optional}
                onImport={handleTeacherImport}
                templateGenerator={generateTeacherTemplate}
                entityName="معلم"
            />
            <Button onClick={openAddModal} className="gap-2">
              <Plus className="w-4 h-4" />
              افزودن معلم
            </Button>
          </div>
        </div>
         <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="جستجو بر اساس نام، نام کاربری یا ایمیل..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              dir="rtl"
            />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary"/></div>
        ) : (
          <Table dir="rtl">
            <TableHeader>
              <TableRow>
                <TableHead className="text-right"><SortableHeader sortKey="profiles.full_name" sortConfig={sortConfig} requestSort={requestSort}>نام</SortableHeader></TableHead>
                <TableHead className="text-right"><SortableHeader sortKey="profiles.username" sortConfig={sortConfig} requestSort={requestSort}>نام کاربری</SortableHeader></TableHead>
                <TableHead className="text-right"><SortableHeader sortKey="profiles.email" sortConfig={sortConfig} requestSort={requestSort}>ایمیل</SortableHeader></TableHead>
                <TableHead className="text-right">عملیات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTeachers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    هیچ معلمی یافت نشد
                  </TableCell>
                </TableRow>
              ) : (
                filteredTeachers.map((teacher) => (
                  <TableRow key={teacher.id}>
                    <TableCell>{teacher.profiles?.full_name || 'نامشخص'}</TableCell>
                    <TableCell>{teacher.profiles?.username || '-'}</TableCell>
                    <TableCell dir="ltr" className="text-right">{teacher.profiles?.email || '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditModal(teacher)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm">
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </AlertDialogTrigger>
                             <AlertDialogContent dir="rtl">
                                <AlertDialogHeader>
                                <AlertDialogTitle>آیا مطمئن هستید؟</AlertDialogTitle>
                                <AlertDialogDescription>
                                    این عمل معلم و پروفایل مرتبط را حذف می‌کند، اما کاربر احراز هویت شده باقی می‌ماند (نیاز به حذف دستی یا از طریق تابع سروری دارد). آیا از حذف مطمئن هستید؟
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>انصراف</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteTeacher(teacher.id, teacher.profile_id)}>
                                    حذف
                                </AlertDialogAction>
                                </AlertDialogFooter>
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

      {/* Add/Edit Dialog */}
       <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) resetForm(); setOpen(isOpen); }}>
        <DialogContent dir="rtl">
            <DialogHeader>
            <DialogTitle>{editingTeacher ? 'ویرایش معلم' : 'افزودن معلم جدید'}</DialogTitle>
            <DialogDescription>
                {editingTeacher ? 'اطلاعات معلم را ویرایش کنید.' : 'اطلاعات معلم جدید را وارد کنید.'}
            </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddOrEditTeacher} className="space-y-4 pt-4">
            <div className="space-y-2">
                <Label htmlFor="fullName">نام و نام خانوادگی*</Label>
                <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required dir="rtl"/>
            </div>
            <div className="space-y-2">
                <Label htmlFor="email">ایمیل*</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required={!editingTeacher} disabled={!!editingTeacher} dir="ltr" className="text-left"/>
                 {editingTeacher && <p className="text-xs text-muted-foreground">ایمیل قابل ویرایش نیست.</p>}
            </div>
            <div className="space-y-2">
                <Label htmlFor="username">نام کاربری*</Label>
                <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} required={!editingTeacher} disabled={!!editingTeacher} dir="rtl"/>
                 {editingTeacher && <p className="text-xs text-muted-foreground">نام کاربری قابل ویرایش نیست.</p>}
            </div>
            {!editingTeacher && (
                <div className="space-y-2">
                <Label htmlFor="password">رمز عبور*</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} dir="rtl" />
                </div>
            )}
            <DialogFooter className="pt-4">
                 <DialogClose asChild><Button type="button" variant="ghost" disabled={isSubmitting}>انصراف</Button></DialogClose>
                 <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="ml-2 h-4 w-4 animate-spin"/>}
                    {editingTeacher ? 'ویرایش' : 'افزودن'}
                 </Button>
            </DialogFooter>
            </form>
        </DialogContent>
       </Dialog>
    </Card>
  );
};

export default TeachersManagement;

