import { Suspense } from "react";
import { StudentHome } from "@/components/student/StudentHome";

export default function Page() {
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">My dashboard</h1>
        <p className="text-slate-500">Where you stand today, and what would move your score the most.</p>
      </header>
      <Suspense fallback={null}>
        <StudentHome />
      </Suspense>
    </main>
  );
}
