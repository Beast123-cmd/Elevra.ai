import { Suspense } from "react";
import { StudentHome } from "@/components/student/StudentHome";

export default function Page() {
  return (
    <>
      <Suspense fallback={<div className="mx-auto w-full max-w-[1030px] space-y-4 px-4 py-7 sm:px-6" aria-busy="true"><div className="h-7 w-56 animate-pulse rounded bg-slate-200" /><div className="h-4 w-64 animate-pulse rounded bg-slate-200" /><div className="mt-6 h-48 animate-pulse rounded-lg bg-white" /></div>}>
        <StudentHome />
      </Suspense>
    </>
  );
}
