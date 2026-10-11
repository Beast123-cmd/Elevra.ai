import { Suspense } from "react";
import { Interview } from "@/components/student/Interview";
import { StudentLoading, StudentPage } from "@/components/student/StudentPage";

export default function Page() {
  return (
    <StudentPage width="reading" title="Mock interview" description="Practise with questions shaped by your resume and review feedback at your own pace.">
      <Suspense fallback={<StudentLoading rows={1} />}>
        <Interview />
      </Suspense>
    </StudentPage>
  );
}
