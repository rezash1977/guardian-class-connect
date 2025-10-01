import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
  students: {
    full_name: string;
  };
  classes: {
    name: string;
  };
  profiles: {
    full_name: string;
  } | null;
}

const AttendanceReports = () => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    const { data, error } = await supabase
      .from('attendance')
      .select('*, students(full_name), classes(name), profiles(full_name)')
      .order('date', { ascending: false })
      .limit(50);
    
    if (error) {
      toast.error('خطا در بارگذاری گزارش‌ها');
    } else {
      setRecords(data || []);
    }
    setLoading(false);
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>گزارش حضور و غیاب</CardTitle>
        <CardDescription>مشاهده تمام سوابق حضور و غیاب</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">در حال بارگذاری...</div>
        ) : (
          <Table dir="rtl">
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">دانش‌آموز</TableHead>
                <TableHead className="text-right">کلاس</TableHead>
                <TableHead className="text-right">تاریخ</TableHead>
                <TableHead className="text-right">وضعیت</TableHead>
                <TableHead className="text-right">ثبت شده توسط</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    هیچ سابقه‌ای یافت نشد
                  </TableCell>
                </TableRow>
              ) : (
                records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{record.students.full_name}</TableCell>
                    <TableCell>{record.classes.name}</TableCell>
                    <TableCell>{new Date(record.date).toLocaleDateString('fa-IR')}</TableCell>
                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                    <TableCell>{record.profiles?.full_name || 'نامشخص'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default AttendanceReports;
