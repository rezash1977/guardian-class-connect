import { useState, useMemo, ReactNode } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Upload, FileDown, ArrowRight, ArrowLeft, Loader2, CheckCircle, XCircle } from 'lucide-react';

// Props definition for the component
interface ExcelImportDialogProps {
  triggerButton: ReactNode;
  requiredFields: Record<string, string>;
  onImport: (data: any[]) => Promise<{ success: boolean; errors?: string[] }>;
  templateFileName: string;
}

// Type definitions for internal state
type Step = 'upload' | 'map' | 'preview' | 'result';
type Mapping = Record<string, string>;
type ImportResult = {
  successCount: number;
  errors: { row: number; message: string }[];
};

export const ExcelImportDialog = ({ triggerButton, requiredFields, onImport, templateFileName }: ExcelImportDialogProps) => {
  // Component State
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [data, setData] = useState<any[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Memoized value to check if column mapping is complete
  const isMappingComplete = useMemo(() => {
    const requiredKeys = Object.keys(requiredFields);
    const mappedDbFields = Object.values(mapping);
    return requiredKeys.every(key => mappedDbFields.includes(key));
  }, [mapping, requiredFields]);

  // Reset all states to initial values
  const resetState = () => {
    setStep('upload');
    setFile(null);
    setHeaders([]);
    setData([]);
    setMapping({});
    setIsImporting(false);
    setImportResult(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      parseFile(selectedFile);
    }
  };

  const parseFile = (fileToParse: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        const jsonData = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1, raw: false, defval: null });
        
        if (jsonData.length < 1) {
            toast.error("فایل اکسل خالی است یا سربرگ ندارد.");
            return;
        }

        const fileHeaders = (jsonData[0] as string[]).filter(h => h && h.trim() !== '');
        const fileData = jsonData.slice(1).map(rowArray => {
          const rowObject: { [key: string]: any } = {};
          fileHeaders.forEach((header, index) => {
            const value = (rowArray as any[])[index];
            rowObject[header] = value !== null && value !== undefined ? String(value) : null;
          });
          return rowObject;
        });

        setHeaders(fileHeaders);
        setData(fileData);
        setStep('map');

      } catch (error) {
        toast.error("خطا در پردازش فایل اکسل.");
        resetState();
      }
    };
    reader.readAsArrayBuffer(fileToParse);
  };

  const handleTemplateDownload = () => {
    const ws = XLSX.utils.aoa_to_sheet([Object.keys(requiredFields)]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, templateFileName);
  };
  
  const handleFinalImport = async () => {
    setIsImporting(true);
    const mappedData = data.map(row => {
        const newRow: { [key: string]: any } = {};
        for (const excelHeader in mapping) {
            const dbField = mapping[excelHeader];
            newRow[dbField] = row[excelHeader];
        }
        return newRow;
    });

    const result = await onImport(mappedData);

    if (result.success) {
        setImportResult({ successCount: mappedData.length - (result.errors?.length || 0), errors: result.errors?.map(e => ({row: 0, message: e})) || [] });
    } else {
        setImportResult({ successCount: 0, errors: result.errors?.map(e => ({row: 0, message: e})) || [{row: 0, message: 'یک خطای ناشناخته رخ داد'}] });
    }
    setIsImporting(false);
    setStep('result');
  };

  const getMappedData = () => {
      return data.map(row => {
          const newRow: { [key: string]: any } = {};
          Object.keys(requiredFields).forEach(field => {
              const excelHeader = Object.keys(mapping).find(key => mapping[key] === field);
              newRow[field] = excelHeader ? row[excelHeader] : '';
          });
          return newRow;
      });
  }

  return (
    <Dialog open={open} onOpenChange={isOpen => { setOpen(isOpen); if (!isOpen) resetState(); }}>
      <DialogTrigger asChild>{triggerButton}</DialogTrigger>
      <DialogContent className="sm:max-w-4xl" dir="rtl">
        <DialogHeader>
          <DialogTitle>وارد کردن دسته جمعی از اکسل</DialogTitle>
          <DialogDescription>
            {step === 'upload' && "فایل اکسل خود را بارگذاری کنید. می‌توانید فایل راهنما را برای مشاهده ستون‌های مورد نیاز دانلود کنید."}
            {step === 'map' && "ستون‌های فایل اکسل خود را به فیلدهای مورد نیاز برنامه متصل کنید."}
            {step === 'preview' && "داده‌های خوانده شده را قبل از وارد کردن نهایی بررسی کنید."}
            {step === 'result' && "نتایج عملیات وارد کردن دسته جمعی."}
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="py-8 flex flex-col items-center justify-center border-2 border-dashed rounded-lg space-y-4">
            <Upload className="w-12 h-12 text-muted-foreground" />
            <p className="text-muted-foreground">فایل خود را اینجا بکشید یا برای انتخاب کلیک کنید</p>
            <Input type="file" accept=".xlsx, .xls" onChange={handleFileChange} className="w-auto" />
            <Button variant="link" onClick={handleTemplateDownload} className="gap-2"><FileDown className="w-4 h-4" />دانلود فایل راهنما</Button>
          </div>
        )}

        {step === 'map' && (
          <div className="py-4 space-y-4">
            <h3 className="font-semibold">تطبیق ستون‌ها</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(requiredFields).map(([key, label]) => (
                <div key={key} className="space-y-2">
                  <Label>{label} <span className="text-destructive">*</span></Label>
                  <Select onValueChange={(value) => {
                    setMapping(prev => ({ ...prev, [value]: key }));
                  }}>
                    <SelectTrigger><SelectValue placeholder="انتخاب ستون اکسل..." /></SelectTrigger>
                    <SelectContent>
                      {headers.map(header => (
                        <SelectItem key={header} value={header}>{header}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <DialogFooter className="pt-4">
              <Button variant="outline" onClick={() => setStep('upload')} className="gap-2"><ArrowRight className="w-4 h-4"/>مرحله قبل</Button>
              <Button onClick={() => setStep('preview')} disabled={!isMappingComplete} className="gap-2">ادامه<ArrowLeft className="w-4 h-4"/></Button>
            </DialogFooter>
          </div>
        )}

        {step === 'preview' && (
          <div className="py-4">
              <h3 className="font-semibold mb-4">پیش‌نمایش داده‌ها ({data.length} ردیف)</h3>
              <div className="max-h-96 overflow-auto border rounded-md">
                 <Table>
                    <TableHeader className="sticky top-0 bg-muted">
                        <TableRow>{Object.values(requiredFields).map(label => <TableHead key={label} className="text-right">{label}</TableHead>)}</TableRow>
                    </TableHeader>
                    <TableBody>
                        {getMappedData().slice(0, 10).map((row, index) => (
                            <TableRow key={index}>
                                {Object.keys(requiredFields).map(field => <TableCell key={field}>{row[field]}</TableCell>)}
                            </TableRow>
                        ))}
                    </TableBody>
                 </Table>
              </div>
               {data.length > 10 && <p className="text-sm text-muted-foreground mt-2">فقط ۱۰ ردیف اول برای پیش‌نمایش نمایش داده می‌شود.</p>}
              <DialogFooter className="pt-6">
                <Button variant="outline" onClick={() => setStep('map')} className="gap-2"><ArrowRight className="w-4 h-4"/>مرحله قبل</Button>
                <Button onClick={handleFinalImport} disabled={isImporting} className="gap-2">
                    {isImporting && <Loader2 className="w-4 h-4 animate-spin"/>}
                    تایید و وارد کردن
                </Button>
            </DialogFooter>
          </div>
        )}
        
        {step === 'result' && (
          <div className="py-4 space-y-4">
            <h3 className="font-semibold">نتایج</h3>
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-green-600"><CheckCircle className="w-5 h-5"/>{importResult?.successCount} ردیف با موفقیت وارد شد.</div>
                <div className="flex items-center gap-2 text-red-600"><XCircle className="w-5 h-5"/>{importResult?.errors.length} ردیف با خطا مواجه شد.</div>
            </div>
            {importResult && importResult.errors.length > 0 && (
                <div className="max-h-60 overflow-auto border rounded-md p-4 bg-destructive/10 text-destructive">
                    <h4 className="font-semibold mb-2">جزئیات خطاها:</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                        {importResult.errors.map((err, i) => <li key={i}>{err.message}</li>)}
                    </ul>
                </div>
            )}
            <DialogFooter className="pt-4">
                <DialogClose asChild><Button onClick={resetState}>بستن</Button></DialogClose>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

