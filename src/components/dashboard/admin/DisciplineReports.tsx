import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface DisciplineRecord {
  id: string;
  description: string;
  severity: string;
  created_at: string;
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

const DisciplineReports = () => {
  const [records, setRecords] = useState<DisciplineRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    const { data, error } = await supabase
      .from('discipline_records')
      .select('*, students(full_name), classes(name), profiles(full_name)')
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (error) {
      toast.error('خطا در بارگذاری گزارش‌ها');
    } else {
      setRecords(data || []);
    }
    setLoading(false);
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
    <Card>
      <CardHeader>
        <CardTitle>گزارش موارد انضباطی</CardTitle>
        <CardDescription>مشاهده تمام موارد انضباطی ثبت شده</CardDescription>
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
                <TableHead className="text-right">شرح</TableHead>
                <TableHead className="text-right">شدت</TableHead>
                <TableHead className="text-right">تاریخ</TableHead>
                <TableHead className="text-right">ثبت شده توسط</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    هیچ سابقه‌ای یافت نشد
                  </TableCell>
                </TableRow>
              ) : (
                records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{record.students.full_name}</TableCell>
                    <TableCell>{record.classes.name}</TableCell>
                    <TableCell>{record.description}</TableCell>
                    <TableCell>{getSeverityBadge(record.severity)}</TableCell>
                    <TableCell>{new Date(record.created_at).toLocaleDateString('fa-IR')}</TableCell>
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

export default DisciplineReports;
