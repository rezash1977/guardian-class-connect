import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth'; // Import useAuth
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { LogOut, User, Upload, Eye, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { parseISO, isValid, parse } from 'date-fns'; // Import necessary date-fns functions
import { format } from 'date-fns-jalali'; // Keep jalali format

// ... (Interfaces remain the same) ...
interface Student {
  id: string;
  full_name: string;
}

interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
  lesson_period: number;
//   absence_justified: boolean; // Removed based on previous error
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
  // Use loading state from AuthProvider
  const { signOut, user, loading: authLoading } = useAuth();
  const [children, setChildren] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [discipline, setDiscipline] = useState<DisciplineRecord[]>([]);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File | null>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  // Separate loading state for data fetching specific to this component
  const [loadingData, setLoadingData] = useState(false);

  // Fetch children only when auth is done loading and user exists
  useEffect(() => {
    // --- MODIFIED CHECK ---
    if (!authLoading && user) {
        setLoadingData(true); // Start data loading
        fetchChildren();
    } else if (!authLoading && !user) {
        // Clear data if user logs out or was never logged in
        setChildren([]);
        setSelectedChildId('');
        setAttendance([]);
        setDiscipline([]);
        setLoadingData(false); // Ensure loading stops if no user
    }
     // If authLoading is true, do nothing, wait for it to finish
  }, [user, authLoading]); // Depend on user AND authLoading

  // Fetch attendance and discipline when child changes, but only if auth is done and user exists
  useEffect(() => {
    // --- MODIFIED CHECK ---
    if (selectedChildId && !authLoading && user) {
      setLoadingData(true); // Start data loading
      Promise.all([fetchAttendance(), fetchDiscipline()])
        .catch(err => console.error("Error fetching child data:", err)) // Add catch for Promise.all
        .finally(() => setLoadingData(false)); // Stop data loading
    } else {
        // Clear data if child selection is removed or auth is not ready
        setAttendance([]);
        setDiscipline([]);
        // Ensure loading stops if no child is selected
        if (!selectedChildId) setLoadingData(false);
    }
  }, [selectedChildId, user, authLoading]); // Depend on child, user, AND authLoading

  // --- fetchChildren function remains largely the same ---
  const fetchChildren = async () => {
    console.log("Fetching children for user:", user?.id);
    // Add guard clause for user
    if(!user) {
        setLoadingData(false);
        return;
    }
    try {
        const { data, error } = await supabase.from('students').select('id, full_name').eq('parent_id', user.id);
        if (error) throw error; // Throw error to be caught below

        setChildren(data || []);
        if (data && data.length > 0 && !selectedChildId) {
             console.log("Setting selected child to:", data[0].id);
             setSelectedChildId(data[0].id);
        } else if (data && data.length === 0) {
            setSelectedChildId('');
            setLoadingData(false); // Stop loading if no children found
        }
        // Don't stop loading here if a child was selected, let the other useEffect handle it
    } catch (error: any) {
        toast.error("خطا در دریافت لیست فرزندان."); // More generic message
        console.error("Children fetch error:", error);
        setChildren([]);
        setSelectedChildId('');
        setLoadingData(false); // Stop loading on error
    }
  };

  // --- Modified fetchAttendance with improved error handling ---
  const fetchAttendance = async () => {
    console.log("Fetching attendance for child:", selectedChildId);
    if (!selectedChildId || !user) return; // Guard clauses

    try {
        const { data, error, status } = await supabase
          .from('attendance')
           // Select necessary fields, removed absence_justified
          .select('id, date, status, lesson_period, medical_certificate_url, class_subjects(subjects(name))')
          .eq('student_id', selectedChildId)
          .order('date', { ascending: false })
          .limit(50);

        if (error) {
            // Throw error to be caught below, status might indicate auth issue (401)
             console.error("Attendance fetch error detail:", { status, ...error });
             throw error;
        }
        setAttendance(data as AttendanceRecord[] || []);

    } catch (error: any) {
        // Improved error handling
        console.error("Attendance fetch exception:", error);
        if (error.message.includes('JWT') || error.status === 401 || error.code?.includes('PGRST301')) {
             toast.error("نشست شما نامعتبر است. لطفاً دوباره وارد شوید.");
             // Optionally force sign out: signOut();
        } else if (error.message.includes('does not exist')) {
            toast.error("خطا: ساختار جدول حضور و غیاب نادرست است. با مدیر تماس بگیرید."); // Specific message for schema issues
        }
        else {
             // Generic error for other issues (RLS, network, etc.)
            toast.error("خطا در دریافت اطلاعات حضور و غیاب.");
        }
        setAttendance([]); // Clear data on error
    }
  };

  // --- Modified fetchDiscipline with improved error handling ---
  const fetchDiscipline = async () => {
    console.log("Fetching discipline for child:", selectedChildId);
    if (!selectedChildId || !user) return; // Guard clauses

    try {
        const { data, error, status } = await supabase
            .from('discipline_records')
            .select('*') // Select all columns
            .eq('student_id', selectedChildId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Discipline fetch error detail:", { status, ...error });
            throw error;
        }
        setDiscipline(data as DisciplineRecord[] || []);

    } catch(error: any) {
        console.error("Discipline fetch exception:", error);
        if (error.message.includes('JWT') || error.status === 401 || error.code?.includes('PGRST301')) {
             toast.error("نشست شما نامعتبر است. لطفاً دوباره وارد شوید.");
        } else if (error.message.includes('does not exist')) {
             toast.error("خطا: ساختار جدول انضباطی نادرست است. با مدیر تماس بگیرید.");
        } else {
             toast.error("خطا در دریافت اطلاعات انضباطی.");
        }
        setDiscipline([]); // Clear data on error
    }
  };

  // --- handleFileChange remains the same ---
   const handleFileChange = (attendanceId: string, file: File | null) => {
    setSelectedFiles(prev => ({ ...prev, [attendanceId]: file }));
   };


  // --- Modified handleFileUpload with check for user ---
  const handleFileUpload = async (attendanceId: string) => {
    const file = selectedFiles[attendanceId];
    if (!file) {
      toast.error('لطفاً یک فایل انتخاب کنید.');
      return;
    }
     // Check user status before attempting upload
     if (authLoading || !user) {
        toast.error("برای بارگذاری فایل باید وارد شده باشید. لطفاً صبر کنید یا دوباره وارد شوید.");
        return;
     }

    setUploading(attendanceId);
    const fileExt = file.name.split('.').pop();
    if (!selectedChildId) {
        toast.error("خطای داخلی: شناسه فرزند مشخص نیست.");
        setUploading(null);
        return;
    }
    const filePath = `medical_certificates/${selectedChildId}/${attendanceId}_${new Date().getTime()}.${fileExt}`;

    try {
      console.log("Uploading file to path:", filePath);
      const { error: uploadError } = await supabase.storage.from('medical_certificates').upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      console.log("Upload successful, getting public URL...");
      const { data: urlData } = supabase.storage.from('medical_certificates').getPublicUrl(filePath);
      const publicUrl = urlData?.publicUrl;
      if (!publicUrl) throw new Error("پس از بارگذاری، آدرس فایل دریافت نشد.");

      console.log("Updating attendance record:", attendanceId);
      // Update only medical_certificate_url, absence_justified removed
      const { error: updateError } = await supabase
          .from('attendance')
          .update({ medical_certificate_url: publicUrl })
          .eq('id', attendanceId);

      if (updateError) {
           console.warn("Attempting to delete uploaded file due to DB update failure:", filePath);
           await supabase.storage.from('medical_certificates').remove([filePath]);
           throw updateError;
      }

      toast.success('گواهی پزشکی با موفقیت بارگذاری شد.');
      fetchAttendance(); // Refresh attendance list
    } catch (error: any) {
      console.error("File upload process error:", error);
       // Add specific check for storage RLS or policy errors
        if (error.message.includes('policy') || error.message.includes('bucket not found') || error.message.includes('object not found') || error.status === 403 || error.status === 401) {
             toast.error("خطای دسترسی هنگام بارگذاری فایل. با مدیر تماس بگیرید.");
        } else {
            toast.error(`خطا در بارگذاری فایل: ${error.message || 'خطای ناشناخته'}`);
        }
    } finally {
      setUploading(null);
      setSelectedFiles(prev => ({ ...prev, [attendanceId]: null }));
    }
  };

  // --- Modified getStatusBadge (depends on medical_certificate_url now) ---
   const getStatusBadge = (record: AttendanceRecord) => {
       // Absence is justified if there's a medical certificate URL
       const isJustified = !!record.medical_certificate_url;
       if (record.status === 'absent' && isJustified) return <Badge className="bg-blue-500 hover:bg-blue-600">موجه</Badge>;
       switch (record.status) {
         case 'present': return <Badge className="bg-green-500 hover:bg-green-600">حاضر</Badge>;
         case 'absent': return <Badge variant="destructive">غایب</Badge>;
         case 'late': return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-black">تأخیر</Badge>;
         default: return <Badge variant="outline">{record.status}</Badge>;
       }
   };

  // --- getSeverityBadge remains the same ---
   const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'low': return <Badge className="bg-green-500 hover:bg-green-600">کم</Badge>;
      case 'medium': return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-black">متوسط</Badge>;
      case 'high': return <Badge variant="destructive">شدید</Badge>;
      default: return <Badge variant="outline">{severity}</Badge>;
    }
  };

  // --- safeFormatDate function remains the same ---
   const safeFormatDate = (dateString: string | null | undefined, inputFormat?: string): string => {
        if (!dateString) return '-';
        try {
            let dateObj: Date;
            if (inputFormat) {
                dateObj = parse(dateString, inputFormat, new Date());
            } else {
                dateObj = parseISO(dateString);
                if (!isValid(dateObj)) {
                    dateObj = new Date(dateString.replace(/-/g, '/')); // Simple fallback
                }
            }

            if (isValid(dateObj)) {
                return format(dateObj, 'yyyy/MM/dd');
            } else {
                 console.warn("Invalid date encountered:", dateString);
                 return 'تاریخ نامعتبر';
            }
        } catch (error) {
            console.error("Error formatting date:", dateString, error);
            return 'خطا در تاریخ';
        }
   };


  const selectedChildName = children.find(c => c.id === selectedChildId)?.full_name || '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      {/* --- Header remains the same --- */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
                 <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                 <div className="flex items-center gap-3"><div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center"><User className="w-6 h-6 text-primary-foreground" /></div><div><h1 className="text-2xl font-bold">پنل اولیا</h1><p className="text-sm text-muted-foreground">مشاهده وضعیت فرزند</p></div></div>
                 {children.length > 0 && ( // Show select only if there are children
                     <Select value={selectedChildId} onValueChange={setSelectedChildId} disabled={authLoading || loadingData}>
                         <SelectTrigger className="w-[180px]">
                             <SelectValue placeholder="انتخاب فرزند" />
                         </SelectTrigger>
                         <SelectContent>{children.map(child => <SelectItem key={child.id} value={child.id}>{child.full_name}</SelectItem>)}</SelectContent>
                     </Select>
                 )}
                 <Button onClick={signOut} variant="outline" className="gap-2"><LogOut className="w-4 h-4" />خروج</Button>
                 </div>
      </header>
      <main className="container mx-auto px-4 py-8 space-y-6" dir="rtl">
         {/* Show loading indicator if either auth or data is loading */}
         {(authLoading || loadingData) && (
             <div className="flex justify-center items-center py-10">
                 <Loader2 className="h-8 w-8 animate-spin text-primary" />
                 <span className="ml-2">{authLoading ? 'در حال بررسی وضعیت ورود...' : 'در حال بارگذاری اطلاعات...'}</span>
             </div>
         )}
         {/* Show message if auth is done, no user, or no children */}
         {!authLoading && !user && (<Card><CardContent className="py-12 text-center text-muted-foreground">برای مشاهده اطلاعات، لطفاً وارد شوید.</CardContent></Card>)}
         {!authLoading && user && children.length === 0 && !loadingData && (<Card><CardContent className="py-12 text-center text-muted-foreground">هیچ فرزندی برای شما ثبت نشده است.</CardContent></Card>)}

         {/* Show content only when auth and data loading are finished, and a child is selected */}
         {!authLoading && !loadingData && selectedChildId && user && (
          <>
            {/* Attendance Card */}
            <Card>
              <CardHeader><CardTitle>حضور و غیاب</CardTitle><CardDescription>وضعیت حضور و غیاب {selectedChildName}</CardDescription></CardHeader>
              <CardContent>
                 {attendance.length === 0 ? (<p className="text-muted-foreground text-center py-4">موردی برای نمایش وجود ندارد.</p>) : (
                <Table>
                  <TableHeader><TableRow><TableHead>تاریخ</TableHead><TableHead>درس</TableHead><TableHead>زنگ</TableHead><TableHead>وضعیت</TableHead><TableHead>اقدامات</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {attendance.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>{safeFormatDate(record.date, 'yyyy-MM-dd')}</TableCell>
                        <TableCell>{record.class_subjects?.subjects?.name || '-'}</TableCell>
                        <TableCell>{record.lesson_period}</TableCell>
                        <TableCell>{getStatusBadge(record)}</TableCell>
                        <TableCell>
                          {/* Logic for upload button remains, but justification depends on URL */}
                           {record.status === 'absent' && !record.medical_certificate_url && (
                            <div className="flex items-center gap-2">
                              <Input type="file" className="max-w-[150px] sm:max-w-xs h-9 text-xs sm:text-sm" onChange={(e) => handleFileChange(record.id, e.target.files ? e.target.files[0] : null)} />
                              <Button size="sm" onClick={() => handleFileUpload(record.id)} disabled={!selectedFiles[record.id] || uploading === record.id} className="w-[40px] px-0">
                                {uploading === record.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4"/>}
                              </Button>
                            </div>
                           )}
                           {record.medical_certificate_url && (<Button asChild variant="link" size="sm"><a href={record.medical_certificate_url} target="_blank" rel="noopener noreferrer" className="gap-1"><Eye className="w-4 h-4" />مشاهده گواهی</a></Button>)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                 )}
              </CardContent>
            </Card>
            {/* Discipline Card */}
            <Card>
              <CardHeader><CardTitle>موارد انضباطی</CardTitle><CardDescription>موارد انضباطی ثبت شده برای {selectedChildName}</CardDescription></CardHeader>
              <CardContent>
                 {discipline.length === 0 ? (<p className="text-muted-foreground text-center py-4">موردی برای نمایش وجود ندارد.</p>) : (
                <Table>
                  <TableHeader><TableRow><TableHead>تاریخ</TableHead><TableHead>شرح</TableHead><TableHead>شدت</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {discipline.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>{safeFormatDate(record.created_at)}</TableCell>
                        <TableCell>{record.description}</TableCell>
                        <TableCell>{getSeverityBadge(record.severity)}</TableCell>
                       </TableRow>
                    ))}
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

