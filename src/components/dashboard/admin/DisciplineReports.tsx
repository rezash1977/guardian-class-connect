import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Search, Calendar as CalendarIcon, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { format } from "date-fns-jalali";
import { useSortableData } from '@/hooks/use-sortable-data';

// Interface definitions
interface DisciplineRecord {
  id: string;
  description: string;
  severity: string;
  created_at: string;
  students: { full_name: string } | null;
  classes: { id: string, name: string } | null;
  profiles: { full_name: string } | null;
}

interface ClassInfo {
    id: string;
    name: string;
}

const DisciplineReports = () => {
  const [records, setRecords] = useState<DisciplineRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<ClassInfo[]>([]);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClassId, setFilterClassId] = useState('all');
  const [date, setDate] = useState<Date | undefined>();

  const { items: sortedItems, requestSort, sortConfig } = useSortableData(records, { key: 'created_at', direction: 'descending' });

  useEffect(() => {
    fetchClasses();
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('discipline_records')
      .select('*, students(full_name), classes(id, name), profiles(full_name)');
    
    if (error) toast.error('خطا در بارگذاری گزارش‌ها: ' + error.message);
    else setRecords((data as DisciplineRecord[]) || []);
    setLoading(false);
  };
  
  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('id, name');
    setClasses(data || []);
  };
  
  const filteredRecords = useMemo(() => {
    if (!sortedItems) return [];
    return sortedItems.filter(record => {
      const searchTermLower = searchTerm.toLowerCase();
      const nameMatch = record.students?.full_name.toLowerCase().includes(searchTermLower) ?? false;
      const classMatch = filterClassId === 'all' || record.classes?.id === filterClassId;
      const dateMatch = !date || format(new Date(record.created_at), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
      return nameMatch && classMatch && dateMatch;
    });
  }, [sortedItems, searchTerm, filterClassId, date]);

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'low': return <Badge className="bg-green-500 hover:bg-green-600">کم</Badge>;
      case 'medium': return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-black">متوسط</Badge>;
      case 'high': return <Badge variant="destructive">شدید</Badge>;
      default: return <Badge variant="outline">{severity}</Badge>;
    }
  };
  
  const SortableHeader = ({ sortKey, children }: { sortKey: string, children: React.ReactNode }) => {
    const icon = !sortConfig || sortConfig.key !== sortKey
        ? <ArrowUpDown className="mr-2 h-4 w-4 opacity-50" />
        : sortConfig.direction === 'ascending'
        ? <ArrowUp className="mr-2 h-4 w-4" />
        : <ArrowDown className="mr-2 h-4 w-4" />;
    return <Button variant="ghost" onClick={() => requestSort(sortKey)}>{children}{icon}</Button>
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>گزارش موارد انضباطی</CardTitle>
        <CardDescription>مشاهده و فیلتر تمام موارد انضباطی ثبت شده</CardDescription>
        <div className="flex flex-wrap items-center gap-2 pt-4">
            <div className="relative flex-grow min-w-[200px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="جستجوی نام دانش آموز..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" dir="rtl"/></div>
            <Select value={filterClassId} onValueChange={setFilterClassId}><SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="فیلتر کلاس" /></SelectTrigger><SelectContent><SelectItem value="all">همه کلاس‌ها</SelectItem>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
             <Popover>
                <PopoverTrigger asChild><Button variant={"outline"} className="w-full sm:w-[240px] justify-start text-right font-normal"><CalendarIcon className="ml-2 h-4 w-4" />{date ? format(date, "PPP") : <span>انتخاب تاریخ</span>}</Button></PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={date} onSelect={setDate} /></PopoverContent>
            </Popover>
             <Button variant="outline" onClick={() => { setSearchTerm(''); setFilterClassId('all'); setDate(undefined); }}>پاک کردن فیلترها</Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <div className="text-center py-8">در حال بارگذاری...</div> : (
          <Table dir="rtl">
            <TableHeader>
              <TableRow>
                <TableHead className="text-right"><SortableHeader sortKey="students.full_name">دانش‌آموز</SortableHeader></TableHead>
                <TableHead className="text-right"><SortableHeader sortKey="classes.name">کلاس</SortableHeader></TableHead>
                <TableHead className="text-right w-[40%]"><SortableHeader sortKey="description">شرح</SortableHeader></TableHead>
                <TableHead className="text-right"><SortableHeader sortKey="severity">شدت</SortableHeader></TableHead>
                <TableHead className="text-right"><SortableHeader sortKey="created_at">تاریخ</SortableHeader></TableHead>
                <TableHead className="text-right"><SortableHeader sortKey="profiles.full_name">ثبت توسط</SortableHeader></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">هیچ سابقه‌ای یافت نشد</TableCell></TableRow> : (
                filteredRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{record.students?.full_name || 'نامشخص'}</TableCell>
                    <TableCell>{record.classes?.name || 'نامشخص'}</TableCell>
                    <TableCell>{record.description}</TableCell>
                    <TableCell>{getSeverityBadge(record.severity)}</TableCell>
                    <TableCell>{format(new Date(record.created_at), 'yyyy/MM/dd')}</TableCell>
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

