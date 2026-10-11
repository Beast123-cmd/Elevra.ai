import { Suspense } from "react";
import { Improve } from "@/components/student/Improve";
import { StudentLoading, StudentPage } from "@/components/student/StudentPage";

export default function Page() {
  return (
    <StudentPage title="My plan" description="A few practical steps based on the areas that could use attention.">
      <Suspense fallback={<StudentLoading rows={2} />}>
        <Improve />
      </Suspense>
    </StudentPage>
  );
}
