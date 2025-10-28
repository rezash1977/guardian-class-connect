import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil, Search, Upload, Loader2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { ExcelImportDialog } from './ExcelImportDialog';
import { useSortableData, SortConfig } from '@/hooks/use-sortable-data'; // Import hook and type
import * as XLSX from 'xlsx'; // Import xlsx library

// Interface definitions
interface ParentProfile {
  id: string;
  full_name: string;
  username?: string; // Optional for display
}

interface ClassInfo {
  id: string;
  name: string;
  grade: string;
}

interface StudentRecord {
  id: string;
  full_name: string;
  class_id: string | null;
  parent_id: string | null;
  classes: { // For join result
    id: string;
    name: string;
  } | null;
  profiles: ParentProfile | null; // For join result
}

const studentImportFields = {
  required: {
    student_full_name: "نام دانش آموز*",
    class_name: "نام کلاس*", // Import by name, find ID later
    parent_username: "نام کاربری ولی*", // Used to find parent_id
  },
  optional: {
     // Fields for creating a NEW parent if username not found
     parent_full_name: "نام کامل ولی (جدید)",
     parent_email: "ایمیل ولی (جدید)",
     parent_password: "رمز عبور ولی (جدید)",
  },
};

// Helper component for Sortable Headers
const SortableHeader = ({ sortKey, children, sortConfig, requestSort }: { sortKey: string, children: React.ReactNode, sortConfig: SortConfig<StudentRecord> | null, requestSort: (key: string) => void }) => {
    const isSorted = sortConfig?.key === sortKey;
    const direction = isSorted ? sortConfig?.direction : null;
    const icon = !isSorted
        ? <ArrowUpDown className="ml-2 h-4 w-4 opacity-30 group-hover:opacity-100" />
        : direction === 'ascending'
        ? <ArrowUp className="ml-2 h-4 w-4 text-primary" />
        : <ArrowDown className="ml-2 h-4 w-4 text-primary" />;
    return <Button variant="ghost" onClick={() => requestSort(sortKey)} className="group px-1 py-1 h-auto -ml-2">{children}{icon}</Button>
};

