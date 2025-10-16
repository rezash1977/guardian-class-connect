import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent
} from '@/components/ui/card';
import {
  Table, TableHeader, TableHead, TableBody, TableRow, TableCell
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pencil, Trash2, Check, X } from 'lucide-react';
import { format } from 'date-fns-jalali';
import { faIR } from 'date-fns/locale';

interface AttendanceRecord {
  id: string;
  student_id: string;
  status: 'present' | 'absent' | 'late';
  justification: 'justified' | 'unjustified' | null;
  created_at: string;
  students: { full_name: string } | null;
}

const AttendanceReports = () => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<'present' | 'absent' | 'late'>('present');
  const [editJustification, setEditJustification] = useState<'justified' | 'unjustified' | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
  
    try {
      // نام جدول را با جدول واقعی‌ات تطبیق بده: 'attendance' یا 'attendance'
      const { data, error } = await supabase
  .from('attendance')  // ✅ جدول درست
  .select(`
    id,
    student_id,
    status,
    justification,
    created_at,
    students ( full_name )
        `)

        .order('created_at', { ascending: false })
        .limit(500);
  
      if (error) {
        // لاگ مفصل برای دیباگ
        console.error('Supabase error fetching attendance:', {
          message: error.message,
          details: (error as any).details,
          hint: (error as any).hint,
          code: (error as any).code,
          status,
        });
        toast.error(`خطا در بارگذاری اطلاعات حضور و غیاب: ${error.message}`);
        setRecords([]);
        setLoading(false);
        return;
      }
  
      // اگر داده برگشته ولی ساختار ناشناخته است، یک نمونه لاگ کن
      if (!data || data.length === 0) {
        console.info('Attendance fetch OK but no rows returned.');
        setRecords([]);
        setLoading(false);
        return;
      }
  
      console.debug('attendance sample row:', data[0]);
  
      // نرمال‌سازی ایمن روی هر رکورد (تا TypeScript راضی باشه)
      const normalized = (data as any[]).map((r) => {
        // students ممکن است آرایه یا شیء یا null باشد
        let studentObj: { full_name: string } | null = null;
        if (r.students) {
          if (Array.isArray(r.students)) studentObj = r.students[0] ?? null;
          else studentObj = r.students;
        }
  
        return {
          id: String(r.id),
          student_id: String(r.student_id ?? ''),
          status: String(r.status ?? ''),
          justification: r.justification ?? null,
          created_at: String(r.created_at ?? ''),
          students: studentObj,
        } as AttendanceRecord;
      });
  
      setRecords(normalized);
    } catch (err: any) {
      console.error('Unexpected error fetching attendance:', err);
      toast.error('خطای غیرمنتظره در بارگذاری اطلاعات حضور و غیاب');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };
  

  const startEdit = (record: AttendanceRecord) => {
    setEditingId(record.id);
    setEditStatus(record.status);
    setEditJustification(record.justification);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (id: string) => {
    const { error } = await supabase
      .from('attendance')
      .update({ status: editStatus, justification: editJustification })
      .eq('id', id);

    if (error) {
      toast.error('خطا در ویرایش رکورد');
    } else {
      toast.success('ویرایش با موفقیت انجام شد');
      fetchData();
    }
    setEditingId(null);
  };

  const deleteRecord = async (id: string) => {
    if (!confirm('آیا از حذف این رکورد مطمئن هستید؟')) return;
    const { error } = await supabase.from('attendance').delete().eq('id', id);
    if (error) toast.error('خطا در حذف رکورد');
    else {
      toast.success('رکورد حذف شد');
      setRecords((prev) => prev.filter((r) => r.id !== id));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present': return <Badge className="bg-green-500">حاضر</Badge>;
      case 'absent': return <Badge className="bg-red-500">غایب</Badge>;
      case 'late': return <Badge className="bg-yellow-500 text-black">تاخیر</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getJustificationBadge = (justification: string | null) => {
    if (!justification) return <Badge variant="outline">نامشخص</Badge>;
    if (justification === 'justified') return <Badge className="bg-blue-500">موجه</Badge>;
    if (justification === 'unjustified') return <Badge variant="destructive">غیرموجه</Badge>;
    return <Badge variant="outline">{justification}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>گزارش حضور و غیاب</CardTitle>
        <CardDescription>مدیر می‌تواند غیبت‌ها را موجه یا غیرموجه کند، و رکوردها را ویرایش یا حذف نماید.</CardDescription>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="text-center py-8">در حال بارگذاری...</div>
        ) : (
          <Table dir="rtl">
            <TableHeader>
              <TableRow>
                <TableHead>دانش‌آموز</TableHead>
                <TableHead>وضعیت</TableHead>
                <TableHead>موجه بودن</TableHead>
                <TableHead>تاریخ</TableHead>
                <TableHead>عملیات</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    هیچ گزارشی ثبت نشده است
                  </TableCell>
                </TableRow>
              ) : (
                records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{record.students?.full_name || 'نامشخص'}</TableCell>

                    <TableCell>
                      {editingId === record.id ? (
                        <Select
                          value={editStatus}
                          onValueChange={(v: 'present' | 'absent' | 'late') => setEditStatus(v)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="present">حاضر</SelectItem>
                            <SelectItem value="absent">غایب</SelectItem>
                            <SelectItem value="late">تاخیر</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        getStatusBadge(record.status)
                      )}
                    </TableCell>

                    <TableCell>
                      {editingId === record.id ? (
                        <Select
                          value={editJustification || 'unjustified'}
                          onValueChange={(v: 'justified' | 'unjustified') => setEditJustification(v)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="justified">موجه</SelectItem>
                            <SelectItem value="unjustified">غیرموجه</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        getJustificationBadge(record.justification)
                      )}
                    </TableCell>

                    <TableCell>
                      {format(new Date(record.created_at), 'yyyy/MM/dd HH:mm', { locale: faIR })}
                    </TableCell>

                    <TableCell className="flex gap-2">
                      {editingId === record.id ? (
                        <>
                          <Button size="icon" variant="success" onClick={() => saveEdit(record.id)}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="outline" onClick={cancelEdit}>
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="icon" variant="outline" onClick={() => startEdit(record)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="destructive" onClick={() => deleteRecord(record.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
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
  );
};

export default AttendanceReports;
