"use client";
import { useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { Profile } from "@/lib/types";
import { localBrief } from "./briefTemplate";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; text: string; source: "ai" | "template" | "local"; note?: string };

/** One-paragraph mentor brief. AI-written when available; otherwise the standard summary, even if the API is down. */
export function BriefCard({ profile }: { profile: Profile }) {
  const [state, setState] = useState<State>({ kind: "idle" });

  // a different student must never show the previous student's brief
  useEffect(() => setState({ kind: "idle" }), [profile.student_id]);

  async function generate() {
    setState({ kind: "loading" });
    try {
      const r = await api<{ brief: string; source: "ai" | "template"; reason?: string }>(`/briefs/${profile.student_id}`, {});
      setState({ kind: "ready", text: r.brief, source: r.source, note: r.reason });
    } catch {
      setState({ kind: "ready", text: localBrief(profile), source: "local", note: "The brief service is offline, so this summary was built in your browser from the student's data." });
    }
  }

  const label = (s: "ai" | "template" | "local") => (s === "ai" ? "AI-written · every figure checked against the profile" : "Standard summary");

  return (
    <Card data-motion-card className="rounded-xl border-border shadow-sm shadow-slate-900/[0.02] space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h2 className="text-sm font-semibold">Mentor brief</h2>
          <p className="text-xs text-muted-foreground">A short summary to prepare for your conversation with this student.</p>
        </div>
        <Button size="sm" variant="outline" disabled={state.kind === "loading"} onClick={generate}>
          {state.kind === "loading" ? "Writing…" : state.kind === "ready" ? "Regenerate" : "Generate brief"}
        </Button>
      </div>
      {state.kind === "ready" && (
        <div className="space-y-2">
          <p className="max-w-4xl text-[15px] leading-relaxed">{state.text}</p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className={`rounded-full px-2 py-0.5 ${state.source === "ai" ? "bg-primary/10 text-primary" : "bg-muted"}`}>{label(state.source)}</span>
            {state.note && <span>{state.note}</span>}
            <Button size="sm" variant="outline" className="ml-auto h-9 gap-2" onClick={() => navigator.clipboard.writeText(state.text).then(() => toast.success("Brief copied"), () => toast.error("Could not copy"))}>
              <Copy className="h-4 w-4" aria-hidden="true" />Copy brief
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
