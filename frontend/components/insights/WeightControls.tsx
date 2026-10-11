"use client";

import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { usePalette } from "@/components/shared/palette";
import { PILLARS, type Pillar } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface Scored { student_id: string; score: number; band: string }
type Run = { status: "idle" } | { status: "running" } | { status: "offline" } | { status: "done"; rows: Scored[]; weights: Record<Pillar, number> };

const BAND_ORDER = ["Thriving", "On Track", "Needs Attention", "Critical"];

export function WeightControls({ defaults, labels, current }: {
  defaults: Record<Pillar, number>; labels: Record<Pillar, string>; current: Scored[];
}) {
  const palette = usePalette();
  const [weights, setWeights] = useState<Record<Pillar, number>>(defaults);
  const [run, setRun] = useState<Run>({ status: "idle" });
  const total = PILLARS.reduce((a, p) => a + weights[p], 0);
  const isDefault = PILLARS.every((p) => weights[p] === defaults[p]);

  async function recalculate() {
    if (run.status === "running" || total <= 0) return;
    setRun({ status: "running" });
    try {
      const rows = await api<Scored[]>("/rescore", { weights });
      setRun({ status: "done", rows, weights });
    } catch {
      setRun({ status: "offline" });
    }
  }

  function reset() { setWeights(defaults); setRun({ status: "idle" }); }

  const summary = useMemo(() => {
    if (run.status !== "done") return null;
    const before = new Map(current.map((r) => [r.student_id, r]));
    const count = (rows: Scored[]) => Object.fromEntries(BAND_ORDER.map((b) => [b, rows.filter((r) => r.band === b).length]));
    const moved = run.rows.filter((r) => before.has(r.student_id) && before.get(r.student_id)!.band !== r.band).length;
    const avg = (rows: Scored[]) => rows.reduce((a, r) => a + r.score, 0) / Math.max(rows.length, 1);
    return { before: count(current), after: count(run.rows), moved, avgBefore: avg(current), avgAfter: avg(run.rows), n: run.rows.length };
  }, [run, current]);

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-4">
        {PILLARS.map((p) => (
          <div key={p}>
            <div className="mb-2 flex justify-between text-sm">
              <label htmlFor={`w-${p}`}>{labels[p]}</label>
              <span className="tabular-nums text-muted-foreground">
                {total > 0 ? `${Math.round((weights[p] / total) * 100)}% of score` : "—"}
                {weights[p] !== defaults[p] && <span className="ml-2 text-xs text-muted-foreground">default {Math.round(defaults[p] * 100)}%</span>}
              </span>
            </div>
            <Slider id={`w-${p}`} aria-label={`${labels[p]} weight`} min={0} max={0.5} step={0.05} value={[weights[p]]}
              onValueChange={([v]) => setWeights((w) => ({ ...w, [p]: v }))} />
          </div>
        ))}
        {total <= 0 && <p className="text-sm text-risk-red">At least one weight must be above zero.</p>}
        <div className="flex flex-wrap gap-3">
          <Button onClick={recalculate} disabled={run.status === "running" || total <= 0}>
            {run.status === "running" ? "Recalculating 1,500 students…" : "Recalculate scores"}
          </Button>
          <Button variant="outline" onClick={reset} disabled={isDefault && run.status === "idle"}>Reset to defaults</Button>
        </div>
        <p className="text-xs text-muted-foreground">Weights are shares of the score, so they are rescaled to add up to 100%. Nothing is saved: this is a sandbox.</p>
      </div>

      <div aria-live="polite" className="rounded-lg border bg-muted/50 p-5">
        {run.status === "idle" && <p className="text-sm text-muted-foreground">Adjust the weights and press Recalculate to see how bands would shift across the cohort.</p>}
        {run.status === "running" && <p className="text-sm text-muted-foreground">Re-scoring every student with the shared scoring engine…</p>}
        {run.status === "offline" && (
          <p role="alert" className="text-sm text-foreground">
            <span className="font-medium">Re-scoring is offline.</span> The scoring service couldn&apos;t be reached. Everything else on this page still works.
          </p>
        )}
        {summary && (
          <div className="space-y-4">
            <div>
              <p className="text-3xl font-semibold tabular-nums">{summary.moved.toLocaleString("en-IN")}</p>
              <p className="text-sm text-muted-foreground">of {summary.n.toLocaleString("en-IN")} students would change band</p>
            </div>
            <p className="text-sm">
              Average score {summary.avgBefore.toFixed(1)} → <span className="font-medium">{summary.avgAfter.toFixed(1)}</span>
            </p>
            <table className="w-full text-sm tabular-nums">
              <thead className="text-left text-xs text-muted-foreground">
                <tr><th className="py-1">Band</th><th className="text-right">Now</th><th className="text-right">With these weights</th></tr>
              </thead>
              <tbody>
                {BAND_ORDER.map((b) => {
                  const d = summary.after[b] - summary.before[b];
                  return (
                    <tr key={b} className="border-t">
                      <td className="py-1.5"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: palette.band[b] }} />{b}</td>
                      <td className="text-right">{summary.before[b]}</td>
                      <td className="text-right">{summary.after[b]} <span className="text-xs text-muted-foreground">({d >= 0 ? "+" : ""}{d})</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
