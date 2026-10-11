import { Suspense } from "react";
import { Segments } from "@/components/insights/Segments";

export default function Page() {
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Student segments</h1>
        <p className="text-slate-500">Groups of students who need the same kind of support, with a recommended action for each.</p>
      </header>
      <Suspense fallback={null}>
        <Segments />
      </Suspense>
    </main>
  );
}
