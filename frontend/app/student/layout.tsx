import { StudentNav } from "@/components/student/StudentNav";
import { StudentProfileProvider } from "@/components/student/StudentProfileProvider";
import { Suspense } from "react";
import { StudentLoading } from "@/components/student/StudentPage";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 md:grid md:grid-cols-[232px_minmax(0,1fr)]">
      <StudentNav />
      <div className="min-w-0">
        <Suspense fallback={<div className="mx-auto w-full max-w-[1120px] px-4 py-7 sm:px-6 lg:px-10"><StudentLoading rows={3} /></div>}>
          <StudentProfileProvider>{children}</StudentProfileProvider>
        </Suspense>
      </div>
    </div>
  );
}
