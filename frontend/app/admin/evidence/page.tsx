"use client";
import { useMemo, useState } from "react";
import { fetchAllRows } from "@/components/admin/paginate";
import {
  byDepartment, classify, DEFAULT_THRESHOLDS, learnersCsv, mentorAllocation, mentorsCsv, slowLearnerSupport, supportCsv, supportSummary,
  type Learner, type SupportRow, type Thresholds,
} from "@/components/admin/evidence";
import { EmptyState } from "@/components/shared/Kpi";
import { Ring, ShareBar } from "@/components/shared/viz";
import { useCachedQuery } from "@/components/shared/useCachedQuery";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";

interface Raw { student_id: string; academic: number | null; success_score: number; students: { name: string; department: string; year: number; mentor_faculty_id: string | null } }
interface Faculty { faculty_id: string; name: string; department: string }

async function load() {
  const supabase = createClient();
  const [raw, support, faculty] = await Promise.all([
    fetchAllRows<Raw>((from, to) =>
      supabase.from("scores").select("student_id,academic,success_score,students!inner(name,department,year,mentor_faculty_id)").order("student_id").range(from, to) as never),
    fetchAllRows<SupportRow>((from, to) =>
      supabase.from("interventions").select("id,student_id,faculty_id,type,status,created_at,is_seeded").order("id").range(from, to) as never),
    supabase.from("faculty").select("faculty_id,name,department").order("faculty_id").then((r) => (r.data ?? []) as Faculty[]),
  ]);
  const learners: Learner[] = raw.map(({ students, academic, ...r }) => ({
    ...r, ...students, academic: academic == null ? null : Number(academic), success_score: Number(r.success_score),
  }));
  return { learners, support, faculty };
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}
const FIELD = "w-20 rounded-md border border-input px-2 py-1 text-sm";
const th = "py-1 pr-3";

