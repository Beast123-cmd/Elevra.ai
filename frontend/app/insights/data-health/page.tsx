import { Suspense } from "react";
import { DataHealth } from "@/components/insights/DataHealth";

export default function Page() {
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Data Health</h1>
        <p className="text-slate-500">How seven disconnected campus systems were cleaned and joined into one student record.</p>
      </header>
      <Suspense fallback={null}>
        <DataHealth />
      </Suspense>
    </main>
  );
}
