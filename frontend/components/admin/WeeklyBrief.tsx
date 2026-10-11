"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { OverviewRow } from "./aggregate";
import { localWeeklyBrief } from "./weeklyText";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; text: string; source: "ai" | "template" | "local"; note?: string };

/** The dean's weekly summary. Figures come from the server; the wording is AI-written only if it passes the fact check. */
export function WeeklyBrief({ rows }: { rows: OverviewRow[] }) {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function generate() {
    setState({ kind: "loading" });
    try {
      const r = await api<{ brief: string; source: "ai" | "template"; reason?: string }>("/admin/weekly-brief");
      setState({ kind: "ready", text: r.brief, source: r.source, note: r.reason });
    } catch {
      setState({ kind: "ready", text: localWeeklyBrief(rows), source: "local", note: "The summary service is offline, so this was built in your browser from the risk counts only." });
    }
  }

  return (
    <Card className="space-y-2 p-4" aria-label="Weekly brief">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h2 className="text-sm font-semibold">This week in brief</h2>
          <p className="text-xs text-muted-foreground">A short summary of who needs support and whether they are being reached.</p>
        </div>
        <Button size="sm" variant="outline" className="print:hidden" disabled={state.kind === "loading"} onClick={generate}>
          {state.kind === "loading" ? "Writing…" : state.kind === "ready" ? "Refresh" : "Write this week's brief"}
        </Button>
        {state.kind === "ready" && <Button size="sm" variant="outline" className="print:hidden" onClick={() => window.print()}>Print</Button>}
      </div>
      {state.kind === "ready" && (
        <>
          <p className="text-sm leading-relaxed">{state.text}</p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className={`rounded-full px-2 py-0.5 ${state.source === "ai" ? "bg-primary/10 text-primary" : "bg-muted"}`}>
              {state.source === "ai" ? "AI-written · every figure checked against the data" : "Standard summary"}
            </span>
            {state.note && <span>{state.note}</span>}
          </div>
        </>
      )}
    </Card>
  );
}
