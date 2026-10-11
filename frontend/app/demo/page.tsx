import { DemoGuide } from "./DemoGuide";

export default function Page() {
  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Guided demo</h1>
        <p className="text-slate-500">
          Colleges keep student data in seven disconnected systems, so nobody sees a struggling student until results arrive.
          These six steps show how Elevra.ai finds them early, explains why, and helps close the loop.
        </p>
      </header>
      <DemoGuide />
    </main>
  );
}
