import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea'; // Import Textarea for justification
import { toast } from 'sonner';
import { LogOut, User, Upload, Eye, Loader2 } from 'lucide-react';
import { format } from "date-fns-jalali";

// Interface definitions reflecting the provided schema
interface Student {
  id: string;
  full_name: string;
}

interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
  lesson_period: number;
  medical_note_url: string | null; // Correct column name
  is_justified: boolean | null;    // Added column
  justification: string | null;    // Added column
  class_subjects: {
    subjects: {
      name: string;
    } | null;
  } | null;
}

interface DisciplineRecord {
  id: string;
  description: string;
  severity: string;
  created_at: string;
  classes: {
      name: string;
  } | null;
}

const ParentDashboard = () => {
  const { signOut, user } = useAuth();
  const [children, setChildren] = useState<Student[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | undefined>();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [discipline, setDiscipline] = useState<DisciplineRecord[]>([]);
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [loadingDiscipline, setLoadingDiscipline] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [justificationText, setJustificationText] = useState(''); // State for justification text
  const [selectedAttendanceId, setSelectedAttendanceId] = useState<string | null>(null);

  const selectedChild = useMemo(() => {
    return children.find(c => c.id === selectedChildId);
  }, [children, selectedChildId]);

  useEffect(() => {
    if (user) {
      fetchChildren();
    } else {
      setLoadingChildren(false);
    }
  }, [user]);

  useEffect(() => {
    if (selectedChildId) {
      fetchAttendance();
      fetchDiscipline();
    } else {
      setAttendance([]);
      setDiscipline([]);
    }
  }, [selectedChildId]);

  const fetchChildren = async () => {
    setLoadingChildren(true);
    const { data, error } = await supabase
      .from('students')
      .select('id, full_name')
      .eq('parent_id', user?.id);

    if (error) {
        toast.error("خطا در بارگذاری اطلاعات فرزندان");
    } else {
        setChildren(data || []);
        if (data && data.length > 0 && !selectedChildId) {
          setSelectedChildId(data[0].id); // Select the first child by default
        }
    }
    setLoadingChildren(false);
  };

  const fetchAttendance = async () => {
    if (!selectedChildId) return;
    setLoadingAttendance(true);
    // *** FIX: Corrected SELECT query based on provided schema ***
    const { data, error } = await supabase
      .from('attendance')
      .select('id, date, status, lesson_period, medical_note_url, is_justified, justification, class_subjects(subjects(name))')
      .eq('student_id', selectedChildId)
      .order('date', { ascending: false })
      .order('lesson_period', { ascending: true })
      .limit(50);

    if (error) {
        console.error("Attendance fetch exception:", error);
        toast.error('خطا در بارگذاری حضور و غیاب: ' + error.message);
    } else {
        setAttendance(data || []);
    }
    setLoadingAttendance(false);
  };

  const fetchDiscipline = async () => {
    // This function seems correct based on previous contexts, assuming discipline links to classes
    if (!selectedChildId) return;
    setLoadingDiscipline(true);
    const { data, error } = await supabase
      .from('discipline_records')
      .select('id, description, severity, created_at, classes(name)')
      .eq('student_id', selectedChildId)
      .order('created_at', { ascending: false });

     if (error) {
        toast.error("خطا در بارگذاری موارد انضباطی: " + error.message);
    } else {
        setDiscipline(data || []);
    }
    setLoadingDiscipline(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    } else {
      setSelectedFile(null);
    }
  };

  const handleUploadCertificate = async () => {
    if (!selectedAttendanceId || !selectedChildId) return;
    if (!selectedFile && !justificationText.trim()) {
        toast.error("لطفاً یک فایل انتخاب کنید یا توضیحاتی برای توجیه غیبت بنویسید.");
        return;
    }

    setUploading(true);
    let fileUrl: string | null = null;
    let filePath: string | null = null;

    // --- Upload file if selected ---
    if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${selectedChildId}_${selectedAttendanceId}_${Date.now()}.${fileExt}`;
        filePath = `${selectedChildId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('picapsent') // Ensure this bucket exists and has correct policies
          .upload(filePath, selectedFile);

        if (uploadError) {
          toast.error('خطا در بارگذاری فایل: ' + uploadError.message);
          setUploading(false);
          return;
        }

        const { data: urlData } = supabase.storage
            .from('medical-certificates')
            .getPublicUrl(filePath);

        if (!urlData?.publicUrl) {
             toast.error("خطا در دریافت آدرس فایل بارگذاری شده.");
             setUploading(false);
             return;
        }
        fileUrl = urlData.publicUrl;
    }
    // --- End Upload file ---
// ✅ نسخه اصلاح‌شده ParentDashboard با باکت picapsent
// رفع خطا در دریافت لینک عمومی از باکت درست

const handleUploadCertificate = async () => {
  if (!selectedAttendanceId || !selectedChildId) return;
  if (!selectedFile && !justificationText.trim()) {
    toast.error("لطفاً یک فایل انتخاب کنید یا توضیحاتی برای توجیه غیبت بنویسید.");
    return;
  }

  setUploading(true);
  let fileUrl: string | null = null;
  let filePath: string | null = null;

  try {
    // --- Upload file if selected ---
    if (selectedFile) {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${selectedChildId}_${selectedAttendanceId}_${Date.now()}.${fileExt}`;
      filePath = `${selectedChildId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('picapsent') // ✅ باکت درست
        .upload(filePath, selectedFile);

      if (uploadError) {
        toast.error('خطا در بارگذاری فایل: ' + uploadError.message);
        setUploading(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('picapsent') // ✅ باکت درست
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        toast.error("خطا در دریافت آدرس فایل بارگذاری شده.");
        setUploading(false);
        return;
      }

      fileUrl = urlData.publicUrl; // ✅ لینک عمومی از باکت درست
    }

    // --- Update attendance record ---
    const { error: updateError } = await supabase
      .from('attendance')
      .update({
        medical_note_url: fileUrl,
        is_justified: true,
        justification: justificationText.trim() || null
      })
      .eq('id', selectedAttendanceId);

    if (updateError) {
      toast.error('خطا در به‌روزرسانی وضعیت غیبت: ' + updateError.message);
      if (filePath) {
        await supabase.storage.from('picapsent').remove([filePath]); // ✅ حذف از باکت درست
      }
    } else {
      toast.success('غیبت با موفقیت توجیه شد.');
      setSelectedFile(null);
      setJustificationText('');
      setSelectedAttendanceId(null);
      fetchAttendance(); // Refresh attendance data
    }
  } catch (error) {
    console.error('Upload exception:', error);
    toast.error('خطای غیرمنتظره در بارگذاری فایل');
  } finally {
    setUploading(false);
  }
};


    // --- Update attendance record ---
    const { error: updateError } = await supabase
      .from('attendance')
      .update({
          medical_note_url: fileUrl, // Use correct column name
          is_justified: true,        // Set justification flag
          justification: justificationText.trim() || null // Add justification text
        })
      .eq('id', selectedAttendanceId);

    if (updateError) {
      toast.error('خطا در به‌روزرسانی وضعیت غیبت: ' + updateError.message);
      // Attempt to delete the uploaded file if DB update fails and a file was uploaded
      if (filePath) {
        await supabase.storage.from('medical-certificates').remove([filePath]);
      }
    } else {
      toast.success('غیبت با موفقیت توجیه شد.');
      // Reset state on success
      setSelectedFile(null);
      setJustificationText('');
      setSelectedAttendanceId(null);
      fetchAttendance(); // Refresh attendance data
    }

    setUploading(false);
     // Close the dialog manually if needed by controlling its open state
     // Find the DialogClose button/logic if you want to close it programmatically
  };

  // *** Updated getStatusBadge to consider is_justified ***
  const getStatusBadge = (status: string, isJustified: boolean | null) => {
    if (status === 'absent') {
        return isJustified
            ? <Badge className="bg-blue-500 hover:bg-blue-600">موجه</Badge>
            : <Badge variant="destructive">غایب</Badge>;
    }
    switch (status) {
      case 'present': return <Badge className="bg-green-500 hover:bg-green-600">حاضر</Badge>;
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

  // Helper function to reset dialog state
  const resetDialogState = () => {
      setSelectedFile(null);
      setJustificationText('');
      setSelectedAttendanceId(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        {/* Header remains largely the same */}
         <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center"><User className="w-6 h-6 text-primary-foreground" /></div>
            <div><h1 className="text-2xl font-bold">پنل اولیا</h1><p className="text-sm text-muted-foreground">مشاهده وضعیت فرزند</p></div>
          </div>
           {children.length > 1 && (
             <Select value={selectedChildId} onValueChange={setSelectedChildId}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="انتخاب فرزند..." /></SelectTrigger>
                <SelectContent>{children.map((child) => (<SelectItem key={child.id} value={child.id}>{child.full_name}</SelectItem>))}</SelectContent>
              </Select>
           )}
          <Button onClick={signOut} variant="outline" className="gap-2"><LogOut className="w-4 h-4" />خروج</Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6" dir="rtl">
        {loadingChildren ? (
            <div className="text-center py-12"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary"/></div>
        ) : children.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">هیچ فرزندی برای شما ثبت نشده است.</CardContent></Card>
        ) : !selectedChild ? (
           <Card><CardContent className="py-12 text-center text-muted-foreground">لطفاً یک فرزند را انتخاب کنید.</CardContent></Card>
        ) : (
          <>
            <Card>
              <CardHeader><CardTitle>حضور و غیاب</CardTitle><CardDescription>وضعیت حضور و غیاب {selectedChild.full_name}</CardDescription></CardHeader>
              <CardContent>
                {loadingAttendance ? <div className="text-center py-8"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary"/></div> : (
                  <Table>
                    {/* Added Justification Column */}
                    <TableHeader><TableRow><TableHead className="text-right">تاریخ</TableHead><TableHead className="text-right">ساعت</TableHead><TableHead className="text-right">درس</TableHead><TableHead className="text-right">وضعیت</TableHead><TableHead className="text-right">توجیه / گواهی</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {attendance.length === 0 ? (<TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">هیچ سابقه‌ای یافت نشد</TableCell></TableRow>) : ( // Adjusted colSpan
                        attendance.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell>{record.date ? format(new Date(record.date.replace(/-/g, '/')), 'yyyy/MM/dd') : ''}</TableCell>
                            <TableCell>{record.lesson_period}</TableCell>
                            <TableCell>{record.class_subjects?.subjects?.name || '-'}</TableCell>
                            <TableCell>{getStatusBadge(record.status, record.is_justified)}</TableCell>
                            <TableCell>
                              {/* Show upload button only if absent and NOT justified */}
                              {record.status === 'absent' && !record.is_justified && (
                                <Dialog onOpenChange={(open) => { if (!open) resetDialogState(); }}>
                                  <DialogTrigger asChild>
                                      <Button variant="outline" size="sm" className="gap-1" onClick={() => setSelectedAttendanceId(record.id)}>
                                          <Upload className="w-3 h-3"/>توجیه / بارگذاری
                                      </Button>
                                  </DialogTrigger>
                                  <DialogContent dir="rtl">
                                      <DialogHeader>
                                          <DialogTitle>توجیه غیبت</DialogTitle>
                                          <DialogDescription>
                                              برای غیبت {selectedChild.full_name} در تاریخ {record.date ? format(new Date(record.date.replace(/-/g, '/')), 'yyyy/MM/dd') : ''}،
                                              توضیحات خود را بنویسید یا فایل گواهی پزشکی را بارگذاری کنید (اختیاری).
                                          </DialogDescription>
                                      </DialogHeader>
                                      <div className="py-4 space-y-4">
                                           <div>
                                              <Label htmlFor="justification-text">توضیحات (اختیاری)</Label>
                                              <Textarea id="justification-text" value={justificationText} onChange={(e) => setJustificationText(e.target.value)} placeholder="مثال: بیماری، مراجعه به پزشک و..." />
                                           </div>
                                          <div>
                                              <Label htmlFor="certificate-upload">فایل گواهی (اختیاری)</Label>
                                              <Input id="certificate-upload" type="file" accept="image/*,.pdf" onChange={handleFileChange} />
                                          </div>
                                      </div>
                                      <DialogFooter>
                                          <DialogClose asChild><Button variant="ghost" onClick={resetDialogState}>انصراف</Button></DialogClose>
                                          <Button onClick={handleUploadCertificate} disabled={uploading}>
                                              {uploading && <Loader2 className="ml-2 h-4 w-4 animate-spin"/>}
                                              {uploading ? 'در حال ثبت...' : 'تایید و ثبت'}
                                          </Button>
                                      </DialogFooter>
                                  </DialogContent>
                                </Dialog>
                              )}
                              {/* Show justification text if justified */}
                              {record.is_justified && record.justification && (
                                <span className="text-sm text-muted-foreground italic">{record.justification}</span>
                              )}
                              {/* Show view button if justified and has URL */}
                              {record.is_justified && record.medical_note_url && (
                                <Button variant="link" size="sm" asChild className={`p-0 h-auto ${record.justification ? 'ml-2' : ''}`}>
                                  <a href={record.medical_note_url} target="_blank" rel="noopener noreferrer" className="gap-1">
                                    <Eye className="w-3 h-3" />مشاهده گواهی
                                  </a>
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Discipline Card remains the same */}
            <Card>
              <CardHeader><CardTitle>موارد انضباطی</CardTitle><CardDescription>موارد انضباطی ثبت شده برای {selectedChild.full_name}</CardDescription></CardHeader>
              <CardContent>
                 {loadingDiscipline ? <div className="text-center py-8"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary"/></div> : (
                    <Table>
                      <TableHeader><TableRow><TableHead className="text-right">تاریخ</TableHead><TableHead className="text-right">کلاس</TableHead><TableHead className="text-right">شرح</TableHead><TableHead className="text-right">شدت</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {discipline.length === 0 ? (<TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">هیچ مورد انضباطی ثبت نشده است</TableCell></TableRow>) : (
                          discipline.map((record) => (
                            <TableRow key={record.id}>
                              <TableCell>{format(new Date(record.created_at), 'yyyy/MM/dd')}</TableCell>
                              <TableCell>{record.classes?.name || '-'}</TableCell>
                              <TableCell>{record.description}</TableCell>
                              <TableCell>{getSeverityBadge(record.severity)}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                 )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
};

export default ParentDashboard;

