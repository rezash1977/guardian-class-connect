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
import { Checkbox } from '@/components/ui/checkbox'; // Added Checkbox
import * as XLSX from 'xlsx';
import { format, parse } from "date-fns-jalali";
import { useSortableData } from '@/hooks/use-sortable-data';
const [date, setDate] = useState<Date | undefined>(new Date()); // تاریخ امروز به عنوان مقدار پیش‌فرض

// Interface definitions remain the same
interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
  is_justified: boolean | null; // Added is_justified
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
const statusTranslations: Record<AttendanceStatus | string, string> = { // Added string type for default case
    present: 'حاضر',
    absent: 'غایب',
    late: 'تأخیر'
};

const justificationTranslations: Record<string, string> = {
    justified: 'موجه',
    unjustified: 'غیر موجه',
    na: '-' // Not applicable or not absent
};


const AttendanceReports = () => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<ClassInfo[]>([]);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClassId, setFilterClassId] = useState('all');
  const [date, setDate] = useState<Date | undefined>();
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterJustification, setFilterJustification] = useState<string>('all'); // 'all', 'justified', 'unjustified'

  // Edit Dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [newStatus, setNewStatus] = useState<AttendanceStatus>('present');
  const [isUpdating, setIsUpdating] = useState(false);
  const [newJustified, setNewJustified] = useState<boolean>(false);


  const { items: sortedItems, requestSort, sortConfig } = useSortableData(records, { key: 'date', direction: 'descending' });

  useEffect(() => {
    fetchClasses();
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    setLoading(true);
    // Fetch is_justified column
    const { data, error } = await supabase
      .from('attendance')
      .select('id, date, status, is_justified, lesson_period, students(full_name), class_subjects(classes(id, name), subjects(name)), profiles(full_name)');

    if (error) toast.error('خطا در بارگذاری گزارش‌ها: ' + error.message);
    else setRecords((data as AttendanceRecord[]) || []);
    setLoading(false);
  };

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('id, name');
    setClasses(data || []);
  };

  const filteredRecords = useMemo(() => {
    if(!sortedItems) return [];
    return sortedItems.filter(record => {
      const searchTermLower = searchTerm.toLowerCase();
      const studentNameMatch = record.students?.full_name?.toLowerCase().includes(searchTermLower) ?? false;
      const classMatch = filterClassId === 'all' || record.class_subjects?.classes?.id === filterClassId;
      const recordDateStr = record.date ? format(parse(record.date, 'yyyy-MM-dd', new Date()), 'yyyy-MM-dd') : null;
      const filterDateStr = date ? format(date, 'yyyy-MM-dd') : null;
      const dateMatch = !date || (recordDateStr && filterDateStr && recordDateStr === filterDateStr);
      const statusMatch = filterStatus === 'all' || record.status === filterStatus;
      // Justification filtering logic
      const justificationMatch = filterJustification === 'all' ||
                                 (filterJustification === 'justified' && record.is_justified === true) ||
                                 (filterJustification === 'unjustified' && record.status === 'absent' && (record.is_justified === false || record.is_justified === null) ); // Treat null as unjustified for filtering 'unjustified'
      return studentNameMatch && classMatch && dateMatch && statusMatch && justificationMatch;
    });
  }, [sortedItems, searchTerm, filterClassId, date, filterStatus, filterJustification]);


  const getStatusBadge = (status: string) => {
    switch (status as AttendanceStatus) {
      case 'present': return <Badge className="bg-green-500 hover:bg-green-600">{statusTranslations.present}</Badge>;
      case 'absent': return <Badge variant="destructive">{statusTranslations.absent}</Badge>;
      case 'late': return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-black">{statusTranslations.late}</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Function to display justification status
  const getJustificationText = (record: AttendanceRecord): string => {
      if (record.status !== 'absent') {
          return justificationTranslations.na; // '-'
      }
      if (record.is_justified === true) {
          return justificationTranslations.justified; // 'موجه'
      }
      // If status is absent and is_justified is false or null, show 'unjustified'
      return justificationTranslations.unjustified; // 'غیر موجه'
  };

   const handleExport = () => {
        if (filteredRecords.length === 0) {
            toast.info('داده‌ای برای خروجی گرفتن وجود ندارد.');
            return;
        }

        const dataToExport = filteredRecords.map(record => ({
            'دانش‌آموز': record.students?.full_name || 'نامشخص',
            'کلاس': record.class_subjects?.classes?.name || 'نامشخص',
            'درس': record.class_subjects?.subjects?.name || 'نامشخص',
            'تاریخ': record.date ? format(parse(record.date, 'yyyy-MM-dd', new Date()), 'yyyy/MM/dd') : 'نامشخص',
            'ساعت': record.lesson_period,
            'وضعیت': statusTranslations[record.status] || record.status,
            'توجیه غیبت': getJustificationText(record), // Use helper function
            'ثبت توسط': record.profiles?.full_name || 'نامشخص',
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'گزارش حضور و غیاب');

        let filename = 'گزارش_حضور_غیاب';
        if (filterClassId !== 'all') {
            const className = classes.find(c => c.id === filterClassId)?.name || 'کلاس_نامشخص';
            filename += `_${className.replace(/\s+/g, '_')}`;
        }
        if (date) {
            filename += `_${format(date, 'yyyy-MM-dd')}`;
        }
        if (filterStatus !== 'all') {
             filename += `_${statusTranslations[filterStatus] || filterStatus}`;
        }
        if (filterJustification !== 'all') {
            filename += `_${justificationTranslations[filterJustification] || filterJustification}`;
        }
        filename += '.xlsx';

        XLSX.writeFile(wb, filename);
        toast.success('فایل اکسل با موفقیت ایجاد شد.');
    };

  const openEditDialog = (record: AttendanceRecord) => {
      setEditingRecord(record);
      setNewStatus(record.status as AttendanceStatus);
      // Initialize justification state based on current record
      // Default to false if absent and currently null
      setNewJustified(record.status === 'absent' ? (record.is_justified ?? false) : false);
      setEditDialogOpen(true);
  };

  const handleUpdateAttendance = async () => {
      if (!editingRecord) return;
      setIsUpdating(true);

      // Prepare update data including is_justified
      // Set justification only if absent, otherwise null to comply with constraint
      const updateData: { status: AttendanceStatus; is_justified: boolean | null } = {
          status: newStatus,
          is_justified: newStatus === 'absent' ? newJustified : null
      };

      const { error } = await supabase
          .from('attendance')
          .update(updateData)
          .eq('id', editingRecord.id);

      if (error) {
          if (error.message.includes('check_justified_status')) {
              toast.error('خطا: نمی‌توان غیبت غیر حاضر را موجه/غیرموجه ثبت کرد.');
          } else {
              toast.error('خطا در ویرایش وضعیت: ' + error.message);
          }
      } else {
          toast.success('وضعیت با موفقیت ویرایش شد.');
          setEditDialogOpen(false);
          fetchRecords(); // Refresh data after successful update
      }
      setIsUpdating(false);
      setEditingRecord(null); // Clear editing record after operation
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
        <CardTitle>گزارش حضور و غیاب</CardTitle>
        <CardDescription>مشاهده، فیلتر، ویرایش و خروجی تمام سوابق حضور و غیاب</CardDescription>
        <div className="flex flex-wrap items-center gap-2 pt-4">
            {/* Search Input */}
            <div className="relative flex-grow min-w-[180px] sm:min-w-[200px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="جستجوی دانش آموز..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" dir="rtl"/></div>
            {/* Class Filter */}
            <Select value={filterClassId} onValueChange={setFilterClassId}><SelectTrigger className="w-full sm:w-[130px]"><SelectValue placeholder="فیلتر کلاس" /></SelectTrigger><SelectContent><SelectItem value="all">همه کلاس‌ها</SelectItem>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
            {/* Status Filter */}
            <Select value={filterStatus} onValueChange={setFilterStatus}><SelectTrigger className="w-full sm:w-[110px]"><SelectValue placeholder="فیلتر وضعیت" /></SelectTrigger><SelectContent><SelectItem value="all">همه وضعیت‌ها</SelectItem><SelectItem value="present">حاضر</SelectItem><SelectItem value="absent">غایب</SelectItem><SelectItem value="late">تأخیر</SelectItem></SelectContent></Select>
            {/* Justification Filter */}
            <Select value={filterJustification} onValueChange={setFilterJustification}><SelectTrigger className="w-full sm:w-[130px]"><SelectValue placeholder="فیلتر توجیه" /></SelectTrigger><SelectContent><SelectItem value="all">همه غیبت‌ها</SelectItem><SelectItem value="justified">موجه</SelectItem><SelectItem value="unjustified">غیر موجه</SelectItem></SelectContent></Select>
            {/* Date Filter */}
             <Popover>
    <PopoverTrigger asChild>
        <Button variant={"outline"} className="w-full sm:w-auto justify-start text-right font-normal">
            <CalendarIcon className="ml-2 h-4 w-4" />
            {date ? format(date, "PPP") : <span>انتخاب تاریخ</span>}
        </Button>
    </PopoverTrigger>
    <PopoverContent className="w-auto p-0">
        <Calendar mode="single" selected={date} onSelect={setDate} />
    </PopoverContent>
</Popover>

            {/* Clear Filters Button */}
             <Button variant="outline" onClick={() => { setSearchTerm(''); setFilterClassId('all'); setDate(undefined); setFilterStatus('all'); setFilterJustification('all'); }}>پاک کردن</Button>
              {/* Export Button */}
             <Button onClick={handleExport} variant="outline" className="gap-2">
                 <FileDown className="w-4 h-4" />
                 خروجی
             </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <div className="text-center py-8">در حال بارگذاری...</div> : (
          <Table dir="rtl">
            <TableHeader>
              <TableRow>
                <TableHead className="text-right"><SortableHeader sortKey="students.full_name">دانش‌آموز</SortableHeader></TableHead>
                <TableHead className="text-right"><SortableHeader sortKey="class_subjects.classes.name">کلاس</SortableHeader></TableHead>
                <TableHead className="text-right"><SortableHeader sortKey="class_subjects.subjects.name">درس</SortableHeader></TableHead>
                <TableHead className="text-right"><SortableHeader sortKey="date">تاریخ</SortableHeader></TableHead>
                <TableHead className="text-right"><SortableHeader sortKey="lesson_period">ساعت</SortableHeader></TableHead>
                <TableHead className="text-right"><SortableHeader sortKey="status">وضعیت</SortableHeader></TableHead>
                <TableHead className="text-right"><SortableHeader sortKey="is_justified">توجیه غیبت</SortableHeader></TableHead>
                <TableHead className="text-right"><SortableHeader sortKey="profiles.full_name">ثبت توسط</SortableHeader></TableHead>
                <TableHead className="text-right w-[50px]">ویرایش</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.length === 0 ? <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">هیچ سابقه‌ای یافت نشد</TableCell></TableRow> : (
                filteredRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{record.students?.full_name || 'نامشخص'}</TableCell>
                    <TableCell>{record.class_subjects?.classes?.name || 'نامشخص'}</TableCell>
                    <TableCell>{record.class_subjects?.subjects?.name || 'نامشخص'}</TableCell>
                    <TableCell>{record.date ? format(parse(record.date, 'yyyy-MM-dd', new Date()), 'yyyy/MM/dd') : 'نامشخص'}</TableCell>
                    <TableCell>{record.lesson_period}</TableCell>
                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                    <TableCell>{getJustificationText(record)}</TableCell> {/* Use helper function */}
                    <TableCell>{record.profiles?.full_name || 'نامشخص'}</TableCell>
                    <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(record)}>
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">ویرایش</span>
                        </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Edit Attendance Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>ویرایش وضعیت حضور و غیاب</DialogTitle>
            <DialogDescription>
              تغییر وضعیت برای دانش آموز "{editingRecord?.students?.full_name}" در تاریخ {editingRecord?.date ? format(parse(editingRecord.date, 'yyyy-MM-dd', new Date()), 'yyyy/MM/dd') : ''}،
              ساعت {editingRecord?.lesson_period}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
              <div className="space-y-2">
                  <Label htmlFor="edit-status">وضعیت جدید</Label>
                  <Select value={newStatus} onValueChange={(value) => setNewStatus(value as AttendanceStatus)}>
                      <SelectTrigger id="edit-status">
                          <SelectValue placeholder="انتخاب وضعیت..." />
                      </SelectTrigger>
                      <SelectContent>
                          {attendanceStatuses.map(status => (
                              <SelectItem key={status} value={status}>{statusTranslations[status]}</SelectItem>
                          ))}
                      </SelectContent>
                  </Select>
              </div>
              {/* Justification Checkbox (visible only when status is 'absent') */}
              {newStatus === 'absent' && (
                  <div className="flex items-center space-x-2 space-x-reverse pt-2">
                      <Checkbox
                          id="edit-justified"
                          checked={newJustified}
                          onCheckedChange={(checked) => setNewJustified(Boolean(checked))} // Ensure boolean value
                      />
                      <Label htmlFor="edit-justified" className="cursor-pointer">
                          غیبت موجه است؟
                      </Label>
                  </div>
              )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>انصراف</Button>
            <Button onClick={handleUpdateAttendance} disabled={isUpdating}>
                {isUpdating ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default AttendanceReports;

