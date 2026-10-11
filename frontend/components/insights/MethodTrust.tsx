"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BAND_COLOR } from "@/lib/format";
import { PILLARS, type Cohort, type Pillar } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LeadTimeChart } from "./LeadTimeChart";
import { MODEL_LABEL, type EvalMetrics, type ModelCardFull } from "./method-types";
import { WeightControls } from "./WeightControls";

interface Scored { student_id: string; score: number; band: string }
interface Data { model: ModelCardFull | null; cohort: Cohort | null; isAdmin: boolean; current: Scored[] }
type State = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: Data };

const PAGE = 1000;
const HOW: Record<Pillar, string> = {
  academic: "60% CGPA, 40% current internal marks, minus 5 points per active backlog",
  attendance: "Overall attendance this semester (weeks 1–8)",
  lms: "Assignment submission, share of active weeks, and time spent on the LMS",
  placement: "35% aptitude, 40% coding, 25% mock-interview average",
  skills: "50% technical, 30% soft skills, 20% verified certifications",
  engagement: "Verified events, clubs and hackathons",
  feedback: "Student satisfaction and faculty rating",
};
const pct = (v: number | null | undefined, d = 0) => (v === null || v === undefined ? "—" : `${(v * 100).toFixed(d)}%`);

async function load(): Promise<Data> {
  const sb = createClient();
  const [{ data: auth }, an] = await Promise.all([sb.auth.getUser(), sb.from("analytics").select("key,payload").in("key", ["model", "cohort"])]);
  if (an.error) throw new Error(an.error.message);
  const get = (k: string) => an.data?.find((r) => r.key === k)?.payload ?? null;
  const isAdmin = auth.user?.app_metadata?.role === "admin";
  const current: Scored[] = [];
  if (isAdmin) {
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await sb.from("scores").select("student_id,success_score,band").order("student_id").range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      current.push(...(data ?? []).map((r) => ({ student_id: r.student_id, score: Number(r.success_score), band: r.band })));
      if ((data?.length ?? 0) < PAGE) break;
    }
  }
  return { model: get("model") as ModelCardFull | null, cohort: get("cohort") as Cohort | null, isAdmin, current };
}

