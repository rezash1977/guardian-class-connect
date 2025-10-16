import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarIcon, Filter, X } from 'lucide-react';
import { format } from 'date-fns';

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

interface Class {
  id: string;
  name: string;
}

interface Student {
  id: string;
  full_name: string;
}

const AttendanceReports = () => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<string>('');

  useEffect(() => {
    fetchRecords();
    fetchClasses();
    fetchStudents();
  }, []);

  const fetchRecords = async (filters = {}) => {
    setLoading(true);
    let query = supabase
      .from('attendance')
      .select('*, students(full_name), classes(name), profiles(full_name)');

    if (filters.date) {
      query = query.eq('date', format(filters.date, 'yyyy-MM-dd'));
    }
    if (filters.classId) {
      query = query.eq('class_id', filters.classId);
    }
    if (filters.studentId) {
      query = query.eq('student_id', filters.studentId);
    }

    query = query.order('date', { ascending: false }).limit(100);

    const { data, error } = await query;
    
    if (error) {
      toast.error('خطا در بارگذاری گزارش‌ها');
    } else {
      setRecords(data || []);
    }
    setLoading(false);
  };

  const handleFilter = () => {
    fetchRecords({
      date: selectedDate,
      classId: selectedClass,
      studentId: selectedStudent,
    });
  };

  const handleClearFilters = () => {
    setSelectedDate(undefined);
    setSelectedClass('');
    setSelectedStudent('');
    fetchRecords();
  };

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('id, name');
    setClasses(data || []);
  };

  const fetchStudents = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'student');

    if (error) {
      toast.error("خطا در واکشی دانش‌آموزان");
    } else {
      setStudents(data.map(p => ({ id: p.id, full_name: p.full_name })) || []);
    }
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
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>گزارش حضور و غیاب</CardTitle>
            <CardDescription>مشاهده و فیلتر کردن سوابق حضور و غیاب</CardDescription>
          </div>
        </div>
        <div className="mt-4 flex flex-col sm:flex-row gap-4 p-4 border rounded-lg" dir="rtl">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className="w-full sm:w-[280px] justify-start text-right font-normal"
              >
                <CalendarIcon className="ml-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, "PPP") : <span>انتخاب تاریخ</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="انتخاب کلاس" />
            </SelectTrigger>
            <SelectContent>
              {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={selectedStudent} onValueChange={setSelectedStudent}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="انتخاب دانش‌آموز" />
            </SelectTrigger>
            <SelectContent>
              {students.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <Button onClick={handleFilter} className="w-full sm:w-auto gap-2">
              <Filter className="w-4 h-4" />
              اعمال فیلتر
            </Button>
            <Button onClick={handleClearFilters} variant="outline" className="w-full sm:w-auto gap-2">
              <X className="w-4 h-4" />
              پاک کردن
            </Button>
          </div>
        </div>
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
