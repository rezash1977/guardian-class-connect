import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { LogOut, User, Upload, Eye } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


interface Student {
  id: string;
  full_name: string;
}

interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
  lesson_period: number;
  absence_justified: boolean;
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
}

const ParentDashboard = () => {
  const { signOut, user } = useAuth();
  const [children, setChildren] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [discipline, setDiscipline] = useState<DisciplineRecord[]>([]);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File | null>>({});
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchChildren();
  }, [user]);

  useEffect(() => {
    if (selectedChildId) {
      fetchAttendance();
      fetchDiscipline();
    }
  }, [selectedChildId]);

  const fetchChildren = async () => {
    const { data } = await supabase.from('students').select('id, full_name').eq('parent_id', user?.id);
    setChildren(data || []);
    if (data && data.length > 0) setSelectedChildId(data[0].id);
  };

  const fetchAttendance = async () => {
    const { data, error } = await supabase
      .from('attendance')
      .select('id, date, status, lesson_period, absence_justified, medical_certificate_url, class_subjects(subjects(name))')
      .eq('student_id', selectedChildId)
      .order('date', { ascending: false })
      .limit(50);
    if (error) toast.error("خطا در دریافت اطلاعات حضور و غیاب");
    else setAttendance(data as AttendanceRecord[] || []);
  };

  const fetchDiscipline = async () => {
    const { data, error } = await supabase.from('discipline_records').select('*').eq('student_id', selectedChildId).order('created_at', { ascending: false });
    if (error) toast.error("خطا در دریافت اطلاعات انضباطی");
    else setDiscipline(data as DisciplineRecord[] || []);
  };

  const handleFileChange = (attendanceId: string, file: File | null) => {
    setSelectedFiles(prev => ({ ...prev, [attendanceId]: file }));
  };

  const handleFileUpload = async (attendanceId: string) => {
    const file = selectedFiles[attendanceId];
    if (!file) {
      toast.error('لطفاً یک فایل انتخاب کنید.');
      return;
    }

    setUploading(attendanceId);
    const fileExt = file.name.split('.').pop();
    const filePath = `medical_certificates/${selectedChildId}/${attendanceId}_${new Date().getTime()}.${fileExt}`;

    try {
      const { error: uploadError } = await supabase.storage.from('medical_certificates').upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('medical_certificates').getPublicUrl(filePath);

      const { error: updateError } = await supabase.from('attendance').update({ medical_certificate_url: publicUrl, absence_justified: true }).eq('id', attendanceId);
      if (updateError) throw updateError;
      
      toast.success('گواهی پزشکی با موفقیت بارگذاری شد.');
      fetchAttendance(); 
    } catch (error: any) {
      toast.error(`خطا در بارگذاری فایل: ${error.message}`);
    } finally {
      setUploading(null);
      setSelectedFiles(prev => ({ ...prev, [attendanceId]: null }));
    }
  };

  const getStatusBadge = (record: AttendanceRecord) => {
    if (record.status === 'absent' && record.absence_justified) return <Badge className="bg-blue-500">موجه</Badge>;
    switch (record.status) {
      case 'present': return <Badge className="bg-green-500">حاضر</Badge>;
      case 'absent': return <Badge variant="destructive">غایب</Badge>;
      case 'late': return <Badge className="bg-yellow-500 text-black">تأخیر</Badge>;
      default: return <Badge variant="outline">{record.status}</Badge>;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'low': return <Badge className="bg-green-500">کم</Badge>;
      case 'medium': return <Badge className="bg-yellow-500 text-black">متوسط</Badge>;
      case 'high': return <Badge variant="destructive">شدید</Badge>;
      default: return <Badge variant="outline">{severity}</Badge>;
    }
  };

  const selectedChildName = children.find(c => c.id === selectedChildId)?.full_name || '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3"><div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center"><User className="w-6 h-6 text-primary-foreground" /></div><div><h1 className="text-2xl font-bold">پنل اولیا</h1><p className="text-sm text-muted-foreground">مشاهده وضعیت فرزند</p></div></div>
          {children.length > 1 && (
            <Select value={selectedChildId} onValueChange={setSelectedChildId}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="انتخاب فرزند" /></SelectTrigger>
                <SelectContent>{children.map(child => <SelectItem key={child.id} value={child.id}>{child.full_name}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <Button onClick={signOut} variant="outline" className="gap-2"><LogOut className="w-4 h-4" />خروج</Button>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8 space-y-6" dir="rtl">
        {!selectedChildId ? <Card><CardContent className="py-12 text-center text-muted-foreground">هیچ فرزندی برای شما ثبت نشده است.</CardContent></Card> : (
          <>
            <Card>
              <CardHeader><CardTitle>حضور و غیاب</CardTitle><CardDescription>وضعیت حضور و غیاب {selectedChildName}</CardDescription></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>تاریخ</TableHead><TableHead>درس</TableHead><TableHead>زنگ</TableHead><TableHead>وضعیت</TableHead><TableHead>اقدامات</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {attendance.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>{new Date(record.date).toLocaleDateString('fa-IR')}</TableCell>
                        <TableCell>{record.class_subjects?.subjects.name || '-'}</TableCell>
                        <TableCell>{record.lesson_period}</TableCell>
                        <TableCell>{getStatusBadge(record)}</TableCell>
                        <TableCell>
                          {record.status === 'absent' && !record.absence_justified && (
                            <div className="flex items-center gap-2">
                              <Input type="file" className="max-w-xs h-9" onChange={(e) => handleFileChange(record.id, e.target.files ? e.target.files[0] : null)} />
                              <Button size="sm" onClick={() => handleFileUpload(record.id)} disabled={!selectedFiles[record.id] || uploading === record.id}>{uploading === record.id ? '...' : <Upload className="w-4 h-4"/>}</Button>
                            </div>
                          )}
                          {record.medical_certificate_url && (<Button asChild variant="link" size="sm"><a href={record.medical_certificate_url} target="_blank" rel="noopener noreferrer" className="gap-1"><Eye className="w-4 h-4" />مشاهده گواهی</a></Button>)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>موارد انضباطی</CardTitle><CardDescription>موارد انضباطی ثبت شده برای {selectedChildName}</CardDescription></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>تاریخ</TableHead><TableHead>شرح</TableHead><TableHead>شدت</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {discipline.map((record) => (
                      <TableRow key={record.id}><TableCell>{new Date(record.created_at).toLocaleDateString('fa-IR')}</TableCell><TableCell>{record.description}</TableCell><TableCell>{getSeverityBadge(record.severity)}</TableCell></TableRow>
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

export default ParentDashboard;