/** Plain-language comparison of model vs baseline, so the page never overstates the model. */
function verdict(m: EvalMetrics, b: EvalMetrics): string {
  const aucGap = m.auc - b.auc;
  const ranking = Math.abs(aucGap) < 0.02
    ? `ranks students about as well as the simple rule (AUC ${m.auc.toFixed(3)} vs ${b.auc.toFixed(3)})`
    : aucGap > 0 ? `ranks students better than the simple rule (AUC ${m.auc.toFixed(3)} vs ${b.auc.toFixed(3)})`
      : `ranks students worse than the simple rule (AUC ${m.auc.toFixed(3)} vs ${b.auc.toFixed(3)})`;
  const alarms = m.precision >= b.precision ? `raises fewer false alarms (precision ${pct(m.precision)} vs ${pct(b.precision)})` : `raises more false alarms (precision ${pct(m.precision)} vs ${pct(b.precision)})`;
  const misses = m.recall >= b.recall ? `catches more struggling students (recall ${pct(m.recall)} vs ${pct(b.recall)})` : `misses more struggling students (recall ${pct(m.recall)} vs ${pct(b.recall)})`;
  return `The model ${ranking}. It ${alarms} but ${misses}. That is why risk flags combine the model with transparent rules rather than relying on it alone.`;
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function View({ data }: { data: Data }) {
  const { model, cohort, isAdmin, current } = data;
  const weights = cohort?.weights;
  const labels = cohort?.pillar_labels;
  const metrics = model?.metrics as (EvalMetrics & ModelCardFull["metrics"]) | undefined;
  const baseline = metrics?.baseline as (EvalMetrics & { rule: string }) | undefined;
  const bandsDesc = [...(cohort?.bands ?? [])].sort((a, b) => b.min - a.min);

  const fairnessGroups = Array.from(new Set((model?.fairness ?? []).map((f) => f.group_type)));
  const gaps = fairnessGroups.map((g) => {
    const rates = (model?.fairness ?? []).filter((f) => f.group_type === g && f.flag_rate !== null).map((f) => f.flag_rate as number);
    return { g, gap: rates.length > 1 ? Math.max(...rates) - Math.min(...rates) : 0 };
  });

  return (
    <div className="space-y-6">
      <Section title="How the Success Score works" description="Seven areas, each scored 0–100 on an absolute scale, then combined with fixed weights.">
        {weights && labels ? (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Area</TableHead><TableHead className="text-right">Weight</TableHead><TableHead>How it is measured</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {PILLARS.map((p) => (
                    <TableRow key={p}>
                      <TableCell className="font-medium">{labels[p]}</TableCell>
                      <TableCell className="text-right tabular-nums">{Math.round(weights[p] * 100)}%</TableCell>
                      <TableCell className="text-slate-600">{HOW[p]}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul className="space-y-1 text-sm text-slate-600">
              <li><span className="font-medium text-slate-900">Missing data is never scored as zero.</span> That area is left out and the remaining weights are rescaled. Confidence shows how much of the weight had data.</li>
              <li>
                <span className="font-medium text-slate-900">Bands:</span>{" "}
                {bandsDesc.map((b, i) => (
                  <span key={b.name}>{i > 0 && " · "}<span style={{ color: BAND_COLOR[b.name] }}>{b.name}</span> {b.min > 0 ? `${b.min}+` : `below ${bandsDesc[i - 1]?.min}`}</span>
                ))}
              </li>
            </ul>
          </div>
        ) : <p className="text-sm text-slate-500">Score settings haven&apos;t been published yet.</p>}
      </Section>

      {weights && labels && (
        <Section title="Try different weights" description="See how the cohort would shift if the institution weighted the areas differently. Uses the same scoring engine as the live scores.">
          {isAdmin ? (
            current.length > 0 ? <WeightControls defaults={weights} labels={labels} current={current} />
              : <p className="text-sm text-slate-500">No scored students yet.</p>
          ) : <p className="text-sm text-slate-500">Only administrators can try different weights.</p>}
        </Section>
      )}

      <Section title="Does the early-warning model work?" description={metrics ? `${metrics.target}. Trained on ${metrics.n_train?.toLocaleString("en-IN")} students, tested on ${metrics.n_test?.toLocaleString("en-IN")} held-out students they had never seen.` : undefined}>
        {metrics && baseline ? (
          <div className="space-y-4">
            <p className="rounded-md bg-slate-50 p-3 text-sm">{verdict(metrics, baseline)}</p>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Measure</TableHead>
                    <TableHead className="text-right">Model ({MODEL_LABEL[model?.algorithm ?? ""] ?? model?.algorithm ?? "chosen"})</TableHead>
                    <TableHead className="text-right">Baseline: {baseline.rule}</TableHead>
                    <TableHead>What it means</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {([
                    ["AUC", metrics.auc.toFixed(3), baseline.auc.toFixed(3), "How well it ranks at-risk students above others (0.5 = chance)"],
                    ["Precision", pct(metrics.precision), pct(baseline.precision), "Of the students flagged, how many really struggled"],
                    ["Recall", pct(metrics.recall), pct(baseline.recall), "Of the students who struggled, how many were flagged"],
                    ["F1", metrics.f1.toFixed(3), baseline.f1.toFixed(3), "Balance of precision and recall"],
                  ] as const).map(([k, mv, bv, help]) => (
                    <TableRow key={k}>
                      <TableCell className="font-medium">{k}</TableCell>
                      <TableCell className="text-right tabular-nums">{mv}</TableCell>
                      <TableCell className="text-right tabular-nums">{bv}</TableCell>
                      <TableCell className="text-slate-600">{help}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-slate-500">Base rate: {pct(metrics.base_rate)} of test students failed at least one subject. Training window: {metrics.train_window}.</p>
          </div>
        ) : <p className="text-sm text-slate-500">The model hasn&apos;t been trained yet. Risk flags use the transparent rules only.</p>}
      </Section>

      {model?.candidates && model.candidates.length > 0 && (
        <Section title="Which model we chose, and why" description={model.selection_method}>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead><TableHead className="text-right">Cross-validated AUC</TableHead><TableHead className="text-right">Test AUC</TableHead>
                  <TableHead className="text-right">Precision</TableHead><TableHead className="text-right">Recall</TableHead><TableHead className="text-right">F1</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {model.candidates.map((c) => (
                  <TableRow key={c.name}>
                    <TableCell className="font-medium">
                      {MODEL_LABEL[c.name] ?? c.name}
                      {c.name === model.algorithm && <Badge className="ml-2">Chosen</Badge>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{c.metrics.cv_auc?.toFixed(3) ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.metrics.auc.toFixed(3)}</TableCell>
                    <TableCell className="text-right tabular-nums">{pct(c.metrics.precision)}</TableCell>
                    <TableCell className="text-right tabular-nums">{pct(c.metrics.recall)}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.metrics.f1.toFixed(3)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Section>
      )}

      <Section title="Warning signs appear weeks before results" description="Average weekly activity of students who went on to fail a subject, compared with those who passed.">
        <LeadTimeChart data={cohort?.lead_time ?? []} />
      </Section>

      <Section title="Fairness check" description="Does the model flag some groups more than others? Compared on the held-out test students.">
        {model?.fairness?.length ? (
          <div className="space-y-3">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Group</TableHead><TableHead className="text-right">Students</TableHead><TableHead className="text-right">Flagged</TableHead>
                    <TableHead className="text-right">Recall</TableHead><TableHead className="text-right">False alarm rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {model.fairness.map((f) => (
                    <TableRow key={`${f.group_type}-${f.group}`}>
                      <TableCell><span className="text-slate-500">{f.group_type === "residence" ? "Residence" : f.group_type === "gender" ? "Gender" : f.group_type}:</span> <span className="font-medium">{f.group}</span></TableCell>
                      <TableCell className="text-right tabular-nums">{f.n}</TableCell>
                      <TableCell className="text-right tabular-nums">{pct(f.flag_rate, 1)}</TableCell>
                      <TableCell className="text-right tabular-nums">{pct(f.recall, 1)}</TableCell>
                      <TableCell className="text-right tabular-nums">{pct(f.fpr, 1)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul className="space-y-1 text-sm text-slate-600">
              {gaps.map(({ g, gap }) => (
                <li key={g}>
                  By {g}: flag rates differ by {(gap * 100).toFixed(1)} percentage points
                  {gap > 0.05 ? ", which is large enough to review before relying on the flags." : ", which is small."}
                </li>
              ))}
            </ul>
          </div>
        ) : <p className="text-sm text-slate-500">No fairness results yet.</p>}
      </Section>

      <Section title="Limitations and responsible use">
        <ul className="list-inside list-disc space-y-2 text-sm text-slate-700">
          <li><span className="font-medium">Synthetic data.</span> {model?.provenance ?? "All students and records are generated for this prototype."} The numbers above show the method works as designed, not how it would perform at a real college.</li>
          <li><span className="font-medium">Small test set.</span> Results come from {metrics?.n_test ?? "a few hundred"} held-out students, so small differences between models are within noise.</li>
          <li><span className="font-medium">A flag means &ldquo;needs a check-in&rdquo;</span>, never &ldquo;will fail&rdquo;. Every flag lists the reasons behind it so a mentor can judge it.</li>
          <li><span className="font-medium">No placement prediction model.</span> There are no real placement outcomes to learn from, so placement risk uses transparent rules only.</li>
          <li><span className="font-medium">Missing data lowers confidence, not the score.</span> Students without placement data are shown as &ldquo;not yet assessed&rdquo;.</li>
          <li><span className="font-medium">Fairness is checked for residence and gender only.</span> Other groups could still be affected and should be reviewed with real data.</li>
          <li><span className="font-medium">Decision support, not decisions.</span> Mentors and faculty decide what to do; the platform only helps them decide whom to talk to first.</li>
        </ul>
      </Section>
    </div>
  );
}

export function MethodTrust() {
  const [state, setState] = useState<State>({ status: "loading" });
  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => !cancelled && setState({ status: "ready", data }))
      .catch((e: Error) => !cancelled && setState({ status: "error", message: e.message }));
    return () => { cancelled = true; };
  }, []);

  if (state.status === "loading") {
    return <div className="space-y-4" aria-busy="true"><Skeleton className="h-64" /><Skeleton className="h-48" /><Skeleton className="h-72" /></div>;
  }
  if (state.status === "error") {
    return (
      <Card role="alert">
        <CardHeader>
          <CardTitle>Couldn&apos;t load Method &amp; Trust</CardTitle>
          <CardDescription>{state.message}. Check that you are signed in and try again.</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  return <View data={state.data} />;
}
