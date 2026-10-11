"use client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { fetchAllRows } from "@/components/admin/paginate";
import { coverage, mentorLoads, suggestRebalance, needsContact, SLA_DAYS, type CaseRow, type StudentRow } from "@/components/shared/cases";
import { EmptyState } from "@/components/shared/Kpi";
import { Ring, ShareBar } from "@/components/shared/viz";
import { invalidateCache } from "@/components/shared/queryCache";
import { useCachedQuery } from "@/components/shared/useCachedQuery";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

interface Mentor { faculty_id: string; name: string; department: string }
interface Raw {
  student_id: string; academic_risk: StudentRow["academic_risk"]; placement_risk: StudentRow["placement_risk"]; priority: number;
  students: { name: string; department: string; year: number; mentor_faculty_id: string | null };
}
const CASE_COLUMNS = "id,student_id,type,status,followup_date,created_at,is_seeded,note";

async function load() {
  const supabase = createClient();
  const [raw, cases, mentors] = await Promise.all([
    fetchAllRows<Raw>((from, to) =>
      supabase.from("scores").select("student_id,academic_risk,placement_risk,priority,students!inner(name,department,year,mentor_faculty_id)")
        .order("student_id").range(from, to) as never),
    fetchAllRows<CaseRow>((from, to) => supabase.from("interventions").select(CASE_COLUMNS).order("id").range(from, to) as never),
    supabase.from("faculty").select("faculty_id,name,department").order("faculty_id").then((r) => (r.data ?? []) as Mentor[]),
  ]);
  const rows: StudentRow[] = raw.map(({ students, ...r }) => ({ ...r, ...students }));
  return { rows, cases, mentors };
}

