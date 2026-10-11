import { Suspense } from "react";
import { Hackathons } from "@/components/student/hackathons/Hackathons";

export default function Page() {
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Hackathons</h1>
        <p className="text-slate-500">Hackathons and contests across institutes, with the ones that suit your branch first.</p>
      </header>
      <Suspense fallback={null}>
        <Hackathons />
      </Suspense>
    </main>
  );
}
