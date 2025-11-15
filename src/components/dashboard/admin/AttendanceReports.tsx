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
import { Search, Calendar as CalendarIcon, ArrowUpDown, ArrowUp, ArrowDown, FileDown, Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import * as XLSX from 'xlsx';
import { format } from "date-fns-jalali";
import { useSortableData } from '@/hooks/use-sortable-data';

// Interfaces --------------------------------------------------------------

interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
  is_justified: boolean | null;
  lesson_period: number;
  students: { full_name: string } | null;
  class_subjects: {
    classes: { id: string, name: string } | null;
    subjects: { name: string } | null;
  } | null;
  profiles: { full_name: string } | null;
}

interface ClassInfo {
  id: string;
  name: string;
}

type AttendanceStatus = 'present' | 'absent' | 'late';

const attendanceStatuses: AttendanceStatus[] = ['present', 'absent', 'late'];

const statusTranslations: Record<string, string> = {
  present: 'حاضر',
  absent: 'غایب',
  late: 'تأخیر'
};

const justificationTranslations: Record<string, string> = {
  justified: 'موجه',
  unjustified: 'غیر موجه',
  na: '-'
};

// Component --------------------------------------------------------------

const AttendanceReports = () => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClassId, setFilterClassId] = useState('all');
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterJustification, setFilterJustification] = useState('all');
  
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [newStatus, setNewStatus] = useState<AttendanceStatus>('present');
  const [newJustified, setNewJustified] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const { items: sortedItems, requestSort, sortConfig } = useSortableData(records, { key: 'date', direction: 'descending' });

  // Fetch data -----------------------------------------------------------

  useEffect(() => {
    fetchClasses();
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('attendance')
      .select(`
        id,
        date,
        status,
        is_justified,
        lesson_period,
        students(full_name),
        class_subjects(
          classes(id,name),
          subjects(name)
        ),
        profiles(full_name)
      `);

    if (error) {
      toast.error('خطا در بارگذاری گزارش‌ها: ' + error.message);
    } else {
      setRecords(data as AttendanceRecord[]);
    }
    setLoading(false);
  };

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('id, name');
    setClasses(data || []);
  };

  // Filtering -------------------------------------------------------------

  const filteredRecords = useMemo(() => {
    if (!sortedItems) return [];

    return sortedItems.filter(record => {
      const searchTermLower = searchTerm.toLowerCase();

      const studentMatch =
        record.students?.full_name?.toLowerCase().includes(searchTermLower) ?? false;

      const classMatch =
        filterClassId === 'all' ||
        record.class_subjects?.classes?.id === filterClassId;

      const recordDateObj = new Date(record.date);
      const filterDateStr = date ? format(date, "yyyy-MM-dd") : null;
      const recordDateStr = format(recordDateObj, "yyyy-MM-dd");

      const dateMatch = !date || recordDateStr === filterDateStr;

      const statusMatch =
        filterStatus === 'all' || record.status === filterStatus;

      const justificationMatch =
        filterJustification === 'all' ||
        (filterJustification === 'justified' && record.is_justified === true) ||
        (filterJustification === 'unjustified' &&
          record.status === 'absent' &&
          (record.is_justified === false || record.is_justified === null));

      return studentMatch && classMatch && dateMatch && statusMatch && justificationMatch;
    });
  }, [sortedItems, searchTerm, filterClassId, date, filterStatus, filterJustification]);

  // Helpers ---------------------------------------------------------------

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present':
        return <Badge className="bg-green-500 text-white">{statusTranslations.present}</Badge>;
      case 'absent':
        return <Badge variant="destructive">{statusTranslations.absent}</Badge>;
      case 'late':
        return <Badge className="bg-yellow-500 text-black">{statusTranslations.late}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getJustificationText = (record: AttendanceRecord) => {
    if (record.status !== 'absent') return justificationTranslations.na;
    if (record.is_justified === true) return justificationTranslations.justified;
    return justificationTranslations.unjustified;
  };

  // Export Excel -----------------------------------------------------------

  const handleExport = () => {
    if (filteredRecords.length === 0) {
      toast.info('داده‌ای برای خروجی وجود ندارد.');
      return;
    }

    const dataToExport = filteredRecords.map(record => ({
      'دانش‌آموز': record.students?.full_name,
      'کلاس': record.class_subjects?.classes?.name,
      'درس': record.class_subjects?.subjects?.name,
      'تاریخ': format(new Date(record.date), 'yyyy/MM/dd'),
      'ساعت': record.lesson_period,
      'وضعیت': statusTranslations[record.status],
      'توجیه': getJustificationText(record),
      'ثبت توسط': record.profiles?.full_name
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'گزارش');

    XLSX.writeFile(wb, 'attendance.xlsx');
  };

  // Edit Dialog ------------------------------------------------------------

  const openEditDialog = (record: AttendanceRecord) => {
    setEditingRecord(record);
    setNewStatus(record.status as AttendanceStatus);
    setNewJustified(record.is_justified ?? false);
    setEditDialogOpen(true);
  };

  const handleUpdateAttendance = async () => {
    if (!editingRecord) return;
    setIsUpdating(true);

    const updateData = {
      status: newStatus,
      is_justified: newStatus === 'absent' ? newJustified : null
    };

    const { error } = await supabase
      .from('attendance')
      .update(updateData)
      .eq('id', editingRecord.id);

    if (error) toast.error('خطا در بروز رسانی');
    else {
      toast.success('بروز شد');
      fetchRecords();
      setEditDialogOpen(false);
    }
    
    setIsUpdating(false);
  };

  const SortableHeader = ({ sortKey, children }: any) => {
    const icon =
      !sortConfig || sortConfig.key !== sortKey
        ? <ArrowUpDown className="mr-2 h-4 w-4 opacity-50" />
        : sortConfig.direction === 'ascending'
        ? <ArrowUp className="mr-2 h-4 w-4" />
        : <ArrowDown className="mr-2 h-4 w-4" />;

    return (
      <Button variant="ghost" onClick={() => requestSort(sortKey)}>
        {children} {icon}
      </Button>
    );
  };

  // Render ----------------------------------------------------------------

  return (
    <Card>
      <CardHeader>
        <CardTitle>گزارش حضور و غیاب</CardTitle>
        <CardDescription>مشاهده، فیلتر و ویرایش سوابق</CardDescription>

        {/* Filters ------------------------------------------------------- */}
        <div className="flex flex-wrap gap-2 pt-4">
          
          {/* Search */}
          <div className="relative flex-grow min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50" />
            <Input
              placeholder="جستجوی دانش‌آموز..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Class Filter */}
          <Select value={filterClassId} onValueChange={setFilterClassId}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه کلاس‌ها</SelectItem>
              {classes.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status */}
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه وضعیت‌ها</SelectItem>
              <SelectItem value="present">حاضر</SelectItem>
              <SelectItem value="absent">غایب</SelectItem>
              <SelectItem value="late">تأخیر</SelectItem>
            </SelectContent>
          </Select>

          {/* Justification */}
          <Select value={filterJustification} onValueChange={setFilterJustification}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه</SelectItem>
              <SelectItem value="justified">موجه</SelectItem>
              <SelectItem value="unjustified">غیر موجه</SelectItem>
            </SelectContent>
          </Select>

          {/* Date Filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <CalendarIcon className="ml-2 h-4 w-4" />
                {date ? format(date, "yyyy/MM/dd") : "انتخاب تاریخ"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0">
              <Calendar mode="single" selected={date} onSelect={setDate} />
            </PopoverContent>
          </Popover>

          {/* Clear */}
          <Button variant="outline" onClick={() => { 
            setSearchTerm('');
            setFilterClassId('all');
            setFilterStatus('all');
            setFilterJustification('all');
            setDate(undefined);
          }}>
            پاک کردن
          </Button>

          {/* Export */}
          <Button variant="outline" onClick={handleExport}>
            <FileDown className="w-4 h-4 ml-2" />
            خروجی
          </Button>

        </div>
      </CardHeader>

      {/* Table ------------------------------------------------------------- */}
      <CardContent>
        {loading ? (
          <div className="text-center py-8">در حال بارگذاری...</div>
        ) : (
          <Table dir="rtl">
            <TableHeader>
              <TableRow>
                <TableHead><SortableHeader sortKey="students.full_name">دانش‌آموز</SortableHeader></TableHead>
                <TableHead><SortableHeader sortKey="class_subjects.classes.name">کلاس</SortableHeader></TableHead>
                <TableHead><SortableHeader sortKey="class_subjects.subjects.name">درس</SortableHeader></TableHead>
                <TableHead><SortableHeader sortKey="date">تاریخ</SortableHeader></TableHead>
                <TableHead><SortableHeader sortKey="lesson_period">ساعت</SortableHeader></TableHead>
                <TableHead><SortableHeader sortKey="status">وضعیت</SortableHeader></TableHead>
                <TableHead><SortableHeader sortKey="is_justified">توجیه</SortableHeader></TableHead>
                <TableHead><SortableHeader sortKey="profiles.full_name">ثبت توسط</SortableHeader></TableHead>
                <TableHead>ویرایش</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filteredRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-6 text-muted-foreground">
                    سابقه‌ای یافت نشد
                  </TableCell>
                </TableRow>
              ) : (
                filteredRecords.map(record => (
                  <TableRow key={record.id}>
                    <TableCell>{record.students?.full_name}</TableCell>
                    <TableCell>{record.class_subjects?.classes?.name}</TableCell>
                    <TableCell>{record.class_subjects?.subjects?.name}</TableCell>
                    <TableCell>{format(new Date(record.date), 'yyyy/MM/dd')}</TableCell>
                    <TableCell>{record.lesson_period}</TableCell>
                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                    <TableCell>{getJustificationText(record)}</TableCell>
                    <TableCell>{record.profiles?.full_name}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(record)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Edit Dialog -------------------------------------------------------- */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>ویرایش وضعیت</DialogTitle>
            <DialogDescription>
              برای تاریخ {editingRecord && format(new Date(editingRecord.date), 'yyyy/MM/dd')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">

            <div>
              <Label>وضعیت</Label>
              <Select value={newStatus} onValueChange={v => setNewStatus(v as AttendanceStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">حاضر</SelectItem>
                  <SelectItem value="absent">غایب</SelectItem>
                  <SelectItem value="late">تأخیر</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Justification only if absent */}
            {newStatus === 'absent' && (
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={newJustified}
                  onCheckedChange={v => setNewJustified(Boolean(v))}
                />
                <Label>غیبت موجه است؟</Label>
              </div>
            )}

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>انصراف</Button>
            <Button onClick={handleUpdateAttendance} disabled={isUpdating}>
              {isUpdating ? "در حال ذخیره..." : "ذخیره"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default AttendanceReports;
