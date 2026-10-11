import { Suspense } from "react";
import { Segments } from "@/components/insights/Segments";

export default function Page() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-lg font-bold leading-tight tracking-tight">Student segments</h1>
      </header>
      <Suspense fallback={null}>
        <Segments />
      </Suspense>
    </div>
  );
}