const dateIn = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function WorkloadPage() {
  const { data, error, loading, reload } = useCachedQuery("admin:workload", load);
  const [busy, setBusy] = useState<string | null>(null);

  const view = useMemo(() => {
    if (!data) return null;
    const now = new Date();
    const names = new Map(data.mentors.map((m) => [m.faculty_id, m.name]));
    return {
      names, cov: coverage(data.rows, data.cases, now), loads: mentorLoads(data.rows, data.cases, now),
      moves: suggestRebalance(data.rows, data.cases, data.mentors, now), waiting: needsContact(data.rows, data.cases, now, 1000),
    };
  }, [data]);

  if (error) return <EmptyState>Could not load the workload: {error}</EmptyState>;
  if (loading || !data || !view) return <Skeleton className="h-96 w-full" />;
  const { cov, loads, moves, names, waiting } = view;
  const maxRed = Math.max(1, ...loads.map((l) => l.red));
  const label = (id: string) => (names.get(id) ? `${names.get(id)} (${id})` : id);
  const done = () => { invalidateCache("faculty:"); invalidateCache("admin:"); reload(); };

  async function applyMove(m: (typeof moves)[number]) {
    setBusy(m.student_id);
    try {
      await api(`/admin/students/${m.student_id}/mentor`, { mentor_faculty_id: m.to });
      toast.success(`${m.name} now has ${label(m.to)} as mentor`);
      done();
    } catch {
      toast.error("Could not change the mentor. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function assignCheckIns() {
    const targets = waiting.filter((s) => s.mentor_faculty_id);
    if (targets.length === 0) return;
    if (!window.confirm(`Create ${targets.length} planned check-in tasks, one per Red student, assigned to their mentors?`)) return;
    setBusy("bulk");
    const { error: err } = await createClient().from("interventions").insert(
      targets.map((s) => ({
        student_id: s.student_id, faculty_id: s.mentor_faculty_id, type: "Mentoring call", status: "planned",
        followup_date: dateIn(3), note: "Programme task: check-in with a Red student who has not been contacted this week.",
      })),
    );
    setBusy(null);
    if (err) return toast.error("Could not create the tasks. Please try again.");
    toast.success(`${targets.length} check-in tasks created; mentors see them under Follow-ups`);
    done();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-[26px] font-semibold leading-tight tracking-[-0.01em] sm:text-[30px]">Response &amp; workload</h1>
        <p className="text-sm text-muted-foreground">
          Is every Red student being reached? Target: a conversation within {SLA_DAYS} days. This tracks follow-through, not outcomes.
        </p>
      </div>

      <section className="grid gap-5 rounded-lg border border-border bg-card p-5 md:grid-cols-[auto_1fr] md:items-center">
        <Ring value={cov.pct} tone={cov.pct >= 80 ? "green" : cov.pct >= 40 ? "highlight" : "red"} size={136} stroke={12} label={`${cov.pct}% of Red students contacted within ${SLA_DAYS} days`}>
          <span>
            <span className="tabular block font-serif text-3xl font-semibold leading-none">{cov.pct}%</span>
            <span className="mt-1 block text-[11px] text-muted-foreground">reached in {SLA_DAYS} days</span>
          </span>
        </Ring>
        <div className="min-w-0 space-y-4">
          <div>
            <p className="font-serif text-xl font-semibold">{cov.contacted.toLocaleString()} of {cov.red.toLocaleString()} Red students have had a conversation this week</p>
            <p className="mt-1 text-sm text-muted-foreground">Target: every Red student within {SLA_DAYS} days. {cov.overdueFollowUps > 0 ? `${cov.overdueFollowUps} follow-ups are overdue.` : "No follow-ups are overdue."}</p>
          </div>
          <ShareBar label="Red students by contact status" height={14} parts={[
            { label: `Contacted in ${SLA_DAYS} days`, value: cov.contacted, tone: "green" },
            { label: `Last contact over ${SLA_DAYS} days ago`, value: cov.stale, tone: "highlight" },
            { label: "Never contacted", value: cov.never, tone: "red" },
          ]} />
        </div>
      </section>

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Programme task</h2>
            <p className="text-xs text-muted-foreground">Create a planned check-in, due in 3 days, for each Red student who has not been contacted this week.</p>
          </div>
          <Button size="sm" onClick={assignCheckIns} disabled={busy !== null || waiting.length === 0}>
            {busy === "bulk" ? "Creating…" : `Create ${waiting.filter((s) => s.mentor_faculty_id).length} check-in tasks`}
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-[15px] font-semibold">Caseload by mentor</h2>
        <p className="text-[13px] text-muted-foreground">Each bar is a mentor&apos;s Red students: green have been contacted this week, brick are still waiting.</p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr><th className="py-1 pr-3 font-medium">Mentor</th><th className="pr-3 font-medium">Mentees</th><th className="w-[38%] min-w-[180px] pr-3 font-medium">Red caseload</th><th className="pr-3 font-medium">Waiting</th><th className="font-medium">Overdue</th></tr>
            </thead>
            <tbody>
              {loads.map((l) => (
                <tr key={l.mentor} className="border-t border-border">
                  <td className="py-2 pr-3">{label(l.mentor)}</td>
                  <td className="tabular pr-3">{l.mentees}</td>
                  <td className="pr-3">
                    <div className="flex items-center gap-2" role="img" aria-label={`${l.red} Red, ${l.contacted} contacted`}>
                      <div className="flex h-3 flex-1 overflow-hidden rounded-sm bg-muted">
                        <span className="bg-risk-green" style={{ width: `${(l.contacted / maxRed) * 100}%` }} />
                        <span className="bg-risk-red/80" style={{ width: `${(l.uncontacted / maxRed) * 100}%` }} />
                      </div>
                      <span className="tabular w-16 text-right text-xs text-muted-foreground">{l.contacted}/{l.red}</span>
                    </div>
                  </td>
                  <td className={`pr-3 ${l.uncontacted > 0 ? "font-medium text-risk-amber" : ""}`}>{l.uncontacted}</td>
                  <td className={l.overdue > 0 ? "font-medium text-risk-red" : ""}>{l.overdue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold">Suggested rebalancing</h2>
        <p className="text-xs text-muted-foreground">Moves not-yet-contacted Red students from busier to lighter mentors in the same department. You decide; nothing changes until you apply it.</p>
        {moves.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Red caseloads are within 2 students of each other in every department. Nothing to move.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {moves.map((m) => (
              <li key={m.student_id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-2 text-sm">
                <span><strong>{m.name}</strong>: {label(m.from)} → {label(m.to)}<span className="block text-xs text-muted-foreground">{m.reason}</span></span>
                <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => applyMove(m)}>{busy === m.student_id ? "Applying…" : "Apply"}</Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
