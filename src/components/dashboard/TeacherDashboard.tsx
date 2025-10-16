import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { format } from 'date-fns-jalali';
import { faIR } from 'date-fns/locale';
import { LogOut, School, CheckCircle, XCircle, Clock, AlertTriangle, Calendar as CalendarIcon, Pencil, Trash2, Plus } from 'lucide-react';

// Interfaces
interface ClassSubject {
  id: string;
  classes: { id: string, name: string, grade: string } | null;
  subjects: { id: string, name: string } | null;
}
interface Student { id: string; full_name: string; }
interface AttendanceRecord { student_id: string; status: string; }
interface DisciplineRecord {
  id: string;
  student_id: string;
  description: string;
  severity: string;
  created_at: string;
  students: { full_name: string } | null;
}

const TeacherDashboard = () => {
  const { signOut, user } = useAuth();
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([]);
  const [selectedClassSubject, setSelectedClassSubject] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [disciplineRecords, setDisciplineRecords] = useState<DisciplineRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [lessonPeriod, setLessonPeriod] = useState<number>(1);

  // States for Discipline Dialog
  const [disciplineOpen, setDisciplineOpen] = useState(false);
  const [editingDiscipline, setEditingDiscipline] = useState<DisciplineRecord | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [disciplineDesc, setDisciplineDesc] = useState('');
  const [severity, setSeverity] = useState('low');
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) fetchTeacherClassSubjects();
  }, [user]);

  useEffect(() => {
    if (selectedClassSubject) {
      const cs = classSubjects.find(c => c.id === selectedClassSubject);
      if (cs?.classes?.id) {
        fetchClassStudents(cs.classes.id);
        fetchDisciplineRecords(cs.id);
        fetchAttendanceForDate();
      }
    } else {
      setStudents([]);
      setDisciplineRecords([]);
      setAttendance({});
    }
  }, [selectedClassSubject, selectedDate, lessonPeriod]);

  const fetchTeacherClassSubjects = async () => {
    if (!user) return;
    const { data: teacherData } = await supabase.from('teachers').select('id').eq('profile_id', user.id).single();
    if (teacherData) {
      const { data, error } = await supabase
        .from('class_subjects')
        .select('id, classes(id, name, grade), subjects(id, name)')
        .eq('teacher_id', teacherData.id);
      if (error) toast.error('خطا در واکشی کلاس‌ها.');
      else setClassSubjects(data || []);
    }
  };

  const fetchClassStudents = async (classId: string) => {
    const { data, error } = await supabase.from('students').select('id, full_name').eq('class_id', classId);
    if (error) toast.error('خطا در واکشی دانش‌آموزان.');
    else setStudents(data || []);
  };

  const fetchAttendanceForDate = async () => {
    if (!selectedClassSubject) return;
    const { data, error } = await supabase.from('attendance')
      .select('student_id, status')
      .eq('class_subject_id', selectedClassSubject)
      .eq('date', format(selectedDate, 'yyyy-MM-dd'))
      .eq('lesson_period', lessonPeriod);
    
    if (error) {
      toast.error('خطا در واکشی حضور و غیاب قبلی');
    } else {
      const attendanceMap = data.reduce((acc, record) => {
        acc[record.student_id] = record.status;
        return acc;
      }, {} as Record<string, string>);
      setAttendance(attendanceMap);
    }
  };
  
  const fetchDisciplineRecords = async (classSubjectId: string) => {
    const { data, error } = await supabase.from('discipline_records')
      .select('*, students(full_name)')
      .eq('class_subject_id', classSubjectId)
      .order('created_at', { ascending: false });
    if (error) toast.error('خطا در واکشی موارد انضباطی');
    else setDisciplineRecords(data || []);
  };
  
  const handleAttendanceSubmit = async () => {
    if (!selectedClassSubject || students.length === 0) return;
    
    setIsSubmitting(true);
    const date = format(selectedDate, 'yyyy-MM-dd');
    const recordsToUpsert = students.map(student => ({
      student_id: student.id,
      class_subject_id: selectedClassSubject,
      date,
      lesson_period: lessonPeriod,
      status: attendance[student.id] || 'present', // Default to present if not set
      recorded_by: user?.id,
    }));
    
    // Delete existing records for this specific class/date/period first
    const { error: deleteError } = await supabase.from('attendance')
        .delete()
        .eq('class_subject_id', selectedClassSubject)
        .eq('date', date)
        .eq('lesson_period', lessonPeriod);

    if (deleteError) {
        toast.error('خطا در به‌روزرسانی حضور و غیاب: ' + deleteError.message);
        setIsSubmitting(false);
        return;
    }

    const { error: insertError } = await supabase.from('attendance').insert(recordsToUpsert);

    if (insertError) toast.error('خطا در ثبت حضور و غیاب: ' + insertError.message);
    else toast.success('حضور و غیاب با موفقیت ثبت/به‌روزرسانی شد.');
    setIsSubmitting(false);
  };
  
  const openDisciplineDialog = (record: DisciplineRecord | null = null) => {
    if (record) {
      setEditingDiscipline(record);
      setSelectedStudentId(record.student_id);
      setDisciplineDesc(record.description);
      setSeverity(record.severity);
    } else {
      setEditingDiscipline(null);
      setSelectedStudentId('');
      setDisciplineDesc('');
      setSeverity('low');
    }
    setDisciplineOpen(true);
  };
  
  const handleDisciplineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) {
        toast.error("لطفا دانش آموز را انتخاب کنید.");
        return;
    }
    const data = {
      student_id: selectedStudentId,
      class_subject_id: selectedClassSubject,
      description: disciplineDesc,
      severity,
      recorded_by: user?.id,
    };
    
    const promise = editingDiscipline
      ? supabase.from('discipline_records').update(data).eq('id', editingDiscipline.id)
      : supabase.from('discipline_records').insert(data);
      
    toast.promise(promise, {
      loading: 'در حال ثبت...',
      success: () => {
        setDisciplineOpen(false);
        fetchDisciplineRecords(selectedClassSubject);
        return `مورد انضباطی با موفقیت ${editingDiscipline ? 'ویرایش' : 'ثبت'} شد.`;
      },
      error: (err) => `خطا: ${err.message}`,
    });
  };
  
  const handleDeleteDiscipline = async (recordId: string) => {
    const { error } = await supabase.from('discipline_records').delete().eq('id', recordId);
    if (error) toast.error('خطا در حذف مورد انضباطی');
    else {
      toast.success('مورد انضباطی حذف شد.');
      setDisciplineRecords(records => records.filter(r => r.id !== recordId));
    }
  };
  
  const selectedClassInfo = useMemo(() => {
    return classSubjects.find(cs => cs.id === selectedClassSubject);
  }, [classSubjects, selectedClassSubject]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center"><School className="w-6 h-6 text-primary-foreground" /></div>
                <div>
                    <h1 className="text-2xl font-bold">پنل معلم</h1>
                    <p className="text-sm text-muted-foreground">ثبت حضور و غیاب و موارد انضباطی</p>
                </div>
            </div>
            <Button onClick={signOut} variant="outline" className="gap-2"><LogOut className="w-4 h-4" />خروج</Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6" dir="rtl">
        <Card>
          <CardHeader>
            <CardTitle>انتخاب کلاس و تاریخ</CardTitle>
            <CardDescription>کلاس-درس، تاریخ و ساعت مورد نظر را برای مدیریت انتخاب کنید</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select value={selectedClassSubject} onValueChange={setSelectedClassSubject}>
              <SelectTrigger><SelectValue placeholder="انتخاب کلاس-درس" /></SelectTrigger>
              <SelectContent>{classSubjects.map((cs) => (<SelectItem key={cs.id} value={cs.id}>{cs.classes?.name} - {cs.subjects?.name}</SelectItem>))}</SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}>
                  <CalendarIcon className="ml-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, 'PPP', { locale: faIR }) : <span>انتخاب تاریخ</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} initialFocus locale={faIR} /></PopoverContent>
            </Popover>
             <Select value={String(lessonPeriod)} onValueChange={(v) => setLessonPeriod(Number(v))}>
                <SelectTrigger><SelectValue placeholder="انتخاب ساعت درسی" /></SelectTrigger>
                <SelectContent>
                    {[1, 2, 3, 4].map(p => <SelectItem key={p} value={String(p)}>زنگ {p}</SelectItem>)}
                </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {selectedClassSubject && (
          <>
            <Card>
              <CardHeader>
                  <div className="flex items-center justify-between">
                      <div>
                          <CardTitle>ثبت حضور و غیاب</CardTitle>
                          <CardDescription>وضعیت دانش‌آموزان برای <span className="font-bold">{selectedClassInfo?.classes?.name} - {selectedClassInfo?.subjects?.name}</span> در تاریخ <span className="font-bold">{format(selectedDate, 'yyyy/MM/dd', { locale: faIR })}</span> - زنگ {lessonPeriod}</CardDescription>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                           <Button disabled={isSubmitting}>{isSubmitting ? "در حال ثبت..." : "ثبت نهایی حضور و غیاب"}</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent dir='rtl'>
                          <AlertDialogHeader>
                            <AlertDialogTitle>آیا از ثبت نهایی مطمئن هستید؟</AlertDialogTitle>
                            <AlertDialogDescription>این عمل، رکوردهای حضور و غیاب قبلی برای این کلاس، تاریخ و ساعت را بازنویسی خواهد کرد.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>انصراف</AlertDialogCancel>
                            <AlertDialogAction onClick={handleAttendanceSubmit}>تایید و ثبت</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                  </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead className="text-right">نام دانش‌آموز</TableHead><TableHead className="text-right">وضعیت</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {students.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell>{student.full_name}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant={attendance[student.id] === 'present' || !attendance[student.id] ? 'default' : 'outline'} onClick={() => setAttendance(prev => ({ ...prev, [student.id]: 'present' }))} className="gap-1"><CheckCircle className="w-4 h-4" />حاضر</Button>
                            <Button size="sm" variant={attendance[student.id] === 'absent' ? 'destructive' : 'outline'} onClick={() => setAttendance(prev => ({ ...prev, [student.id]: 'absent' }))} className="gap-1"><XCircle className="w-4 h-4" />غایب</Button>
                            <Button size="sm" variant={attendance[student.id] === 'late' ? 'secondary' : 'outline'} onClick={() => setAttendance(prev => ({ ...prev, [student.id]: 'late' }))} className="gap-1"><Clock className="w-4 h-4" />تأخیر</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>موارد انضباطی</CardTitle>
                        <CardDescription>موارد ثبت شده برای این کلاس-درس</CardDescription>
                    </div>
                    <Dialog open={disciplineOpen} onOpenChange={setDisciplineOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="gap-2" onClick={() => openDisciplineDialog()}>
                                <Plus className="w-4 h-4" />
                                ثبت مورد انضباطی جدید
                            </Button>
                        </DialogTrigger>
                        <DialogContent dir="rtl">
                            <DialogHeader>
                              <DialogTitle>{editingDiscipline ? 'ویرایش' : 'ثبت'} مورد انضباطی</DialogTitle>
                              <DialogDescription>اطلاعات مورد انضباطی را در فرم زیر وارد کنید.</DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleDisciplineSubmit} className="space-y-4 pt-4">
                                <div className="space-y-2"><Label>دانش‌آموز</Label><Select value={selectedStudentId} onValueChange={setSelectedStudentId}><SelectTrigger><SelectValue placeholder="انتخاب دانش‌آموز" /></SelectTrigger><SelectContent>{students.map((s) => (<SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>))}</SelectContent></Select></div>
                                <div className="space-y-2"><Label>شرح</Label><Textarea value={disciplineDesc} onChange={(e) => setDisciplineDesc(e.target.value)} required /></div>
                                <div className="space-y-2"><Label>شدت</Label><Select value={severity} onValueChange={setSeverity}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">کم</SelectItem><SelectItem value="medium">متوسط</SelectItem><SelectItem value="high">شدید</SelectItem></SelectContent></Select></div>
                                <DialogFooter><DialogClose asChild><Button type="button" variant="ghost">انصراف</Button></DialogClose><Button type="submit">{editingDiscipline ? 'ویرایش' : 'ثبت'}</Button></DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                  </div>
              </CardHeader>
              <CardContent>
                  <Table>
                      <TableHeader><TableRow><TableHead className="text-right">دانش‌آموز</TableHead><TableHead className="text-right">شرح</TableHead><TableHead className="text-right">شدت</TableHead><TableHead className="text-right">تاریخ</TableHead><TableHead className="text-right">عملیات</TableHead></TableRow></TableHeader>
                      <TableBody>
                          {disciplineRecords.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center h-24">موردی ثبت نشده است.</TableCell></TableRow> :
                           disciplineRecords.map(rec => (
                              <TableRow key={rec.id}>
                                  <TableCell>{rec.students?.full_name || 'نامشخص'}</TableCell>
                                  <TableCell>{rec.description}</TableCell>
                                  <TableCell>{rec.severity}</TableCell>
                                  <TableCell>{format(new Date(rec.created_at), 'yyyy/MM/dd', { locale: faIR })}</TableCell>
                                  <TableCell className="flex gap-2">
                                      <Button variant="outline" size="icon" onClick={() => openDisciplineDialog(rec)}><Pencil className="w-4 h-4" /></Button>
                                      <AlertDialog>
                                          <AlertDialogTrigger asChild><Button variant="destructive" size="icon"><Trash2 className="w-4 h-4" /></Button></AlertDialogTrigger>
                                          <AlertDialogContent dir="rtl">
                                              <AlertDialogHeader><AlertDialogTitle>آیا از حذف مطمئن هستید؟</AlertDialogTitle><AlertDialogDescription>این عمل قابل بازگشت نیست.</AlertDialogDescription></AlertDialogHeader>
                                              <AlertDialogFooter><AlertDialogCancel>انصراف</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteDiscipline(rec.id)}>حذف</AlertDialogAction></AlertDialogFooter>
                                          </AlertDialogContent>
                                      </AlertDialog>
                                  </TableCell>
                              </TableRow>
                           ))}
                      </TableBody>
                  </Table>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
};

export default TeacherDashboard;