export default function EvidencePage() {
  const { data, error, loading } = useCachedQuery("admin:evidence", load);
  const [t, setT] = useState<Thresholds>(DEFAULT_THRESHOLDS);

  const view = useMemo(() => {
    if (!data) return null;
    return {
      dept: byDepartment(data.learners, t), mentors: mentorAllocation(data.learners, data.faculty),
      support: supportSummary(data.support), slowSupport: slowLearnerSupport(data.learners, data.support, t),
    };
  }, [data, t]);

  if (error) return <EmptyState>Could not load the evidence: {error}</EmptyState>;
  if (loading || !data || !view) return <Skeleton className="h-96 w-full" />;
  const { dept, mentors, support, slowSupport } = view;
  const num = (v: string, fallback: number) => (Number.isFinite(Number(v)) && v !== "" ? Math.min(100, Math.max(0, Number(v))) : fallback);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold leading-tight tracking-tight">Accreditation evidence</h1>
        </div>
        <Button size="sm" variant="outline" className="print:hidden" onClick={() => window.print()}>Print this page</Button>
      </div>

      <Card data-motion-card className="rounded-xl border-border shadow-sm shadow-slate-900/[0.02] p-4 print:border-0">
        <h2 className="text-sm font-semibold">How learners are identified</h2>
        <p className="text-xs text-muted-foreground">
          Each student&apos;s academic score (0 to 100) combines marks, backlogs and trend. Slow learners score below the first cut-off; advanced learners above the second. Change the cut-offs to match your policy.
        </p>
        <div className="mt-2 flex flex-wrap gap-4 text-sm print:hidden">
          <label className="grid gap-1">Slow learner below<input aria-label="Slow learner below" className={FIELD} type="number" value={t.slowBelow} onChange={(e) => setT({ ...t, slowBelow: num(e.target.value, 50) })} /></label>
          <label className="grid gap-1">Advanced learner above<input aria-label="Advanced learner above" className={FIELD} type="number" value={t.advancedAbove} onChange={(e) => setT({ ...t, advancedAbove: num(e.target.value, 75) })} /></label>
        </div>
        <p className="mt-2 hidden text-xs print:block">Cut-offs: slow below {t.slowBelow}, advanced above {t.advancedAbove}.</p>
      </Card>

      <section className="grid gap-5 rounded-lg border border-border bg-card p-5 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold">{dept.all.total.toLocaleString()} students by learning level</h2>
          <p className="mb-3 text-[13px] text-muted-foreground">Academic score below {t.slowBelow} is a slow learner; above {t.advancedAbove} is advanced.</p>
          <ShareBar label="Students by learning level" height={16} parts={[
            { label: "Slow learners", value: dept.all.slow, tone: "red" },
            { label: "Average", value: dept.all.average, tone: "none" },
            { label: "Advanced learners", value: dept.all.advanced, tone: "primary" },
            ...(dept.all.notAssessed > 0 ? [{ label: "Not assessed", value: dept.all.notAssessed, tone: "slate" as const }] : []),
          ]} />
        </div>
        <div className="flex items-center gap-4 border-t border-border pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <Ring value={slowSupport.pct} size={96} stroke={9} tone={slowSupport.pct >= 75 ? "green" : slowSupport.pct >= 30 ? "highlight" : "red"} label={`${slowSupport.pct}% of slow learners have a support record`}>
            <span className="tabular font-serif text-xl font-semibold">{slowSupport.pct}%</span>
          </Ring>
          <div>
            <p className="text-sm font-medium">Slow learners with support</p>
            <p className="text-[13px] text-muted-foreground">{slowSupport.withSupport} of {slowSupport.slow} have at least one support record</p>
          </div>
        </div>
      </section>

      <Card data-motion-card className="rounded-xl border-border shadow-sm shadow-slate-900/[0.02] p-4 print:border-0">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Slow and advanced learners by department</h2>
          <Button size="sm" variant="outline" className="print:hidden" onClick={() => download("learners.csv", learnersCsv(data.learners.filter((l) => classify(l.academic, t) !== "Average"), t))}>
            Download student list (CSV)
          </Button>
        </div>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted-foreground"><tr><th className={th}>Department</th><th className={th}>Students</th><th className={`${th} min-w-[180px] w-[34%]`}>Mix</th><th className={th}>Slow</th><th className={th}>Average</th><th className={th}>Advanced</th><th className={th}>Not assessed</th></tr></thead>
            <tbody>
              {[...dept.depts, dept.all].map((d) => (
                <tr key={d.department} className={`border-t border-border ${d === dept.all ? "font-semibold" : ""}`}>
                  <td className="py-2 pr-3">{d.department}</td><td className="tabular pr-3">{d.total}</td>
                  <td className="pr-3"><ShareBar legend={false} height={10} label={d.department} parts={[{ label: "Slow", value: d.slow, tone: "red" }, { label: "Average", value: d.average, tone: "none" }, { label: "Advanced", value: d.advanced, tone: "primary" }]} /></td>
                  <td className="pr-3">{d.slow} <span className="text-xs text-muted-foreground">({d.slowPct}%)</span></td>
                  <td className="pr-3">{d.average}</td>
                  <td className="pr-3">{d.advanced} <span className="text-xs text-muted-foreground">({d.advancedPct}%)</span></td>
                  <td>{d.notAssessed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card data-motion-card className="rounded-xl border-border shadow-sm shadow-slate-900/[0.02] p-4 print:border-0">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Mentor allocation</h2>
          <Button size="sm" variant="outline" className="print:hidden" onClick={() => download("mentor-allocation.csv", mentorsCsv(mentors))}>Download (CSV)</Button>
        </div>
        <p className="text-xs text-muted-foreground">{mentors.filter((m) => m.mentor !== "-").length} mentors, {dept.all.total} students; every student has a named mentor unless listed as unassigned.</p>
        <div className="mt-2 max-h-80 overflow-auto print:max-h-none">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground"><tr><th className={th}>Mentor</th><th className={th}>Department</th><th className={th}>Mentees</th></tr></thead>
            <tbody>
              {mentors.map((m) => (
                <tr key={m.mentor} className="border-t border-border"><td className="py-1 pr-3">{m.name} ({m.mentor})</td><td className="pr-3">{m.department}</td><td>{m.mentees}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card data-motion-card className="rounded-xl border-border shadow-sm shadow-slate-900/[0.02] p-4 print:border-0">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Support given</h2>
          <Button size="sm" variant="outline" className="print:hidden" onClick={() => download("support-log.csv", supportCsv(data.support))} disabled={support.live === 0}>Download log (CSV)</Button>
        </div>
        {support.live === 0 ? (
          <EmptyState>No support has been logged yet. Mentors log it from a student&apos;s page, and it appears here straight away.</EmptyState>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">{support.live} records for {support.students} students; {support.done} completed.</p>
            <ul className="mt-2 text-sm">
              {support.byType.map(([type, n]) => <li key={type} className="flex justify-between border-t border-border py-1"><span>{type}</span><span>{n}</span></li>)}
            </ul>
          </>
        )}
        {support.seeded > 0 && <p className="mt-2 text-xs text-risk-amber">{support.seeded} synthetic historical records used for demonstration are excluded from these figures.</p>}
      </Card>
    </div>
  );
}
