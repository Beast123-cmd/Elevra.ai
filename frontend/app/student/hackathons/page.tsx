import { Suspense } from "react";
import { Hackathons } from "@/components/student/hackathons/Hackathons";
import { StudentLoading, StudentPage } from "@/components/student/StudentPage";

export default function Page() {
  return (
    <StudentPage title="Hackathons" description="Events and contests matched to your branch.">
      <Suspense fallback={<StudentLoading rows={2} />}>
        <Hackathons />
      </Suspense>
    </StudentPage>
  );
}
