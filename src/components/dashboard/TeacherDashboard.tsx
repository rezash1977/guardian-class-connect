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
import { parseISO, isValid } from 'date-fns';
import { format, parse } from "date-fns-jalali";
import { cn } from "@/lib/utils";

// Interface definitions (remain the same)
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

interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
  is_justified: boolean | null;
  lesson_period: number;
  medical_certificate_url: string | null;
  class_subjects: {
    subjects: {
      name: string;
    };
  } | null;
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
  const { signOut, user, loading: authLoading } = useAuth();
  // --- MODIFICATION: Add state for teacher's full name ---
  const [teacherFullName, setTeacherFullName] = useState<string | null>(null);
  // --- END MODIFICATION ---
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([]);
  const [selectedClassSubjectId, setSelectedClassSubjectId] = useState<string | undefined>();
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceStatus, setAttendanceStatus] = useState<Record<string, { status: string; justified: boolean | null }>>({});
  const [disciplineRecords, setDisciplineRecords] = useState<DisciplineRecord[]>([]);

  const [date, setDate] = useState<Date | undefined>(new Date());
  const [lessonPeriod, setLessonPeriod] = useState<string | undefined>();

  const [disciplineOpen, setDisciplineOpen] = useState(false);
  const [editingDiscipline, setEditingDiscipline] = useState<DisciplineRecord | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | undefined>();
  const [disciplineDesc, setDisciplineDesc] = useState('');
  const [severity, setSeverity] = useState('low');

  const [loadingClassSubjects, setLoadingClassSubjects] = useState(false);
  const [loadingStudentsAndAttendance, setLoadingStudentsAndAttendance] = useState(false);
  const [isSubmittingAttendance, setIsSubmittingAttendance] = useState(false);
  const [loadingDiscipline, setLoadingDiscipline] = useState(false);

  // --- MODIFICATION: Fetch teacher's full name ---
  useEffect(() => {
    const fetchTeacherName = async () => {
        if (user) {
            console.log("[TeacherDashboard] Fetching teacher name for user:", user.id);
            const { data, error } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', user.id)
                .single();

            if (error) {
                console.error("Error fetching teacher name:", error);
                toast.error("خطا در دریافت نام معلم");
                setTeacherFullName(null); // Set to null on error
            } else if (data) {
                console.log("[TeacherDashboard] Teacher name fetched:", data.full_name);
                setTeacherFullName(data.full_name);
            } else {
                 setTeacherFullName(null); // Set to null if no data found
            }
        } else {
            setTeacherFullName(null); // Clear name if user logs out
        }
    };

    fetchTeacherName();
  }, [user]); // Run when user object changes
  // --- END MODIFICATION ---


  useEffect(() => {
    if (user) {
      fetchTeacherClassSubjects();
    }
  }, [user]);

  const selectedClass = useMemo(() => {
    return classSubjects.find(cs => cs.id === selectedClassSubjectId)?.classes;
  }, [classSubjects, selectedClassSubjectId]);

  useEffect(() => {
    if (selectedClass) {
        setLoadingStudentsAndAttendance(true);
        setLoadingDiscipline(true);
        Promise.all([
          fetchClassStudents(selectedClass.id),
          fetchDisciplineRecords(selectedClass.id)
        ]).finally(() => {
            setLoadingDiscipline(false);
         });
    } else {
      setStudents([]);
      setDisciplineRecords([]);
      setAttendanceStatus({});
    }
  }, [selectedClass]);

  useEffect(() => {
    if (selectedClassSubjectId && date && lessonPeriod && students.length > 0) {
        fetchAttendance().finally(() => setLoadingStudentsAndAttendance(false));
    } else if (selectedClass && students.length === 0) {
        setLoadingStudentsAndAttendance(false);
    }
  }, [selectedClassSubjectId, date, lessonPeriod, students]);


  // fetch functions remain the same
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
    }
    setLoadingClassSubjects(false);
  };

  const fetchClassStudents = async (classId: string) => {
     const { data, error } = await supabase.from('students').select('id, full_name').eq('class_id', classId);
     if (error) {
         toast.error("خطا در بارگذاری دانش‌آموزان کلاس: " + error.message);
         setStudents([]);
         setAttendanceStatus({});
         setLoadingStudentsAndAttendance(false);
     } else {
        const fetchedStudents = data || [];
        setStudents(fetchedStudents);
        const initialStatus = fetchedStudents.reduce((acc, student) => {
          acc[student.id] = { status: 'present', justified: null };
          return acc;
        }, {} as Record<string, { status: string; justified: boolean | null }>);
        setAttendanceStatus(initialStatus);
        console.log("Students loaded, initial status set:", initialStatus);
     }
  };

  const fetchAttendance = async () => {
    if (!selectedClassSubjectId || !date || !lessonPeriod) return;
    console.log("Fetching existing attendance...");
    const formattedDate = format(date, 'yyyy-MM-dd');
    const { data, error } = await supabase
      .from('attendance')
      .select('student_id, status, is_justified')
      .eq('class_subject_id', selectedClassSubjectId)
      .eq('date', formattedDate)
      .eq('lesson_period', parseInt(lessonPeriod));

    if (error) {
        toast.error("خطا در بارگذاری سوابق حضور و غیاب قبلی: " + error.message);
    } else if (data && data.length > 0) {
      console.log("Found existing attendance records:", data);
      setAttendanceStatus(prevStatus => {
          const updatedStatus = { ...prevStatus };
          data.forEach(record => {
              if (updatedStatus[record.student_id]) {
                  updatedStatus[record.student_id] = {
                      status: record.status,
                      justified: record.is_justified
                  };
              } else {
                  console.warn(`Attendance record found for non-existent student ID: ${record.student_id}`);
              }
          });
          console.log("Status updated with fetched records:", updatedStatus);
          return updatedStatus;
       });
    } else {
         console.log("No existing attendance records found for this slot.");
         setAttendanceStatus(prevStatus => {
             const resetStatus: Record<string, { status: string; justified: boolean | null }> = {};
             students.forEach(student => {
                 resetStatus[student.id] = { status: 'present', justified: null };
             });
             console.log("Resetting status to default (present/null) because no records found:", resetStatus);
             return resetStatus;
         });
     }
  };

  const fetchDisciplineRecords = async (classId: string) => {
     setLoadingDiscipline(true);
    const { data, error } = await supabase
        .from('discipline_records')
        .select('*, students(full_name)')
        .eq('class_id', classId)
        .order('created_at', { ascending: false });

    if (error) toast.error("خطا در بارگذاری موارد انضباطی");
    else setDisciplineRecords(data as DisciplineRecord[] || []);
     setLoadingDiscipline(false);
  };


  const handleAttendanceSubmit = async () => {
    if (!selectedClassSubjectId || !date || !lessonPeriod || Object.keys(attendanceStatus).length === 0 || !user || !selectedClass) {
      toast.error('لطفاً کلاس، تاریخ، ساعت درسی و وضعیت دانش‌آموزان را مشخص کنید و مطمئن شوید وارد شده‌اید.');
      return;
    }
    const missingStatus = students.some(student => !attendanceStatus[student.id]);
    if (missingStatus) {
        toast.error('خطای داخلی: وضعیت برای همه دانش‌آموزان مقداردهی نشده است.');
        console.error("Incomplete attendanceStatus state:", attendanceStatus, students);
        return;
    }

    setIsSubmittingAttendance(true);
    const formattedDate = format(date, 'yyyy-MM-dd');

    const recordsToUpsert = Object.entries(attendanceStatus).map(([studentId, { status, justified }]) => ({
      student_id: studentId,
      class_id: selectedClass.id,
      class_subject_id: selectedClassSubjectId,
      status,
      is_justified: status === 'absent' ? justified : null,
      date: formattedDate,
      lesson_period: parseInt(lessonPeriod),
      recorded_by: user.id,
    }));

    console.log("Upserting attendance records:", recordsToUpsert);

    const { error } = await supabase
      .from('attendance')
      .upsert(recordsToUpsert, {
        onConflict: 'student_id, class_subject_id, date, lesson_period',
      });


    if (error) {
        console.error("Upsert Error:", error);
        if (error.message.includes('check constraint') && error.message.includes('check_justified_status')) {
             toast.error('خطا: نقض محدودیت پایگاه داده (is_justified باید برای حاضر/تاخیر NULL باشد).');
        }
        else if (error.message.includes('violates foreign key constraint')) {
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

  // handleDiscipline functions remain the same
  const handleDisciplineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass || !selectedStudentId || !user) {
        toast.error("لطفا دانش‌آموز را انتخاب کنید و مطمئن شوید وارد شده‌اید.");
        return;
    }
    setLoadingDiscipline(true);
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
          recorded_by: user.id,
        });
        if (error) toast.error('خطا در ثبت مورد انضباطی');
        else toast.success('مورد انضباطی ثبت شد');
    }
    setDisciplineOpen(false);
    resetDisciplineForm();
    if (selectedClass) fetchDisciplineRecords(selectedClass.id); else setLoadingDiscipline(false);
  };
  const handleDeleteDiscipline = async (recordId: string) => {
    setLoadingDiscipline(true);
    const { error } = await supabase.from('discipline_records').delete().eq('id', recordId);
    if(error) toast.error("خطا در حذف مورد انضباطی");
    else toast.success("مورد انضباطی حذف شد.");
    if (selectedClass) fetchDisciplineRecords(selectedClass.id); else setLoadingDiscipline(false);
  };
  const openDisciplineDialog = (record: DisciplineRecord | null) => {
    setEditingDiscipline(record);
    if (record && students.length > 0) {
      const student = students.find(s => s.full_name === record.students.full_name);
      setSelectedStudentId(student?.id);
      setDisciplineDesc(record.description);
      setSeverity(record.severity);
    } else {
        resetDisciplineForm();
    }
    setDisciplineOpen(true);
  };
  const resetDisciplineForm = () => {
    setEditingDiscipline(null); setSelectedStudentId(undefined); setDisciplineDesc(''); setSeverity('low');
  };

  // getStatusBadge remains the same
  const getStatusBadge = (studentId: string) => {
       const attendance = attendanceStatus[studentId];
       if (!attendance) return <Badge variant="outline">نامشخص</Badge>;
       const status = attendance.status;
       const isJustified = attendance.justified;
       if (status === 'absent' && isJustified === true) return <Badge className="bg-blue-500 hover:bg-blue-600">موجه</Badge>;
       switch (status) {
         case 'present': return <Badge className="bg-green-500 hover:bg-green-600">حاضر</Badge>;
         case 'absent': return <Badge variant="destructive">غایب</Badge>;
         case 'late': return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-black">تأخیر</Badge>;
         default: return <Badge variant="outline">{status}</Badge>;
       }
   };

  // getSeverityBadge remains the same
  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'low': return <Badge className="bg-green-500 hover:bg-green-600">کم</Badge>;
      case 'medium': return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-black">متوسط</Badge>;
      case 'high': return <Badge variant="destructive">شدید</Badge>;
      default: return <Badge variant="outline">{severity}</Badge>;
    }
  };

  // safeFormatDate remains the same
  const safeFormatDate = (dateString: string | null | undefined, inputFormat?: string): string => {
        if (!dateString) return '-';
        try {
            let dateObj: Date | null = null;
            dateObj = parseISO(dateString);
            if (isValid(dateObj)) return format(dateObj, 'yyyy/MM/dd');
            if (inputFormat) {
                dateObj = parse(dateString, inputFormat, new Date());
                if (isValid(dateObj)) return format(dateObj, 'yyyy/MM/dd');
            }
            dateObj = new Date(dateString.replace(/-/g, '/'));
            if (isValid(dateObj)) {
                console.warn("Used fallback date parsing for:", dateString);
                return format(dateObj, 'yyyy/MM/dd');
            }
            console.error("Invalid date encountered after all parsing attempts:", dateString);
            return 'تاریخ نامعتبر';
        } catch (error) {
            console.error("Error formatting date:", dateString, error);
            return 'خطا در تاریخ';
        }
   };


  // updateStudentAttendance remains the same
    const updateStudentAttendance = (studentId: string, newStatus: string) => {
        setAttendanceStatus(prev => {
            const current = prev[studentId];
            return {
                ...prev,
                [studentId]: {
                    status: newStatus,
                    justified: newStatus === 'absent' ? (current?.status === 'absent' ? current.justified : false) : null
                }
            };
        });
    };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center"><School className="w-6 h-6 text-primary-foreground" /></div>
            <div>
              {/* --- MODIFICATION: Display Teacher Name --- */}
              <h1 className="text-2xl font-bold">پنل معلم(هنرستان فنی و حرفه ای آل محمد ص)</h1>
              {teacherFullName ? (
                <p className="text-sm text-muted-foreground">خوش آمدید، {teacherFullName}</p>
              ) : (
                <p className="text-sm text-muted-foreground">ثبت حضور و غیاب و موارد انضباطی</p>
              )}
              {/* --- END MODIFICATION --- */}
            </div>
          </div>
          <Button onClick={signOut} variant="outline" className="gap-2"><LogOut className="w-4 h-4" />خروج</Button>
        </div>
      </header>

      {/* Rest of the component remains the same... */}
      <main className="container mx-auto px-4 py-8 space-y-6" dir="rtl">
        {/* Class/Date/Period Selection Card */}
        <Card>
          <CardHeader><CardTitle>انتخاب کلاس، تاریخ و ساعت</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Class/Subject Select */}
            <Select
              value={selectedClassSubjectId}
              onValueChange={(value) => {
                  setSelectedClassSubjectId(value);
                  setAttendanceStatus({});
                  setStudents([]);
              }}
              disabled={loadingClassSubjects}
            >
              <SelectTrigger>
                  <SelectValue placeholder={loadingClassSubjects ? "در حال بارگذاری..." : "انتخاب کلاس..."} />
              </SelectTrigger>
              <SelectContent>{classSubjects.map((cs) => (<SelectItem key={cs.id} value={cs.id}>{`${cs.classes.name} - ${cs.subjects.name}`}</SelectItem>))}</SelectContent>
            </Select>
            {/* Date Picker */}
             <Popover>
                <PopoverTrigger asChild>
                    <Button variant={"outline"} className={cn("w-full justify-start text-right font-normal", !date && "text-muted-foreground")}>
                        <CalendarIcon className="ml-2 h-4 w-4" />
                        {date ? format(date, "PPP") : <span>انتخاب تاریخ</span>}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={date} onSelect={setDate} initialFocus /></PopoverContent>
            </Popover>
            {/* Lesson Period Select */}
            <Select value={lessonPeriod} onValueChange={setLessonPeriod}>
              <SelectTrigger><SelectValue placeholder="انتخاب ساعت درسی..." /></SelectTrigger>
              <SelectContent>
                {[...Array(4)].map((_, i) => (<SelectItem key={i + 1} value={String(i + 1)}>{`ساعت ${i + 1}`}</SelectItem>))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Attendance Card */}
        {selectedClassSubjectId && date && lessonPeriod && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div><CardTitle>ثبت حضور و غیاب</CardTitle><CardDescription>وضعیت هر دانش‌آموز را مشخص کنید (پیش‌فرض: حاضر)</CardDescription></div>
                 <AlertDialog>
                   <AlertDialogTrigger asChild>
                      <Button disabled={isSubmittingAttendance || loadingStudentsAndAttendance || students.length === 0}>
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
                    <span className="ml-2">در حال بارگذاری دانش‌آموزان و وضعیت...</span>
                </div>
             ) : students.length === 0 ? (
                 <p className="text-muted-foreground text-center py-4">دانش‌آموزی برای این کلاس یافت نشد.</p>
             ) : (
              <Table>
                <TableHeader><TableRow><TableHead className="text-right">نام دانش‌آموز</TableHead><TableHead className="text-right w-[240px]">وضعیت</TableHead></TableRow></TableHeader>
                <TableBody>
                  {students.map((student) => {
                    const studentAttendance = attendanceStatus[student.id];
                    const currentStatus = studentAttendance?.status || 'present';
                    return (
                        <TableRow key={student.id}>
                          <TableCell>{student.full_name}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button size="sm" variant={currentStatus === 'present' ? 'default' : 'outline'} onClick={() => updateStudentAttendance(student.id, 'present')} className="gap-1 flex-1"><CheckCircle className="w-4 h-4" />حاضر</Button>
                              <Button size="sm" variant={currentStatus === 'absent' ? 'destructive' : 'outline'} onClick={() => updateStudentAttendance(student.id, 'absent')} className="gap-1 flex-1"><XCircle className="w-4 h-4" />غایب</Button>
                              <Button size="sm" variant={currentStatus === 'late' ? 'secondary' : 'outline'} onClick={() => updateStudentAttendance(student.id, 'late')} className="gap-1 flex-1"><Clock className="w-4 h-4" />تأخیر</Button>
                            </div>
                          </TableCell>
                        </TableRow>
                    );
                   })}
                </TableBody>
              </Table>
             )}
            </CardContent>
          </Card>
        )}

        {/* Discipline Card */}
        {selectedClass && (
          <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                    <div><CardTitle>موارد انضباطی</CardTitle><CardDescription>موارد انضباطی ثبت شده برای کلاس {selectedClass.name}</CardDescription></div>
                    <Dialog open={disciplineOpen} onOpenChange={(isOpen) => { setDisciplineOpen(isOpen); if (!isOpen) resetDisciplineForm(); }}>
                      <DialogTrigger asChild><Button variant="outline" className="gap-2" disabled={loadingStudentsAndAttendance || students.length === 0}><Plus className="w-4 h-4" />ثبت مورد جدید</Button></DialogTrigger>
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
                                  <TableCell>{safeFormatDate(rec.created_at)}</TableCell>
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

