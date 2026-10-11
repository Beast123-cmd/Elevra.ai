import { AnnualEvents } from "@/components/student/hackathons/Hackathons";
import { StudentPage } from "@/components/student/StudentPage";

export default function AnnualEventsPage() {
  return (
    <StudentPage title="Annual events & platforms" description="Recurring competitions and platforms worth planning for.">
      <AnnualEvents />
    </StudentPage>
  );
}
