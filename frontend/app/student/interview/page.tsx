import { Suspense } from "react";
import { Interview } from "@/components/student/Interview";

export default function Page() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Mock interview</h1>
        <p className="text-slate-500">Practise with questions from your own resume and see how it moves your placement readiness.</p>
      </header>
      <Suspense fallback={null}>
        <Interview />
      </Suspense>
    </main>
  );
}
