import { Suspense } from "react";
import { Improve } from "@/components/student/Improve";

export default function Page() {
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Your path to improve</h1>
        <p className="text-slate-500">Three concrete steps for each of your weakest areas.</p>
      </header>
      <Suspense fallback={null}>
        <Improve />
      </Suspense>
    </main>
  );
}
