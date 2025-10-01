import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogOut, Users, GraduationCap, School, FileText, AlertTriangle } from 'lucide-react';
import TeachersManagement from './admin/TeachersManagement';
import ClassesManagement from './admin/ClassesManagement';
import StudentsManagement from './admin/StudentsManagement';
import AttendanceReports from './admin/AttendanceReports';
import DisciplineReports from './admin/DisciplineReports';

const AdminDashboard = () => {
  const { signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('teachers');

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center">
              <School className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">پنل مدیریت</h1>
              <p className="text-sm text-muted-foreground">مدیریت کامل مدرسه</p>
            </div>
          </div>
          <Button onClick={signOut} variant="outline" className="gap-2">
            <LogOut className="w-4 h-4" />
            خروج
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6" dir="rtl">
          <TabsList className="grid w-full grid-cols-5 h-auto p-1 bg-card shadow-sm">
            <TabsTrigger value="teachers" className="flex items-center gap-2 py-3">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">معلم‌ها</span>
            </TabsTrigger>
            <TabsTrigger value="classes" className="flex items-center gap-2 py-3">
              <School className="w-4 h-4" />
              <span className="hidden sm:inline">کلاس‌ها</span>
            </TabsTrigger>
            <TabsTrigger value="students" className="flex items-center gap-2 py-3">
              <GraduationCap className="w-4 h-4" />
              <span className="hidden sm:inline">دانش‌آموزان</span>
            </TabsTrigger>
            <TabsTrigger value="attendance" className="flex items-center gap-2 py-3">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">حضور و غیاب</span>
            </TabsTrigger>
            <TabsTrigger value="discipline" className="flex items-center gap-2 py-3">
              <AlertTriangle className="w-4 h-4" />
              <span className="hidden sm:inline">موارد انضباطی</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="teachers" className="space-y-4">
            <TeachersManagement />
          </TabsContent>

          <TabsContent value="classes" className="space-y-4">
            <ClassesManagement />
          </TabsContent>

          <TabsContent value="students" className="space-y-4">
            <StudentsManagement />
          </TabsContent>

          <TabsContent value="attendance" className="space-y-4">
            <AttendanceReports />
          </TabsContent>

          <TabsContent value="discipline" className="space-y-4">
            <DisciplineReports />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminDashboard;
