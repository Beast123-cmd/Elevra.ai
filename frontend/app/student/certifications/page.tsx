import { Suspense } from "react";
import { Certifications } from "@/components/student/Certifications";

export default function Page() {
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Suggested certifications</h1>
        <p className="text-slate-500">Courses chosen for your department and your weakest areas.</p>
      </header>
      <Suspense fallback={null}>
        <Certifications />
      </Suspense>
    </main>
  );
}
