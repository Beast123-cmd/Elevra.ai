import { Suspense } from "react";
import { DataHealth } from "@/components/insights/DataHealth";

export default function Page() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-lg font-bold leading-tight tracking-tight">Data Health</h1>
      </header>
      <Suspense fallback={null}>
        <DataHealth />
      </Suspense>
    </div>
  );
}
