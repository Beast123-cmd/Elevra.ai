import { Suspense } from "react";
import { StudentHome } from "@/components/student/StudentHome";
import { StudentLoading } from "@/components/student/StudentPage";

export default function Page() {
  return (
    <>
      <Suspense fallback={<div className="mx-auto w-full max-w-[1120px] px-4 py-5 sm:px-6 lg:px-10"><StudentLoading rows={3} /></div>}>
        <StudentHome />
      </Suspense>
    </>
  );
}
