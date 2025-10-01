import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { LogOut, User } from 'lucide-react';

interface Student {
  id: string;
  full_name: string;
}

interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
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
  const [selectedChild, setSelectedChild] = useState('');

  useEffect(() => {
    if (user) {
      fetchChildren();
    }
  }, [user]);

  useEffect(() => {
    if (selectedChild) {
      fetchAttendance();
      fetchDiscipline();
    }
  }, [selectedChild]);

  const fetchChildren = async () => {
    const { data } = await supabase
      .from('students')
      .select('id, full_name')
      .eq('parent_id', user?.id);
    
    setChildren(data || []);
    if (data && data.length > 0) {
      setSelectedChild(data[0].id);
    }
  };

  const fetchAttendance = async () => {
    const { data } = await supabase
      .from('attendance')
      .select('id, date, status')
      .eq('student_id', selectedChild)
      .order('date', { ascending: false })
      .limit(30);
    setAttendance(data || []);
  };

  const fetchDiscipline = async () => {
    const { data } = await supabase
      .from('discipline_records')
      .select('id, description, severity, created_at')
      .eq('student_id', selectedChild)
      .order('created_at', { ascending: false });
    setDiscipline(data || []);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present':
        return <Badge className="bg-success">حاضر</Badge>;
      case 'absent':
        return <Badge variant="destructive">غایب</Badge>;
      case 'late':
        return <Badge className="bg-warning text-white">تأخیر</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'low':
        return <Badge className="bg-success">کم</Badge>;
      case 'medium':
        return <Badge className="bg-warning text-white">متوسط</Badge>;
      case 'high':
        return <Badge variant="destructive">شدید</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center">
              <User className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">پنل اولیا</h1>
              <p className="text-sm text-muted-foreground">مشاهده وضعیت فرزند</p>
            </div>
          </div>
          <Button onClick={signOut} variant="outline" className="gap-2">
            <LogOut className="w-4 h-4" />
            خروج
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6" dir="rtl">
        {children.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              هیچ فرزندی ثبت نشده است
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>حضور و غیاب</CardTitle>
                <CardDescription>
                  وضعیت حضور و غیاب {children.find(c => c.id === selectedChild)?.full_name}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">تاریخ</TableHead>
                      <TableHead className="text-right">وضعیت</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendance.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center py-8 text-muted-foreground">
                          هیچ سابقه‌ای یافت نشد
                        </TableCell>
                      </TableRow>
                    ) : (
                      attendance.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>{new Date(record.date).toLocaleDateString('fa-IR')}</TableCell>
                          <TableCell>{getStatusBadge(record.status)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>موارد انضباطی</CardTitle>
                <CardDescription>
                  موارد انضباطی ثبت شده برای {children.find(c => c.id === selectedChild)?.full_name}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">تاریخ</TableHead>
                      <TableHead className="text-right">شرح</TableHead>
                      <TableHead className="text-right">شدت</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {discipline.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                          هیچ مورد انضباطی ثبت نشده است
                        </TableCell>
                      </TableRow>
                    ) : (
                      discipline.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>{new Date(record.created_at).toLocaleDateString('fa-IR')}</TableCell>
                          <TableCell>{record.description}</TableCell>
                          <TableCell>{getSeverityBadge(record.severity)}</TableCell>
                        </TableRow>
                      ))
                    )}
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
