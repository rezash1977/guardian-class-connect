import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from 'sonner';
import { LogOut, School, CheckCircle, XCircle, Clock, AlertTriangle, Calendar as CalendarIcon, Loader2, Plus, Pencil, Trash2 } from 'lucide-react';
import { format, parse } from "date-fns-jalali"; // Import parse
import { cn } from "@/lib/utils";

// Interface definitions
interface ClassSubject {
  id: string;
  classes: {
    id: string;
    name: string;
    grade: string;
  };
  subjects: {
    name: string;
  };
}

interface Student {
  id: string;
  full_name: string;
}

interface DisciplineRecord {
  id: string;
  description: string;
  severity: string;
  created_at: string;
  students: {
    full_name: string;
  };
}

const TeacherDashboard = () => {
  const { signOut, user } = useAuth();
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([]);
  const [selectedClassSubjectId, setSelectedClassSubjectId] = useState<string | undefined>();
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceStatus, setAttendanceStatus] = useState<Record<string, string>>({});
  const [disciplineRecords, setDisciplineRecords] = useState<DisciplineRecord[]>([]);

  // State for date and lesson period selection
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [lessonPeriod, setLessonPeriod] = useState<string | undefined>();

  // State for discipline dialog
  const [disciplineOpen, setDisciplineOpen] = useState(false);
  const [editingDiscipline, setEditingDiscipline] = useState<DisciplineRecord | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | undefined>();
  const [disciplineDesc, setDisciplineDesc] = useState('');
  const [severity, setSeverity] = useState('low');

  const [loadingClassSubjects, setLoadingClassSubjects] = useState(false); // Loading state specifically for class subjects
  const [loadingStudentsAndAttendance, setLoadingStudentsAndAttendance] = useState(false); // Loading state for students and attendance
  const [isSubmittingAttendance, setIsSubmittingAttendance] = useState(false);
  const [loadingDiscipline, setLoadingDiscipline] = useState(false);

  useEffect(() => {
    if (user) {
      fetchTeacherClassSubjects();
    }
  }, [user]);

  const selectedClass = useMemo(() => {
    return classSubjects.find(cs => cs.id === selectedClassSubjectId)?.classes;
  }, [classSubjects, selectedClassSubjectId]);

  // Fetch students and discipline when selectedClass changes
  useEffect(() => {
    if (selectedClass) {
        setLoadingStudentsAndAttendance(true); // Start loading for students
        setLoadingDiscipline(true);
        Promise.all([
          fetchClassStudents(selectedClass.id), // This will set the default attendance
          fetchDisciplineRecords(selectedClass.id)
        ]).finally(() => {
            // Note: Don't stop student loading here, wait for attendance fetch
            setLoadingDiscipline(false);
         });
    } else {
      setStudents([]);
      setDisciplineRecords([]);
      setAttendanceStatus({}); // Clear status when class changes
    }
  }, [selectedClass]); // Depend only on selectedClass

  // Fetch attendance after students are loaded OR when date/period changes
  useEffect(() => {
    if (selectedClassSubjectId && date && lessonPeriod && students.length > 0) {
        // Students are loaded, now fetch specific attendance for the date/period
        fetchAttendance().finally(() => setLoadingStudentsAndAttendance(false)); // Stop loading after attendance fetch
    } else if (selectedClass) {
        // If class is selected but date/period/students aren't ready, ensure loading stops
        setLoadingStudentsAndAttendance(false);
    }
  }, [selectedClassSubjectId, date, lessonPeriod, students]); // Add students as dependency


  const fetchTeacherClassSubjects = async () => {
    if (!user) return;
    setLoadingClassSubjects(true);
    const { data: teacherData, error: teacherError } = await supabase
      .from('teachers')
      .select('id')
      .eq('profile_id', user.id)
      .single();

    if (teacherError || !teacherData) {
      toast.error("خطا در یافتن اطلاعات معلم");
      setLoadingClassSubjects(false);
      return;
    }

    const { data, error } = await supabase
      .from('class_subjects')
      .select('id, classes(id, name, grade), subjects(name)')
      .eq('teacher_id', teacherData.id);

    if (error) toast.error('خطا در بارگذاری کلاس‌ها');
    else {
        setClassSubjects((data as ClassSubject[]) || []);
        // Reset selection if previously selected class is no longer available? Optional.
    }
    setLoadingClassSubjects(false);
  };

  const fetchClassStudents = async (classId: string) => {
    const { data, error } = await supabase.from('students').select('id, full_name').eq('class_id', classId);
     if (error) {
         toast.error("خطا در بارگذاری دانش‌آموزان کلاس: " + error.message);
         setStudents([]);
         setAttendanceStatus({});
     } else {
        const fetchedStudents = data || [];
        setStudents(fetchedStudents);
        // Initialize attendance status to 'present' for all fetched students
        const initialStatus = fetchedStudents.reduce((acc, student) => {
          acc[student.id] = 'present'; // Default to present
          return acc;
        }, {} as Record<string, string>);
        setAttendanceStatus(initialStatus);
        console.log("Students loaded, initial status set to present:", initialStatus);
     }
      // Note: Loading indicator stopped in the useEffect hook after attendance is also fetched.
  };

  const fetchAttendance = async () => {
    if (!selectedClassSubjectId || !date || !lessonPeriod) return;
    console.log("Fetching existing attendance...");
    const formattedDate = format(date, 'yyyy-MM-dd');
    const { data, error } = await supabase
      .from('attendance')
      .select('student_id, status')
      .eq('class_subject_id', selectedClassSubjectId)
      .eq('date', formattedDate)
      .eq('lesson_period', lessonPeriod);

    if (error) {
        toast.error("خطا در بارگذاری سوابق حضور و غیاب قبلی: " + error.message);
        // Do not reset to present here, keep potentially existing 'present' defaults
    } else if (data && data.length > 0) {
      console.log("Found existing attendance records:", data);
      // Update the status based on fetched records
      // Important: Use functional update to base on the latest state (which has defaults)
      setAttendanceStatus(prevStatus => {
          const updatedStatus = { ...prevStatus }; // Start with current defaults
          data.forEach(record => {
              if (updatedStatus[record.student_id]) { // Update only if student exists in current list
                  updatedStatus[record.student_id] = record.status;
              }
          });
          console.log("Status updated with fetched records:", updatedStatus);
          return updatedStatus;
       });
    } else {
         console.log("No existing attendance records found for this slot.");
         // Ensure status remains defaulted to 'present' if nothing is fetched
         // (already handled by initializing in fetchClassStudents and updating functionally)
         setAttendanceStatus(prevStatus => ({...prevStatus})); // Trigger re-render if needed, ensuring defaults persist
     }
  };

  const fetchDisciplineRecords = async (classId: string) => {
     setLoadingDiscipline(true); // Added loading state management
    const { data, error } = await supabase
        .from('discipline_records')
        .select('*, students(full_name)')
        .eq('class_id', classId)
        .order('created_at', { ascending: false });

    if (error) toast.error("خطا در بارگذاری موارد انضباطی");
    else setDisciplineRecords(data as DisciplineRecord[] || []);
     setLoadingDiscipline(false); // Added loading state management
  };

  const handleAttendanceSubmit = async () => {
    if (!selectedClassSubjectId || !date || !lessonPeriod || Object.keys(attendanceStatus).length === 0 || !user) {
      toast.error('لطفاً کلاس، تاریخ، ساعت درسی و وضعیت دانش‌آموزان را مشخص کنید و مطمئن شوید وارد شده‌اید.');
      return;
    }
    setIsSubmittingAttendance(true);
    const formattedDate = format(date, 'yyyy-MM-dd');

    const recordsToUpsert = Object.entries(attendanceStatus).map(([studentId, status]) => ({
      // id: undefined, // Let Supabase handle ID generation or conflict resolution
      student_id: studentId,
      class_subject_id: selectedClassSubjectId,
      status,
      date: formattedDate,
      lesson_period: parseInt(lessonPeriod),
      recorded_by: user.id, // Ensure user.id is used
    }));

    console.log("Upserting attendance records:", recordsToUpsert);

    // Use upsert instead of delete + insert
    const { error } = await supabase
      .from('attendance')
      .upsert(recordsToUpsert, {
        // Specify the columns that form the unique constraint
        onConflict: 'student_id, class_subject_id, date, lesson_period',
        // defaultToNull: false // Keep existing values for unspecified columns (like ID, created_at)
      });


    if (error) {
        console.error("Upsert Error:", error);
        // Provide more specific feedback if possible
        if (error.message.includes('violates foreign key constraint')) {
            toast.error('خطا: اطلاعات کلاس، درس یا دانش‌آموز نامعتبر است.');
        } else if (error.message.includes('violates row-level security policy')) {
             toast.error('خطا: شما مجوز ثبت یا به‌روزرسانی حضور و غیاب برای این کلاس را ندارید.');
        } else if (error.message.includes('violates not-null constraint')) {
             toast.error(`خطا: یکی از فیلدهای ضروری (${error.message.split('"')[1] || ''}) مقداردهی نشده است.`);
        }
        else {
            toast.error('خطا در ثبت/به‌روزرسانی حضور و غیاب: ' + error.message);
        }
    } else {
      toast.success('حضور و غیاب با موفقیت ثبت/به‌روزرسانی شد.');
    }
    setIsSubmittingAttendance(false);
  };

  const handleDisciplineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass || !selectedStudentId || !user) {
        toast.error("لطفا دانش‌آموز را انتخاب کنید و مطمئن شوید وارد شده‌اید.");
        return;
    }

    setLoadingDiscipline(true); // Indicate loading

    if (editingDiscipline) {
        const { error } = await supabase.from('discipline_records').update({
            description: disciplineDesc,
            severity,
        }).eq('id', editingDiscipline.id);
        if (error) toast.error("خطا در ویرایش مورد انضباطی");
        else toast.success("مورد انضباطی با موفقیت ویرایش شد.");
    } else {
        const { error } = await supabase.from('discipline_records').insert({
          student_id: selectedStudentId,
          class_id: selectedClass.id,
          description: disciplineDesc,
          severity,
          recorded_by: user.id, // Ensure user.id is used
        });
        if (error) toast.error('خطا در ثبت مورد انضباطی');
        else toast.success('مورد انضباطی ثبت شد');
    }

    setDisciplineOpen(false);
    resetDisciplineForm();
    // Refetch discipline records after submit, ensuring loading indicator stops
    if (selectedClass) {
        fetchDisciplineRecords(selectedClass.id); // setLoadingDiscipline handled inside this func
    } else {
        setLoadingDiscipline(false);
    }
  };

  const handleDeleteDiscipline = async (recordId: string) => {
       setLoadingDiscipline(true); // Indicate loading
      const { error } = await supabase.from('discipline_records').delete().eq('id', recordId);
      if(error) toast.error("خطا در حذف مورد انضباطی");
      else {
          toast.success("مورد انضباطی حذف شد.");
          // Refetch discipline records after delete
          if (selectedClass) {
             fetchDisciplineRecords(selectedClass.id); // setLoadingDiscipline handled inside this func
          } else {
              setLoadingDiscipline(false);
          }
      }
  }

  const openDisciplineDialog = (record: DisciplineRecord | null) => {
    setEditingDiscipline(record);
    if (record && students.length > 0) { // Check if students are loaded
      const student = students.find(s => s.full_name === record.students.full_name);
      setSelectedStudentId(student?.id); // Set ID directly
      setDisciplineDesc(record.description);
      setSeverity(record.severity);
    } else {
        resetDisciplineForm(); // Reset if creating new or if student not found
    }
    setDisciplineOpen(true);
  }

  const resetDisciplineForm = () => {
    setEditingDiscipline(null);
    setSelectedStudentId(undefined);
    setDisciplineDesc('');
    setSeverity('low');
  }

  // --- Helper Functions (getStatusBadge, getSeverityBadge) remain the same ---
   const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present': return <Badge className="bg-green-500 hover:bg-green-600">حاضر</Badge>;
      case 'absent': return <Badge variant="destructive">غایب</Badge>;
      case 'late': return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-black">تأخیر</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'low': return <Badge className="bg-green-500 hover:bg-green-600">کم</Badge>;
      case 'medium': return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-black">متوسط</Badge>;
      case 'high': return <Badge variant="destructive">شدید</Badge>;
      default: return <Badge variant="outline">{severity}</Badge>;
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center"><School className="w-6 h-6 text-primary-foreground" /></div>
            <div><h1 className="text-2xl font-bold">پنل معلم</h1><p className="text-sm text-muted-foreground">ثبت حضور و غیاب و موارد انضباطی</p></div>
          </div>
          <Button onClick={signOut} variant="outline" className="gap-2"><LogOut className="w-4 h-4" />خروج</Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6" dir="rtl">
        <Card>
          <CardHeader><CardTitle>انتخاب کلاس، تاریخ و ساعت</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select
              value={selectedClassSubjectId}
              onValueChange={(value) => {
                  setSelectedClassSubjectId(value);
                  // Reset attendance status when class/subject changes
                  setAttendanceStatus({});
                  setStudents([]); // Also clear students to trigger refetch
              }}
              disabled={loadingClassSubjects}
            >
              <SelectTrigger>
                  <SelectValue placeholder={loadingClassSubjects ? "در حال بارگذاری..." : "انتخاب کلاس..."} />
              </SelectTrigger>
              <SelectContent>{classSubjects.map((cs) => (<SelectItem key={cs.id} value={cs.id}>{`${cs.classes.name} - ${cs.subjects.name}`}</SelectItem>))}</SelectContent>
            </Select>
             <Popover>
                <PopoverTrigger asChild>
                    <Button variant={"outline"} className={cn("w-full justify-start text-right font-normal", !date && "text-muted-foreground")}>
                        <CalendarIcon className="ml-2 h-4 w-4" />
                        {date ? format(date, "PPP") : <span>انتخاب تاریخ</span>}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={date} onSelect={setDate} initialFocus /></PopoverContent>
            </Popover>
            <Select value={lessonPeriod} onValueChange={setLessonPeriod}>
              <SelectTrigger><SelectValue placeholder="انتخاب ساعت درسی..." /></SelectTrigger>
              <SelectContent>
                {[...Array(4)].map((_, i) => (<SelectItem key={i + 1} value={String(i + 1)}>{`ساعت ${i + 1}`}</SelectItem>))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {selectedClassSubjectId && date && lessonPeriod && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div><CardTitle>ثبت حضور و غیاب</CardTitle><CardDescription>وضعیت هر دانش‌آموز را مشخص کنید (پیش‌فرض: حاضر)</CardDescription></div>
                 <AlertDialog>
                   <AlertDialogTrigger asChild>
                      <Button disabled={isSubmittingAttendance || loadingStudentsAndAttendance}>
                        {isSubmittingAttendance ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : null}
                        {isSubmittingAttendance ? 'در حال ثبت...' : 'ثبت حضور و غیاب'}
                      </Button>
                   </AlertDialogTrigger>
                  <AlertDialogContent dir="rtl">
                    <AlertDialogHeader><AlertDialogTitle>تایید ثبت/به‌روزرسانی</AlertDialogTitle><AlertDialogDescription>آیا از ثبت یا به‌روزرسانی اطلاعات حضور و غیاب برای این کلاس، تاریخ و ساعت مطمئن هستید؟</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>انصراف</AlertDialogCancel><AlertDialogAction onClick={handleAttendanceSubmit}>تایید و ثبت</AlertDialogAction></AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardHeader>
            <CardContent>
             {loadingStudentsAndAttendance ? (
                <div className="flex justify-center items-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="ml-2">در حال بارگذاری دانش‌آموزان...</span>
                </div>
             ) : students.length === 0 ? (
                 <p className="text-muted-foreground text-center py-4">دانش‌آموزی برای این کلاس یافت نشد.</p>
             ) : (
              <Table>
                <TableHeader><TableRow><TableHead className="text-right">نام دانش‌آموز</TableHead><TableHead className="text-right w-[240px]">وضعیت</TableHead></TableRow></TableHeader>
                <TableBody>
                  {students.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell>{student.full_name}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant={attendanceStatus[student.id] === 'present' ? 'default' : 'outline'} onClick={() => setAttendanceStatus({ ...attendanceStatus, [student.id]: 'present' })} className="gap-1 flex-1"><CheckCircle className="w-4 h-4" />حاضر</Button>
                          <Button size="sm" variant={attendanceStatus[student.id] === 'absent' ? 'destructive' : 'outline'} onClick={() => setAttendanceStatus({ ...attendanceStatus, [student.id]: 'absent' })} className="gap-1 flex-1"><XCircle className="w-4 h-4" />غایب</Button>
                          <Button size="sm" variant={attendanceStatus[student.id] === 'late' ? 'secondary' : 'outline'} onClick={() => setAttendanceStatus({ ...attendanceStatus, [student.id]: 'late' })} className="gap-1 flex-1"><Clock className="w-4 h-4" />تأخیر</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
             )}
            </CardContent>
          </Card>
        )}

        {selectedClass && (
          <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                    <div><CardTitle>موارد انضباطی</CardTitle><CardDescription>موارد انضباطی ثبت شده برای کلاس {selectedClass.name}</CardDescription></div>
                    <Dialog open={disciplineOpen} onOpenChange={(isOpen) => { setDisciplineOpen(isOpen); if (!isOpen) resetDisciplineForm(); }}>
                      <DialogTrigger asChild><Button variant="outline" className="gap-2" disabled={loadingStudentsAndAttendance}><Plus className="w-4 h-4" />ثبت مورد جدید</Button></DialogTrigger>
                      <DialogContent dir="rtl">
                        <DialogHeader>
                          <DialogTitle>{editingDiscipline ? 'ویرایش مورد انضباطی' : 'ثبت مورد انضباطی'}</DialogTitle>
                           <DialogDescription>اطلاعات مورد نیاز را وارد کنید.</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleDisciplineSubmit} className="space-y-4 pt-4">
                          <div className="space-y-2"><Label>دانش‌آموز</Label>
                              <Select value={selectedStudentId} onValueChange={setSelectedStudentId} disabled={!!editingDiscipline || loadingStudentsAndAttendance}>
                                  <SelectTrigger>
                                      <SelectValue placeholder={loadingStudentsAndAttendance ? "..." : "انتخاب دانش‌آموز"} />
                                  </SelectTrigger>
                                  <SelectContent>{students.map((student) => (<SelectItem key={student.id} value={student.id}>{student.full_name}</SelectItem>))}</SelectContent>
                              </Select>
                          </div>
                          <div className="space-y-2"><Label>شرح</Label><Textarea value={disciplineDesc} onChange={(e) => setDisciplineDesc(e.target.value)} required /></div>
                          <div className="space-y-2"><Label>شدت</Label><Select value={severity} onValueChange={setSeverity}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">کم</SelectItem><SelectItem value="medium">متوسط</SelectItem><SelectItem value="high">شدید</SelectItem></SelectContent></Select></div>
                          <Button type="submit" className="w-full" disabled={loadingDiscipline}>{loadingDiscipline ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : (editingDiscipline ? "ویرایش" : "ثبت")}</Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                  {loadingDiscipline ? (
                     <div className="flex justify-center items-center py-10">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <span className="ml-2">در حال بارگذاری موارد انضباطی...</span>
                    </div>
                  ) : disciplineRecords.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">هیچ موردی ثبت نشده است.</p>
                  ) : (
                  <Table>
                      <TableHeader><TableRow><TableHead className="text-right">دانش‌آموز</TableHead><TableHead className="text-right">شرح</TableHead><TableHead className="text-right">شدت</TableHead><TableHead className="text-right">تاریخ</TableHead><TableHead className="text-right">عملیات</TableHead></TableRow></TableHeader>
                      <TableBody>
                          {disciplineRecords.map(rec => (
                              <TableRow key={rec.id}>
                                  <TableCell>{rec.students?.full_name || 'نامشخص'}</TableCell>
                                  <TableCell>{rec.description}</TableCell>
                                  <TableCell>{getSeverityBadge(rec.severity)}</TableCell>
                                  {/* Use parse before format */}
                                  <TableCell>{rec.created_at ? format(parse(rec.created_at, "yyyy-MM-dd'T'HH:mm:ss.SSSSSSxxx", new Date()), 'yyyy/MM/dd') : '-'}</TableCell>
                                  <TableCell><div className="flex gap-2">
                                      <Button variant="outline" size="sm" onClick={() => openDisciplineDialog(rec)} disabled={loadingDiscipline}><Pencil className="w-4 h-4"/></Button>
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild><Button variant="destructive" size="sm" disabled={loadingDiscipline}><Trash2 className="w-4 h-4"/></Button></AlertDialogTrigger>
                                        <AlertDialogContent dir="rtl">
                                            <AlertDialogHeader><AlertDialogTitle>آیا مطمئن هستید؟</AlertDialogTitle><AlertDialogDescription>این عمل قابل بازگشت نیست.</AlertDialogDescription></AlertDialogHeader>
                                            <AlertDialogFooter><AlertDialogCancel>انصراف</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteDiscipline(rec.id)}>حذف</AlertDialogAction></AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                  </div></TableCell>
                              </TableRow>
                          ))}
                      </TableBody>
                  </Table>
                 )}
              </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default TeacherDashboard;

