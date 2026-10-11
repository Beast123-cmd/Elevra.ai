import { Suspense } from "react";
import { AppShell } from "@/components/shared/shell/AppShell";
import { StudentProfileProvider } from "@/components/student/StudentProfileProvider";
import { StudentLoading } from "@/components/student/StudentPage";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <Suspense fallback={<StudentLoading rows={3} />}>
        <StudentProfileProvider>{children}</StudentProfileProvider>
      </Suspense>
    </AppShell>
  );
}
