import { FacultyAssistant } from "@/components/insights/assistant/FacultyAssistant";

export default function Page() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-[26px] font-semibold leading-tight tracking-[-0.01em] sm:text-[30px]">Ask Elevra</h1>
        <p className="text-muted-foreground">Questions about trends, risks and who needs help, answered from live data with a chart and suggested actions.</p>
      </header>
      <FacultyAssistant />
    </div>
  );
}
