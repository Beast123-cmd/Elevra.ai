import { Suspense } from "react";
import { Certifications } from "@/components/student/Certifications";
import { StudentLoading, StudentPage } from "@/components/student/StudentPage";

export default function Page() {
  return (
    <StudentPage title="Certifications" description="Learning options that match your department and current development areas.">
      <Suspense fallback={<StudentLoading rows={3} />}>
        <Certifications />
      </Suspense>
    </StudentPage>
  );
}
