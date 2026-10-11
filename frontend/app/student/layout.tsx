import { StudentWorkspace } from "@/components/student/StudentWorkspace";
import { StudentProfileProvider } from "@/components/student/StudentProfileProvider";
import { Suspense } from "react";
import { StudentLoading } from "@/components/student/StudentPage";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-[1120px] px-4 py-7 sm:px-6 lg:px-10"><StudentLoading rows={3} /></div>}>
      <StudentProfileProvider>
        <StudentWorkspace>{children}</StudentWorkspace>
      </StudentProfileProvider>
    </Suspense>
  );
}
