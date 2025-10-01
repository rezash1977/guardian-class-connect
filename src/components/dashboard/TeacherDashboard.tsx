import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { LogOut, School, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';

interface Class {
  id: string;
  name: string;
  grade: string;
}

interface Student {
  id: string;
  full_name: string;
}

const TeacherDashboard = () => {
  const { signOut, user } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceStatus, setAttendanceStatus] = useState<Record<string, string>>({});
  const [disciplineOpen, setDisciplineOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [disciplineDesc, setDisciplineDesc] = useState('');
  const [severity, setSeverity] = useState('low');

  useEffect(() => {
    fetchTeacherClasses();
  }, [user]);

  useEffect(() => {
    if (selectedClass) {
      fetchClassStudents();
    }
  }, [selectedClass]);

  const fetchTeacherClasses = async () => {
    if (!user) return;

    const { data: teacher } = await supabase
      .from('teachers')
      .select('id')
      .eq('profile_id', user.id)
      .single();

    if (teacher) {
      const { data } = await supabase
        .from('classes')
        .select('id, name, grade')
        .eq('teacher_id', teacher.id);
      setClasses(data || []);
    }
  };

  const fetchClassStudents = async () => {
    const { data } = await supabase
      .from('students')
      .select('id, full_name')
      .eq('class_id', selectedClass);
    setStudents(data || []);
  };

  const handleAttendanceSubmit = async () => {
    if (!selectedClass || Object.keys(attendanceStatus).length === 0) {
      toast.error('لطفاً وضعیت دانش‌آموزان را مشخص کنید');
      return;
    }

    const records = Object.entries(attendanceStatus).map(([studentId, status]) => ({
      student_id: studentId,
      class_id: selectedClass,
      status,
      recorded_by: user?.id,
    }));

    const { error } = await supabase.from('attendance').insert(records);

    if (error) {
      toast.error('خطا در ثبت حضور و غیاب');
    } else {
      toast.success('حضور و غیاب ثبت شد');
      setAttendanceStatus({});
    }
  };

  const handleDisciplineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await supabase.from('discipline_records').insert({
      student_id: selectedStudent,
      class_id: selectedClass,
      description: disciplineDesc,
      severity,
      recorded_by: user?.id,
    });

    if (error) {
      toast.error('خطا در ثبت مورد انضباطی');
    } else {
      toast.success('مورد انضباطی ثبت شد');
      setDisciplineOpen(false);
      setDisciplineDesc('');
      setSeverity('low');
      setSelectedStudent('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center">
              <School className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">پنل معلم</h1>
              <p className="text-sm text-muted-foreground">ثبت حضور و غیاب</p>
            </div>
          </div>
          <Button onClick={signOut} variant="outline" className="gap-2">
            <LogOut className="w-4 h-4" />
            خروج
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6" dir="rtl">
        <Card>
          <CardHeader>
            <CardTitle>انتخاب کلاس</CardTitle>
            <CardDescription>کلاس مورد نظر را برای ثبت حضور و غیاب انتخاب کنید</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger>
                <SelectValue placeholder="انتخاب کلاس" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.name} - {cls.grade}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {selectedClass && (
          <>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>ثبت حضور و غیاب</CardTitle>
                    <CardDescription>وضعیت هر دانش‌آموز را مشخص کنید</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Dialog open={disciplineOpen} onOpenChange={setDisciplineOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="gap-2">
                          <AlertTriangle className="w-4 h-4" />
                          ثبت مورد انضباطی
                        </Button>
                      </DialogTrigger>
                      <DialogContent dir="rtl">
                        <DialogHeader>
                          <DialogTitle>ثبت مورد انضباطی</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleDisciplineSubmit} className="space-y-4">
                          <div className="space-y-2">
                            <Label>دانش‌آموز</Label>
                            <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                              <SelectTrigger>
                                <SelectValue placeholder="انتخاب دانش‌آموز" />
                              </SelectTrigger>
                              <SelectContent>
                                {students.map((student) => (
                                  <SelectItem key={student.id} value={student.id}>
                                    {student.full_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>شرح</Label>
                            <Textarea value={disciplineDesc} onChange={(e) => setDisciplineDesc(e.target.value)} required />
                          </div>
                          <div className="space-y-2">
                            <Label>شدت</Label>
                            <Select value={severity} onValueChange={setSeverity}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="low">کم</SelectItem>
                                <SelectItem value="medium">متوسط</SelectItem>
                                <SelectItem value="high">شدید</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <Button type="submit" className="w-full">ثبت</Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                    <Button onClick={handleAttendanceSubmit} disabled={Object.keys(attendanceStatus).length === 0}>
                      ثبت حضور و غیاب
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">نام دانش‌آموز</TableHead>
                      <TableHead className="text-right">وضعیت</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell>{student.full_name}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant={attendanceStatus[student.id] === 'present' ? 'default' : 'outline'}
                              onClick={() => setAttendanceStatus({ ...attendanceStatus, [student.id]: 'present' })}
                              className="gap-1"
                            >
                              <CheckCircle className="w-4 h-4" />
                              حاضر
                            </Button>
                            <Button
                              size="sm"
                              variant={attendanceStatus[student.id] === 'absent' ? 'destructive' : 'outline'}
                              onClick={() => setAttendanceStatus({ ...attendanceStatus, [student.id]: 'absent' })}
                              className="gap-1"
                            >
                              <XCircle className="w-4 h-4" />
                              غایب
                            </Button>
                            <Button
                              size="sm"
                              variant={attendanceStatus[student.id] === 'late' ? 'secondary' : 'outline'}
                              onClick={() => setAttendanceStatus({ ...attendanceStatus, [student.id]: 'late' })}
                              className="gap-1"
                            >
                              <Clock className="w-4 h-4" />
                              تأخیر
                            </Button>
                          </div>
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
