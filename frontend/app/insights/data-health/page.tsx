import { Suspense } from "react";
import { DataHealth } from "@/components/insights/DataHealth";

export default function Page() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-[26px] font-semibold leading-tight tracking-[-0.01em] sm:text-[30px]">Data Health</h1>
        <p className="text-muted-foreground">How seven disconnected campus systems were cleaned and joined into one student record.</p>
      </header>
      <Suspense fallback={null}>
        <DataHealth />
      </Suspense>
    </div>
  );
}
