import { DemoGuide } from "./DemoGuide";

export default function Page() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="font-serif text-[26px] font-semibold leading-tight tracking-[-0.01em] sm:text-[30px]">Guided demo</h1>
        <p className="text-muted-foreground">
          Colleges keep student data in seven disconnected systems, so nobody sees a struggling student until results arrive.
          These six steps show how Elevra.ai finds them early, explains why, and helps close the loop.
        </p>
      </header>
      <DemoGuide />
    </div>
  );
}
