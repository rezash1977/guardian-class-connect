import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { AlertTriangle, FileUp, ListChecks, FileCheck2, ArrowRight, X } from 'lucide-react';
import * as XLSX from 'xlsx';

type ExcelImportDialogProps = {
  triggerButton: React.ReactNode;
  requiredFields: Record<string, string>;
  onImport: (data: any[]) => Promise<{ success: boolean; errors?: string[] }>;
  templateFileName: string;
};

export const ExcelImportDialog = ({ triggerButton, requiredFields, onImport, templateFileName }: ExcelImportDialogProps) => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [data, setData] = useState<any[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; errors?: string[] } | null>(null);

  const resetState = () => {
    setStep(1);
    setFile(null);
    setHeaders([]);
    setData([]);
    setColumnMapping({});
    setIsImporting(false);
    setImportResult(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (event) => {
        const binaryStr = event.target?.result;
        const workbook = XLSX.read(binaryStr, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (jsonData.length > 0) {
          // Filter out any empty, null, or undefined headers to prevent Select.Item error
          const fileHeaders = (jsonData[0] as any[]).filter(h => h && String(h).trim() !== '').map(h => String(h));
          setHeaders(fileHeaders);
          
          const fileData = XLSX.utils.sheet_to_json(worksheet);
          // Ensure all data is converted to string to avoid type issues like password being a number
          const stringifiedData = fileData.map((row: any) => 
            Object.entries(row).reduce((acc, [key, value]) => {
              acc[key] = String(value);
              return acc;
            }, {} as Record<string, string>)
          );
          setData(stringifiedData);
          setStep(2);
        }
      };
      reader.readAsBinaryString(selectedFile);
    }
  };

  const handleMappingChange = (excelHeader: string, fieldKey: string) => {
      // To ensure a 1-to-1 mapping, we first remove any existing mapping for the selected excelHeader
      const newMapping = { ...columnMapping };
      // Find if another fieldKey was using this excelHeader and remove it
      for (const key in newMapping) {
          if (newMapping[key] === excelHeader) {
              delete newMapping[key];
          }
      }
      // Set the new mapping
      newMapping[fieldKey] = excelHeader;
      setColumnMapping(newMapping);
  };

  const isMappingComplete = useMemo(() => {
    if (!requiredFields || typeof requiredFields !== 'object') {
        return false;
    }
    const requiredFieldKeys = Object.keys(requiredFields);
    return requiredFieldKeys.every((fieldKey) => !!columnMapping[fieldKey]);
  }, [requiredFields, columnMapping]);
  
  const mappedData = useMemo(() => {
    return data.map(row => {
      const newRow: Record<string, any> = {};
      for (const fieldKey in columnMapping) {
        const excelHeader = columnMapping[fieldKey];
        if (excelHeader && row[excelHeader] !== undefined) {
          newRow[fieldKey] = row[excelHeader];
        }
      }
      return newRow;
    });
  }, [data, columnMapping]);

  const handleImportClick = async () => {
    setIsImporting(true);
    const result = await onImport(mappedData);
    setImportResult(result);
    setIsImporting(false);
    setStep(4);
  };
  
  const generateTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([Object.values(requiredFields).reduce((acc, h) => ({...acc, [h]: ''}), {})]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, templateFileName);
  };


  return (
    <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) resetState(); }}>
      <DialogTrigger asChild>{triggerButton}</DialogTrigger>
      <DialogContent className="sm:max-w-[600px]" dir="rtl">
        <DialogHeader>
          <DialogTitle>وارد کردن دسته جمعی داده‌ها</DialogTitle>
          <DialogDescription>
            {step === 1 && "فایل اکسل خود را بارگذاری کنید. می‌توانید فایل راهنما را دانلود کنید."}
            {step === 2 && "ستون‌های فایل اکسل را به فیلدهای مورد نظر متصل کنید."}
            {step === 3 && "پیش‌نمایش داده‌ها را بررسی و در صورت صحت، وارد کردن را تایید کنید."}
            {step === 4 && "نتیجه عملیات وارد کردن دسته جمعی."}
          </DialogDescription>
        </DialogHeader>
        
        {step === 1 && (
          <div className="pt-4 text-center space-y-4">
             <Label htmlFor="excel-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <FileUp className="w-8 h-8 mb-2 text-muted-foreground"/>
                    <p className="mb-2 text-sm text-muted-foreground">برای انتخاب فایل کلیک کنید</p>
                    <p className="text-xs text-muted-foreground">XLSX, XLS, CSV</p>
                </div>
                <input id="excel-upload" type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileChange}/>
            </Label>
            <Button variant="link" onClick={generateTemplate}>دانلود فایل راهنما</Button>
          </div>
        )}

        {step === 2 && (
          <div className="pt-4 space-y-4">
            <p>لطفا برای هر ستون مورد نیاز، سربرگ متناظر در فایل اکسل را انتخاب کنید.</p>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(requiredFields).map(([fieldKey, fieldLabel]) => (
                <div key={fieldKey} className="space-y-2">
                  <Label>{fieldLabel}</Label>
                  <Select value={columnMapping[fieldKey]} onValueChange={(value) => handleMappingChange(value, fieldKey)}>
                    <SelectTrigger><SelectValue placeholder="انتخاب ستون..." /></SelectTrigger>
                    <SelectContent>
                      {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setStep(3)} disabled={!isMappingComplete}>ادامه <ArrowRight className="mr-2 w-4 h-4" /></Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="pt-4 space-y-4">
            <h3 className="font-semibold">پیش نمایش ۵ ردیف اول:</h3>
            <div className="border rounded-md max-h-60 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>{Object.keys(mappedData[0] || {}).map(h => <TableHead key={h}>{requiredFields[h] || h}</TableHead>)}</TableRow>
                </TableHeader>
                <TableBody>
                  {mappedData.slice(0, 5).map((row, i) => (
                    <TableRow key={i}>{Object.keys(row).map(key => <TableCell key={key}>{row[key]}</TableCell>)}</TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Alert>
              <ListChecks className="h-4 w-4" />
              <AlertTitle>توجه</AlertTitle>
              <AlertDescription>
                {data.length} رکورد برای وارد کردن آماده است. لطفاً از صحت نگاشت ستون‌ها و داده‌ها اطمینان حاصل کنید.
              </AlertDescription>
            </Alert>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>بازگشت</Button>
              <Button onClick={handleImportClick} disabled={isImporting}>{isImporting ? "در حال وارد کردن..." : `وارد کردن ${data.length} رکورد`}</Button>
            </div>
          </div>
        )}

        {step === 4 && importResult && (
           <div className="pt-4 space-y-4">
             {importResult.success && (!importResult.errors || importResult.errors.length === 0) ? (
               <Alert variant="default" className="border-green-500">
                 <FileCheck2 className="h-4 w-4 text-green-500"/>
                 <AlertTitle className="text-green-600">عملیات موفق</AlertTitle>
                 <AlertDescription>تمام رکوردها با موفقیت وارد شدند.</AlertDescription>
               </Alert>
             ) : (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>عملیات با خطا مواجه شد</AlertTitle>
                  <AlertDescription>
                    <p>برخی از رکوردها وارد نشدند. دلایل خطا:</p>
                    <ul className="list-disc pr-5 mt-2 space-y-1 text-xs max-h-40 overflow-auto">
                      {importResult.errors?.map((err, i) => <li key={i}>{err}</li>)}
                    </ul>
                  </AlertDescription>
                </Alert>
             )}
             <div className="flex justify-end">
                <Button onClick={() => setOpen(false)}>بستن</Button>
             </div>
           </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

