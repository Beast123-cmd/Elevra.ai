import { FacultyAssistant } from "@/components/insights/assistant/FacultyAssistant";

export default function Page() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-lg font-bold leading-tight tracking-tight">Ask Elevra</h1>
      </header>
      <FacultyAssistant />
    </div>
  );
}
