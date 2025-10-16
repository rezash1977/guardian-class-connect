import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle
} from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Popover, PopoverContent, PopoverTrigger
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Search, Calendar as CalendarIcon } from 'lucide-react';
import { format, startOfDay } from 'date-fns-jalali';
import { faIR } from 'date-fns/locale';

interface DisciplineRecord {
  id: string;
  description: string;
  severity: string;
  created_at: string;
  students: { full_name: string } | null;
  class_subjects: {
    classes: { name: string } | null;
  } | null;
  profiles: { full_name: string } | null;
}

interface Class {
  id: string;
  name: string;
}

const DisciplineReports = () => {
  const [records, setRecords] = useState<DisciplineRecord[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [recordsRes, classesRes] = await Promise.all([
      supabase
        .from('discipline_records')
        .select(`
          *,
          students (full_name),
          class_subjects (
            classes (name)
          ),
          profiles (full_name)
        `)
        .order('created_at', { ascending: false }),
      supabase.from('classes').select('id, name')
    ]);

    if (classesRes.error) {
      toast.error('خطا در بارگذاری کلاس‌ها');
      setClasses([]);
    } else {
      setClasses(classesRes.data || []);
    }

    if (recordsRes.error) {
      toast.error('خطا در بارگذاری گزارش‌ها');
      setRecords([]);
      setLoading(false);
      return;
    }

    // نرمال‌سازی داده‌ها به ساختار DisciplineRecord
    const raw = recordsRes.data || [];
    const normalized: DisciplineRecord[] = raw.map((r: any) => {
      // students ممکن است آرایه یا شیء یا null باشد
      let studentObj: { full_name: string } | null = null;
      if (r.students) {
        if (Array.isArray(r.students)) studentObj = r.students[0] ?? null;
        else studentObj = r.students;
      }

      // class_subjects ممکن است آرایه یا شیء یا null باشد.
      // هدف: تبدیل به { classes: { name } | null } | null
      let csObj: { classes: { name: string } | null } | null = null;
      if (r.class_subjects) {
        const firstCs = Array.isArray(r.class_subjects) ? r.class_subjects[0] : r.class_subjects;
        if (firstCs) {
          csObj = {
            classes: firstCs.classes ?? null
          };
        }
      }

      // profiles ممکن است آرایه/شیء/null
      let profileObj: { full_name: string } | null = null;
      if (r.profiles) {
        if (Array.isArray(r.profiles)) profileObj = r.profiles[0] ?? null;
        else profileObj = r.profiles;
      }

      return {
        id: String(r.id),
        description: String(r.description ?? ''),
        severity: String(r.severity ?? ''),
        created_at: String(r.created_at ?? ''),
        students: studentObj,
        class_subjects: csObj,
        profiles: profileObj,
      };
    });

    setRecords(normalized);
    setLoading(false);
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'low':
        return <Badge className="bg-green-500 hover:bg-green-600">کم</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-black">متوسط</Badge>;
      case 'high':
        return <Badge variant="destructive">شدید</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
  };

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const studentNameMatch =
        !searchTerm ||
        (record.students?.full_name ?? '')
          .toLowerCase()
          .includes(searchTerm.toLowerCase());

      const classMatch =
        selectedClass === 'all' ||
        (record.class_subjects?.classes?.name ?? '') ===
          classes.find((c) => c.id === selectedClass)?.name;

      const dateMatch =
        !selectedDate ||
        startOfDay(new Date(record.created_at)).getTime() ===
          startOfDay(selectedDate).getTime();

      return studentNameMatch && classMatch && dateMatch;
    });
  }, [records, searchTerm, selectedClass, selectedDate, classes]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>گزارش موارد انضباطی</CardTitle>
        <CardDescription>مشاهده تمام موارد انضباطی ثبت‌شده</CardDescription>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
          {/* جستجوی نام دانش‌آموز */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="جستجوی نام دانش‌آموز..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              dir="rtl"
            />
          </div>

          {/* فیلتر بر اساس کلاس */}
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger>
              <SelectValue placeholder="فیلتر بر اساس کلاس" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه کلاس‌ها</SelectItem>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* فیلتر بر اساس تاریخ */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal"
              >
                <CalendarIcon className="ml-2 h-4 w-4" />
                {selectedDate ? (
                  format(selectedDate, 'PPP', { locale: faIR })
                ) : (
                  <span>فیلتر بر اساس تاریخ</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                initialFocus
                locale={faIR}
              />
            </PopoverContent>
          </Popover>
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
                <TableHead className="text-right">شرح</TableHead>
                <TableHead className="text-right">شدت</TableHead>
                <TableHead className="text-right">تاریخ</TableHead>
                <TableHead className="text-right">ثبت‌شده توسط</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-8 text-muted-foreground"
                  >
                    هیچ سابقه‌ای یافت نشد
                  </TableCell>
                </TableRow>
              ) : (
                filteredRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{record.students?.full_name || 'نامشخص'}</TableCell>
                    <TableCell>{record.class_subjects?.classes?.name || 'نامشخص'}</TableCell>
                    <TableCell>{record.description}</TableCell>
                    <TableCell>{getSeverityBadge(record.severity)}</TableCell>
                    <TableCell>
                      {format(new Date(record.created_at), 'yyyy/MM/dd HH:mm', { locale: faIR })}
                    </TableCell>
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
