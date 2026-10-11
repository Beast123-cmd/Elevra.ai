"use client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { fetchAllRows } from "@/components/admin/paginate";
import { coverage, mentorLoads, suggestRebalance, needsContact, SLA_DAYS, type CaseRow, type StudentRow } from "@/components/shared/cases";
import { EmptyState, Kpi } from "@/components/shared/Kpi";
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
        <h1 className="text-2xl font-bold">Response &amp; workload</h1>
        <p className="text-sm text-slate-500">
          Is every Red student being reached? Target: a conversation within {SLA_DAYS} days. This tracks follow-through, not outcomes.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Red students" value={cov.red.toLocaleString()} />
        <Kpi label={`Contacted in ${SLA_DAYS} days`} value={`${cov.pct}%`} hint={`${cov.contacted} of ${cov.red}`} />
        <Kpi label="Not contacted yet" value={cov.never.toLocaleString()} hint={`${cov.stale} more are past the ${SLA_DAYS}-day mark`} />
        <Kpi label="Overdue follow-ups" value={cov.overdueFollowUps.toLocaleString()} />
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Programme task</h2>
            <p className="text-xs text-slate-500">Create a planned check-in, due in 3 days, for each Red student who has not been contacted this week.</p>
          </div>
          <Button size="sm" onClick={assignCheckIns} disabled={busy !== null || waiting.length === 0}>
            {busy === "bulk" ? "Creating…" : `Create ${waiting.filter((s) => s.mentor_faculty_id).length} check-in tasks`}
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold">Caseload by mentor</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr><th className="py-1 pr-3">Mentor</th><th className="pr-3">Mentees</th><th className="pr-3">Red</th><th className="pr-3">Contacted</th><th className="pr-3">Waiting</th><th>Overdue</th></tr>
            </thead>
            <tbody>
              {loads.map((l) => (
                <tr key={l.mentor} className="border-t border-slate-100">
                  <td className="py-1.5 pr-3">{label(l.mentor)}</td>
                  <td className="pr-3">{l.mentees}</td><td className="pr-3">{l.red}</td><td className="pr-3">{l.contacted}</td>
                  <td className={`pr-3 ${l.uncontacted > 0 ? "font-medium text-amber-700" : ""}`}>{l.uncontacted}</td>
                  <td className={l.overdue > 0 ? "font-medium text-red-700" : ""}>{l.overdue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold">Suggested rebalancing</h2>
        <p className="text-xs text-slate-500">Moves not-yet-contacted Red students from busier to lighter mentors in the same department. You decide; nothing changes until you apply it.</p>
        {moves.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Red caseloads are within 2 students of each other in every department. Nothing to move.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {moves.map((m) => (
              <li key={m.student_id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 p-2 text-sm">
                <span><strong>{m.name}</strong>: {label(m.from)} → {label(m.to)}<span className="block text-xs text-slate-500">{m.reason}</span></span>
                <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => applyMove(m)}>{busy === m.student_id ? "Applying…" : "Apply"}</Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
