import { Suspense } from "react";
import Link from "next/link";
import { InterviewProgress } from "@/components/student/coach/InterviewProgress";
import { StudentLoading, StudentPage } from "@/components/student/StudentPage";

export default function Page() {
  return (
    <StudentPage title="My interview progress" description="Your mock interview history, focus areas and practice plan.">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[#172824]">My interview progress</h2>
          <p className="text-sm text-slate-500">Every mock interview, what to focus on, and how you&apos;re improving.</p>
        </div>
        <Link href="/student/interview" className="rounded-lg bg-[#18574e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#12473f]">New interview</Link>
      </div>
      <Suspense fallback={<StudentLoading rows={4} />}>
        <InterviewProgress />
      </Suspense>
    </StudentPage>
  );
}
