import { Suspense } from "react";
import { Notifications } from "@/components/student/Notifications";
import { StudentLoading, StudentPage } from "@/components/student/StudentPage";

export default function Page() {
  return (
    <StudentPage width="reading" title="Inbox" description="Placement drives and campus announcements shared with you.">
      <Suspense fallback={<StudentLoading rows={2} />}>
        <Notifications />
      </Suspense>
    </StudentPage>
  );
}
