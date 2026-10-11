import { Suspense } from "react";
import { Segments } from "@/components/insights/Segments";

export default function Page() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-[26px] font-semibold leading-tight tracking-[-0.01em] sm:text-[30px]">Student segments</h1>
        <p className="text-muted-foreground">Groups of students who need the same kind of support, with a recommended action for each.</p>
      </header>
      <Suspense fallback={null}>
        <Segments />
      </Suspense>
    </div>
  );
}
