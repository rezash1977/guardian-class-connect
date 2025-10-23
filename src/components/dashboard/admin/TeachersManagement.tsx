import { useState, useEffect, useMemo } from 'react';
// FIX: Corrected import paths based on standard alias configuration and relative location
import { supabase } from '@/integrations/supabase/client'; // Assuming @ refers to src/
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil, Search, UserPlus, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
// FIX: Corrected relative import path
import { ExcelImportDialog } from './ExcelImportDialog'; // Assuming it's in the same directory
// FIX: Corrected import path using alias
import { useSortableData } from '@/hooks/use-sortable-data'; // Assuming @ refers to src/

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
      toast.error('خطا در بارگذاری معلم‌ها: ' + error.message);
    } else {
      setTeachers((data as Teacher[]) || []);
    }
    setLoading(false);
  };

  const handleAddOrEditTeacher = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingTeacher) {
      // Logic for editing an existing teacher's profile
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
      // Send full_name and username directly in the user object
      const { data, error } = await supabase.functions.invoke('bulk-signup', {
        body: {
          userType: 'teacher',
          users: [{
            email,
            password,
            full_name: fullName, // Sent directly
            username: username, // Sent directly
          }]
        },
      });

      if (error || !data.success || (data.errors && data.errors.length > 0)) {
        const errorMsg = error?.message || (data?.errors?.join(', ')) || 'خطای ناشناخته در افزودن معلم';
        toast.error(`خطا در افزودن معلم: ${errorMsg}`);
        console.error("Add Teacher Error:", error, data);
        return;
      }
      toast.success('معلم با موفقیت اضافه شد.');
    }

    setOpen(false);
    resetForm();
    await fetchTeachers();
  };

  const handleTeacherImport = async (data: any[]) => {
      // Prepare data for bulk signup, sending full_name and username directly
      const users = data.map(row => ({
          email: row.email,
          password: String(row.password),
          full_name: row.full_name, // Sent directly
          username: row.username, // Sent directly
      }));

      const { data: result, error } = await supabase.functions.invoke('bulk-signup', {
          body: {
            userType: 'teacher',
            users
          }
      });

      if (error || !result || !result.success) {
          const errorMsg = error?.message || (result?.errors?.join(', ')) || "خطای سرور ناشناخته در وارد کردن معلم‌ها";
          return { success: false, errors: [errorMsg] };
      }

      await fetchTeachers();
      return { success: true, errors: result.errors || [] };
  };


  const handleDeleteTeacher = async (teacher: Teacher) => {
    // Attempt to delete the profile first. RLS/Triggers might handle auth user deletion or related records.
    const { error: profileDeleteError } = await supabase.from('profiles').delete().eq('id', teacher.profile_id);

    if (profileDeleteError) {
      toast.error('خطا در حذف پروفایل معلم: ' + profileDeleteError.message);
    } else {
      // If profile deletion is successful, we assume related records might be handled by DB constraints/triggers.
      // A more robust solution might involve an Edge Function to ensure auth user deletion too.
      toast.success(`پروفایل معلم (${teacher.profiles.full_name}) حذف شد.`);
      fetchTeachers(); // Refresh the list
    }
    // Note: Deleting the corresponding auth.users entry usually requires admin privileges,
    // often handled via SECURITY DEFINER functions or Edge Functions with the service_role key.
    // The current approach might leave orphaned auth users if not handled elsewhere.
  };

  const openEditDialog = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setFullName(teacher.profiles.full_name);
    setUsername(teacher.profiles.username);
    setEmail(teacher.profiles.email || '');
    setPassword(''); // Clear password field for editing
    setOpen(true);
  };

  const resetForm = () => {
    setEditingTeacher(null);
    setFullName('');
    setUsername('');
    setEmail('');
    setPassword('');
  };

  // Memoize filtered teachers based on search term
  const filteredTeachers = useMemo(() => {
    if (!sortedItems) return [];
    const lowerSearchTerm = searchTerm.toLowerCase();
    return sortedItems.filter(teacher =>
      teacher.profiles.full_name.toLowerCase().includes(lowerSearchTerm) ||
      teacher.profiles.username.toLowerCase().includes(lowerSearchTerm) ||
      (teacher.profiles.email || '').toLowerCase().includes(lowerSearchTerm)
    );
  }, [sortedItems, searchTerm]);

  // Component for table headers with sorting functionality
  const SortableHeader = ({ sortKey, children }: { sortKey: string, children: React.ReactNode }) => {
    const isSorted = sortConfig?.key === sortKey;
    const direction = sortConfig?.direction;
    const icon = !isSorted
        ? <ArrowUpDown className="mr-2 h-4 w-4 opacity-50" />
        : direction === 'ascending'
        ? <ArrowUp className="mr-2 h-4 w-4" />
        : <ArrowDown className="mr-2 h-4 w-4" />;
    return <Button variant="ghost" onClick={() => requestSort(sortKey)}>{children}{icon}</Button>
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1">
            <CardTitle>مدیریت معلم‌ها</CardTitle>
            <CardDescription>افزودن، ویرایش، حذف و جستجوی معلم‌ها</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ExcelImportDialog
              triggerButton={<Button variant="outline" className="gap-2 w-full sm:w-auto"><UserPlus className="w-4 h-4" />وارد کردن از فایل</Button>}
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
              <DialogTrigger asChild><Button className="gap-2 w-full sm:w-auto"><Plus className="w-4 h-4" />افزودن معلم</Button></DialogTrigger>
              <DialogContent dir="rtl">
                <DialogHeader><DialogTitle>{editingTeacher ? 'ویرایش معلم' : 'افزودن معلم جدید'}</DialogTitle></DialogHeader>
                <form onSubmit={handleAddOrEditTeacher} className="space-y-4 pt-4">
                  {/* Form fields */}
                  <div className="space-y-2">
                    <Label htmlFor="fullName">نام و نام خانوادگی</Label>
                    <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">ایمیل</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required={!editingTeacher} disabled={!!editingTeacher} dir="ltr" className="text-left"/>
                    {editingTeacher && <p className="text-xs text-muted-foreground">ایمیل قابل ویرایش نیست.</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="username">نام کاربری</Label>
                    <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} required={!editingTeacher} disabled={!!editingTeacher} />
                     {editingTeacher && <p className="text-xs text-muted-foreground">نام کاربری قابل ویرایش نیست.</p>}
                  </div>
                  {/* Password field only shown when adding a new teacher */}
                  {!editingTeacher && (
                    <div className="space-y-2">
                      <Label htmlFor="password">رمز عبور</Label>
                      <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                      <p className="text-xs text-muted-foreground">حداقل ۶ کاراکتر.</p>
                    </div>
                  )}
                  <Button type="submit" className="w-full">{editingTeacher ? 'ویرایش اطلاعات' : 'افزودن معلم'}</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        {/* Search Input */}
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="جستجوی معلم (نام، کاربری، ایمیل)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full"
            dir="rtl"
          />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">در حال بارگذاری...</div>
        ) : (
          <div className="overflow-x-auto border rounded-md">
            <Table dir="rtl">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right whitespace-nowrap"><SortableHeader sortKey="profiles.full_name">نام</SortableHeader></TableHead>
                  <TableHead className="text-right whitespace-nowrap"><SortableHeader sortKey="profiles.username">نام کاربری</SortableHeader></TableHead>
                  <TableHead className="text-right whitespace-nowrap"><SortableHeader sortKey="profiles.email">ایمیل</SortableHeader></TableHead>
                  <TableHead className="text-right whitespace-nowrap w-[100px]">عملیات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeachers.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">هیچ معلمی یافت نشد.</TableCell></TableRow>
                ) : (
                  filteredTeachers.map((teacher) => (
                    <TableRow key={teacher.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">{teacher.profiles.full_name}</TableCell>
                      <TableCell>{teacher.profiles.username}</TableCell>
                      <TableCell dir="ltr" className="text-right">{teacher.profiles.email || '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openEditDialog(teacher)} aria-label={`ویرایش ${teacher.profiles.full_name}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="icon" className="h-8 w-8" aria-label={`حذف ${teacher.profiles.full_name}`}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent dir="rtl">
                              <AlertDialogHeader>
                                <AlertDialogTitle>آیا از حذف مطمئن هستید؟</AlertDialogTitle>
                                <AlertDialogDescription>
                                    این عمل پروفایل معلم ({teacher.profiles.full_name}) را حذف می‌کند. این عمل قابل بازگشت نیست. برای حذف کامل کاربر از سیستم (شامل auth)، ممکن است نیاز به اقدامات بیشتری باشد.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>انصراف</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteTeacher(teacher)} className="bg-destructive hover:bg-destructive/90">
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
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TeachersManagement;