const StudentsManagement = () => {
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [parents, setParents] = useState<ParentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add/Edit Dialog state
  const [open, setOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentRecord | null>(null);
  const [studentName, setStudentName] = useState('');
  const [classId, setClassId] = useState<string | undefined>();
  const [parentId, setParentId] = useState<string | undefined>();

  // Add Parent Dialog state (for single student add)
  const [parentOpen, setParentOpen] = useState(false);
  const [parentFullName, setParentFullName] = useState('');
  const [parentUsername, setParentUsername] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [parentPassword, setParentPassword] = useState('');

  // Search and Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClassId, setFilterClassId] = useState('all');

  // Use the sortable hook
  const { items: sortedStudents, requestSort, sortConfig } = useSortableData<StudentRecord>(students, { key: 'full_name', direction: 'ascending' });


  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    await Promise.all([fetchStudents(), fetchClasses(), fetchParents()]);
    setLoading(false);
  };

  const fetchStudents = async () => {
    const { data, error } = await supabase
      .from('students')
      .select('*, classes(id, name), profiles(id, full_name, username)'); // Join profiles for parent info

    if (error) toast.error('خطا در بارگذاری دانش‌آموزان: ' + error.message);
    else setStudents((data as StudentRecord[]) || []);
  };

  const fetchClasses = async () => {
    const { data, error } = await supabase.from('classes').select('id, name, grade');
    if (error) toast.error('خطا در بارگذاری کلاس‌ها: ' + error.message);
    else setClasses(data || []);
  };

  const fetchParents = async () => {
     // Corrected query to fetch profiles with role 'parent'
     const { data: parentUsers, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'parent');

     if (roleError) {
         toast.error('خطا در یافتن نقش والدین: ' + roleError.message);
         setParents([]);
         return;
     }

     if (!parentUsers || parentUsers.length === 0) {
         setParents([]);
         return;
     }

     const parentIds = parentUsers.map(p => p.user_id);

     const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, username')
        .in('id', parentIds);

    if (profileError) toast.error('خطا در بارگذاری والدین: ' + profileError.message);
    else setParents(profileData || []);
  };

  // --- Add/Edit Student Logic ---
  const handleAddOrEditStudent = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!classId) {
        toast.error("لطفا کلاس دانش‌آموز را انتخاب کنید.");
        return;
    }
    setIsSubmitting(true);
    try {
        const studentData = {
            full_name: studentName,
            class_id: classId || null,
            parent_id: parentId || null,
        };

      if (editingStudent) {
        // --- Edit existing student ---
        const { error } = await supabase
          .from('students')
          .update(studentData)
          .eq('id', editingStudent.id);
        if (error) throw error;
        toast.success('دانش‌آموز با موفقیت ویرایش شد');
      } else {
        // --- Add new student ---
        const { error } = await supabase
          .from('students')
          .insert(studentData);
        if (error) throw error;
        toast.success('دانش‌آموز با موفقیت اضافه شد');
      }
      setOpen(false);
      resetForm();
      fetchStudents(); // Refresh student list
    } catch (error: any) {
        console.error("Add/Edit student error:", error);
        toast.error(`خطا: ${error.message || 'عملیات ناموفق بود'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Add Parent Logic (Single Student Add Flow) ---
   const handleAddParent = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setIsSubmitting(true);

     const parentData = {
        email: parentEmail,
        password: parentPassword,
        options: {
            data: {
                full_name: parentFullName,
                username: parentUsername,
                role: 'parent' // Ensure role is set
            }
        },
        parent_info: {} // For future parent-specific data if needed
    };

    try {
         const { data: result, error: functionError } = await supabase.functions.invoke('bulk-signup', {
           body: { users: [parentData], userType: 'parent' }, // Use edge function
         });

        if (functionError) throw functionError;

        if (result.errors && result.errors.length > 0) {
           toast.error(`خطا در افزودن ولی: ${result.errors[0]}`);
        } else if (result.results && result.results.length > 0 && result.results[0]?.id) {
           toast.success('ولی با موفقیت اضافه شد. لطفاً ایمیل تایید را چک کند.');
           const newParentId = result.results[0].id;
           setParentId(newParentId); // Automatically select the new parent
           setParentOpen(false); // Close parent dialog
           resetParentForm();
           fetchParents(); // Refresh parent list
        } else {
            // Handle case where function returns success but no ID (should not happen ideally)
             toast.error("خطا در افزودن ولی: پاسخ نامعتبر از سرور.");
             console.error("Unexpected response from bulk-signup:", result);
        }

    } catch (error: any) {
      console.error("Add parent error:", error);
      toast.error(`خطا: ${error.message || 'عملیات ناموفق بود'}`);
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleDeleteStudent = async (studentId: string) => {
    // Note: This only deletes the student record.
    // Consider implications if attendance/discipline records should also be removed or anonymized.
    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', studentId);

    if (error) {
      toast.error('خطا در حذف دانش‌آموز: ' + error.message);
    } else {
      toast.success('دانش‌آموز حذف شد');
      fetchStudents(); // Refresh the list
    }
  };

  const openEditModal = (student: StudentRecord) => {
    setEditingStudent(student);
    setStudentName(student.full_name);
    setClassId(student.class_id || undefined);
    setParentId(student.parent_id || undefined);
    setOpen(true);
  };

   const openAddModal = () => {
    setEditingStudent(null);
    resetForm();
    setOpen(true);
  };

  const resetForm = () => {
    setEditingStudent(null);
    setStudentName('');
    setClassId(undefined);
    setParentId(undefined);
  };

  const resetParentForm = () => {
    setParentFullName('');
    setParentUsername('');
    setParentEmail('');
    setParentPassword('');
  };

   // --- Excel Import Logic ---
   const handleStudentImport = async (dataToImport: Record<string, any>[]) => {
       setIsLoading(true);
        // 1. Fetch existing parents and classes to map names/usernames to IDs
        const { data: currentParents } = await supabase.from('profiles').select('id, username');
        const { data: currentClasses } = await supabase.from('classes').select('id, name');
        if (!currentParents || !currentClasses) {
            toast.error("خطا در بارگذاری اطلاعات اولیه برای وارد کردن.");
            setIsLoading(false);
            return { success: false, errors: ["خطا در بارگذاری اطلاعات اولیه."] };
        }
        const parentMap = new Map(currentParents.map(p => [p.username, p.id]));
        const classMap = new Map(currentClasses.map(c => [c.name, c.id]));

        const studentsToInsert: any[] = [];
        const parentsToCreate: any[] = [];
        const errors: string[] = [];
        const processedUsernames = new Set<string>(); // Track parents being created in this batch

        dataToImport.forEach((item, index) => {
            const rowNum = index + 2; // Excel row number (assuming header is row 1)
            let parent_id = parentMap.get(item.parent_username);
            let class_id = classMap.get(item.class_name);
            let requiresNewParent = false;

            if (!item.student_full_name || !item.class_name || !item.parent_username) {
                errors.push(`ردیف ${rowNum}: اطلاعات الزامی (نام دانش آموز، نام کلاس، نام کاربری ولی) ناقص است.`);
                return; // Skip this row
            }

            if (!class_id) {
                errors.push(`ردیف ${rowNum}: کلاس با نام "${item.class_name}" یافت نشد.`);
                return; // Skip if class not found
            }

            if (!parent_id && !processedUsernames.has(item.parent_username)) {
                // Parent not found, check if info to create new parent exists
                if (item.parent_full_name && item.parent_email && item.parent_password) {
                     // Basic validation for new parent info
                     if (String(item.parent_password).length < 6) {
                         errors.push(`ردیف ${rowNum}: رمز عبور ولی جدید باید حداقل 6 کاراکتر باشد.`);
                         return;
                     }
                      if (!/\S+@\S+\.\S+/.test(item.parent_email)) {
                         errors.push(`ردیف ${rowNum}: ایمیل ولی جدید نامعتبر است.`);
                         return;
                     }

                    parentsToCreate.push({
                        email: item.parent_email,
                        password: String(item.parent_password),
                        options: {
                            data: {
                                full_name: item.parent_full_name,
                                username: item.parent_username,
                                role: 'parent'
                            }
                        },
                        parent_info: {}
                    });
                    processedUsernames.add(item.parent_username); // Mark for creation
                    requiresNewParent = true;
                } else {
                    errors.push(`ردیف ${rowNum}: ولی با نام کاربری "${item.parent_username}" یافت نشد و اطلاعات لازم برای ایجاد ولی جدید (نام کامل، ایمیل، رمز عبور) ارائه نشده است.`);
                    return; // Skip if parent not found and cannot be created
                }
            } else if (!parent_id && processedUsernames.has(item.parent_username)) {
                 // Parent will be created in this batch, need to link later
                 requiresNewParent = true;
            }


            studentsToInsert.push({
                full_name: item.student_full_name,
                class_id: class_id,
                parent_id: requiresNewParent ? item.parent_username : parent_id, // Use username as temp key if new parent
                requiresNewParent: requiresNewParent // Flag to link later
            });
        });

        // If only errors, return early
        if (studentsToInsert.length === 0 && parentsToCreate.length === 0 && errors.length > 0) {
             setIsLoading(false);
             return { success: false, errors };
        }

        let newParentResults: any[] = [];
        // 2. Create new parents using Edge Function
        if (parentsToCreate.length > 0) {
            const { data: parentResult, error: functionError } = await supabase.functions.invoke('bulk-signup', {
               body: { users: parentsToCreate, userType: 'parent' },
            });
            if (functionError) {
                setIsLoading(false);
                errors.push(`خطا در ایجاد دسته‌جمعی والدین: ${functionError.message}`);
                return { success: false, errors };
            }
             if (parentResult.errors && parentResult.errors.length > 0) {
                 errors.push(...parentResult.errors.map((e: string) => `خطا در ایجاد ولی: ${e}`));
                 // Filter out students whose parents failed to create
                 const failedUsernames = new Set(
                     parentsToCreate.filter((_, i) => parentResult.errors.some((err: string) => err.includes(parentsToCreate[i].options.data.username)))
                                     .map(p => p.options.data.username)
                 );
                 studentsToInsert = studentsToInsert.filter(s => !(s.requiresNewParent && failedUsernames.has(s.parent_id)));
             }
             newParentResults = parentResult.results || [];
             // Update parentMap with newly created parents
             newParentResults.forEach(p => parentMap.set(p.username, p.id));
             fetchParents(); // Refresh parent list in UI
        }


       // 3. Map parent_id for students whose parents were just created
       studentsToInsert.forEach(student => {
           if (student.requiresNewParent) {
               const newParentId = parentMap.get(student.parent_id); // Find the ID using the temp username key
               if (newParentId) {
                   student.parent_id = newParentId;
               } else {
                   // This student's parent creation might have failed, mark for error reporting
                   student.parent_id = null; // Prevent insertion with invalid ID
                   errors.push(`خطا: اطلاعات ولی برای دانش آموز "${student.full_name}" یافت نشد یا ایجاد نشد.`);
               }
           }
           delete student.requiresNewParent; // Clean up temporary flag
       });

       // Filter out students that couldn't be linked to a parent
       const validStudentsToInsert = studentsToInsert.filter(s => s.parent_id !== null);


        // 4. Insert students
        let studentInsertSuccessCount = 0;
        if (validStudentsToInsert.length > 0) {
            const { error: studentError, count } = await supabase.from('students').insert(validStudentsToInsert);
            if (studentError) {
                errors.push(`خطا در درج دسته‌جمعی دانش‌آموزان: ${studentError.message}`);
            }
             studentInsertSuccessCount = count ?? 0;
        }

        setIsLoading(false);
        fetchStudents(); // Refresh student list

        const finalSuccess = errors.length === 0 && studentInsertSuccessCount === validStudentsToInsert.length;
        const successResults = [
            ...(newParentResults.map(p => `ولی ${p.full_name} ایجاد شد.`)),
            ...([...Array(studentInsertSuccessCount)].map((_, i) => `دانش آموز ${validStudentsToInsert[i]?.full_name || ''} وارد شد.`))
        ];

        return { success: finalSuccess, results: successResults, errors };
   };

    // --- Excel Template Generation ---
   const generateStudentTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
        // Combine required and optional field display names
      [...Object.values(studentImportFields.required), ...Object.values(studentImportFields.optional)]
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "دانش آموزان");
    XLSX.writeFile(wb, "students_template.xlsx");
  };

  // --- Filtering Logic ---
   const filteredStudents = useMemo(() => {
    if (!sortedStudents) return [];
    const lowerSearchTerm = searchTerm.toLowerCase();
    return sortedStudents.filter(student => {
        const nameMatch = student.full_name.toLowerCase().includes(lowerSearchTerm);
        const parentNameMatch = student.profiles?.full_name?.toLowerCase().includes(lowerSearchTerm) ?? false;
        const parentUsernameMatch = student.profiles?.username?.toLowerCase().includes(lowerSearchTerm) ?? false;
        const classMatch = filterClassId === 'all' || student.class_id === filterClassId;
        return (nameMatch || parentNameMatch || parentUsernameMatch) && classMatch;
    });
  }, [sortedStudents, searchTerm, filterClassId]);


  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>مدیریت دانش‌آموزان</CardTitle>
            <CardDescription>افزودن، ویرایش، حذف و وارد کردن دسته‌جمعی دانش‌آموزان</CardDescription>
          </div>
          <div className="flex w-full sm:w-auto gap-2">
            {/* Parent Add Dialog Trigger */}
             <Dialog open={parentOpen} onOpenChange={(isOpen) => { if (!isOpen) resetParentForm(); setParentOpen(isOpen);}}>
                <DialogTrigger asChild><Button variant="outline" className="gap-2"><Plus className="w-4 h-4" />افزودن ولی</Button></DialogTrigger>
                <DialogContent dir="rtl">
                    <DialogHeader><DialogTitle>افزودن ولی جدید</DialogTitle><DialogDescription>اطلاعات ولی جدید را وارد کنید.</DialogDescription></DialogHeader>
                    <form onSubmit={handleAddParent} className="space-y-4 pt-4">
                        {/* Parent Form Fields */}
                        <div className="space-y-2"><Label htmlFor="pFullName">نام کامل*</Label><Input id="pFullName" value={parentFullName} onChange={(e) => setParentFullName(e.target.value)} required dir="rtl"/></div>
                        <div className="space-y-2"><Label htmlFor="pUsername">نام کاربری*</Label><Input id="pUsername" value={parentUsername} onChange={(e) => setParentUsername(e.target.value)} required dir="rtl"/></div>
                        <div className="space-y-2"><Label htmlFor="pEmail">ایمیل*</Label><Input id="pEmail" type="email" value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} required dir="ltr" className="text-left"/></div>
                        <div className="space-y-2"><Label htmlFor="pPassword">رمز عبور*</Label><Input id="pPassword" type="password" value={parentPassword} onChange={(e) => setParentPassword(e.target.value)} required minLength={6} dir="rtl"/></div>
                        <DialogFooter className="pt-4">
                            <DialogClose asChild><Button type="button" variant="ghost" disabled={isSubmitting}>انصراف</Button></DialogClose>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="ml-2 h-4 w-4 animate-spin"/>} افزودن
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Excel Import Dialog */}
             <ExcelImportDialog
                requiredFields={studentImportFields.required}
                optionalFields={studentImportFields.optional}
                onImport={handleStudentImport}
                templateGenerator={generateStudentTemplate}
                entityName="دانش آموز"
            />
            {/* Student Add Dialog Trigger */}
            <Button onClick={openAddModal} className="gap-2">
              <Plus className="w-4 h-4" />
              افزودن دانش‌آموز
            </Button>
          </div>
        </div>
         {/* Search and Filter Inputs */}
         <div className="flex flex-wrap items-center gap-2 pt-4">
            <div className="relative flex-grow min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="جستجوی نام دانش آموز / ولی..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" dir="rtl"/>
            </div>
            <Select value={filterClassId} onValueChange={setFilterClassId}>
                <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="فیلتر کلاس" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">همه کلاس‌ها</SelectItem>
                    {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => { setSearchTerm(''); setFilterClassId('all'); }}>پاک کردن فیلترها</Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary"/></div>
        ) : (
          <Table dir="rtl">
            <TableHeader>
              <TableRow>
                <TableHead className="text-right"><SortableHeader sortKey="full_name" sortConfig={sortConfig} requestSort={requestSort}>نام دانش‌آموز</SortableHeader></TableHead>
                <TableHead className="text-right"><SortableHeader sortKey="classes.name" sortConfig={sortConfig} requestSort={requestSort}>کلاس</SortableHeader></TableHead>
                <TableHead className="text-right"><SortableHeader sortKey="profiles.full_name" sortConfig={sortConfig} requestSort={requestSort}>ولی</SortableHeader></TableHead>
                <TableHead className="text-right">عملیات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    هیچ دانش‌آموزی یافت نشد
                  </TableCell>
                </TableRow>
              ) : (
                filteredStudents.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell>{student.full_name}</TableCell>
                    <TableCell>{student.classes?.name || 'تعیین نشده'}</TableCell>
                    <TableCell>{student.profiles?.full_name || 'تعیین نشده'} {student.profiles?.username ? `(${student.profiles.username})` : ''}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEditModal(student)}>
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
                                    این عمل دانش‌آموز را حذف می‌کند. آیا از حذف مطمئن هستید؟
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>انصراف</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteStudent(student.id)}>
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

      {/* Student Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) resetForm(); setOpen(isOpen); }}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>{editingStudent ? 'ویرایش دانش‌آموز' : 'افزودن دانش‌آموز جدید'}</DialogTitle>
              <DialogDescription>اطلاعات دانش‌آموز را وارد کنید.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddOrEditStudent} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="sFullName">نام دانش‌آموز*</Label>
                <Input id="sFullName" value={studentName} onChange={(e) => setStudentName(e.target.value)} required dir="rtl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sClass">کلاس*</Label>
                <Select value={classId} onValueChange={setClassId}>
                  <SelectTrigger id="sClass"><SelectValue placeholder="انتخاب کلاس" /></SelectTrigger>
                  <SelectContent>{classes.map((cls) => (<SelectItem key={cls.id} value={cls.id}>{`${cls.name} - ${cls.grade}`}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sParent">ولی</Label>
                <Select value={parentId} onValueChange={setParentId}>
                  <SelectTrigger id="sParent"><SelectValue placeholder="انتخاب ولی" /></SelectTrigger>
                  <SelectContent>{parents.map((parent) => (<SelectItem key={parent.id} value={parent.id}>{`${parent.full_name} (${parent.username || 'بدون نام کاربری'})`}</SelectItem>))}</SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">اگر ولی در لیست نیست، ابتدا از دکمه "افزودن ولی" استفاده کنید.</p>
              </div>
               <DialogFooter className="pt-4">
                 <DialogClose asChild><Button type="button" variant="ghost" disabled={isSubmitting}>انصراف</Button></DialogClose>
                 <Button type="submit" disabled={isSubmitting || !classId}> {/* Disable if class not selected */}
                    {isSubmitting && <Loader2 className="ml-2 h-4 w-4 animate-spin"/>}
                    {editingStudent ? 'ویرایش' : 'افزودن'}
                 </Button>
            </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
    </Card>
  );
};

export default StudentsManagement;

