import { Suspense } from "react";
import { AppShell } from "@/components/shared/shell/AppShell";
import { StudentAssistant } from "@/components/student/assistant/StudentAssistant";
import { Interview } from "@/components/student/Interview";
import { StudentProfileProvider } from "@/components/student/StudentProfileProvider";
import { StudentLoading } from "@/components/student/StudentPage";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <Suspense fallback={<StudentLoading rows={3} />}>
        <StudentProfileProvider>
          {children}
          {/* mounted once here so a running mock interview survives moving between pages */}
          <Interview />
          <StudentAssistant />
        </StudentProfileProvider>
      </Suspense>
    </AppShell>
  );
}
