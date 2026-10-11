"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { fetchAllRows } from "@/components/admin/paginate";
import { DEFAULT_POLICY, describe, plan, summarize, toCsv, type AttendanceRow, type Policy, type RecoveryStatus } from "@/components/shared/attendance";
import { EmptyState, Kpi } from "@/components/shared/Kpi";
import { getIdentity } from "@/components/shared/session";
import { useCachedQuery } from "@/components/shared/useCachedQuery";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";

interface Raw { student_id: string; name: string; department: string; year: number; mentor_faculty_id: string | null; current_attendance_pct: number | null }

async function load() {
  const supabase = createClient();
  const me = await getIdentity();
  // row-level security limits a mentor to their own students; an admin sees everyone
  const [raw, cohort] = await Promise.all([
    fetchAllRows<Raw>((from, to) =>
      supabase.from("student_unified_view").select("student_id,name,department,year,mentor_faculty_id,current_attendance_pct")
        .order("student_id").range(from, to) as never),
    supabase.from("analytics").select("payload").eq("key", "cohort").maybeSingle(),
  ]);
  const week = Number((cohort.data?.payload as { current_week?: number } | null)?.current_week);
  const rows: AttendanceRow[] = raw.map((r) => ({
    student_id: r.student_id, name: r.name, department: r.department, year: r.year,
    mentor_faculty_id: r.mentor_faculty_id, pct: r.current_attendance_pct == null ? null : Number(r.current_attendance_pct),
  }));
  return { rows, week: Number.isFinite(week) ? week : null, isAdmin: me?.role === "admin" };
}

const TONE: Record<RecoveryStatus, string> = {
  Safe: "bg-emerald-50 text-emerald-800", Recoverable: "bg-amber-50 text-amber-800",
  "Needs condonation": "bg-orange-50 text-orange-800", "Cannot recover": "bg-red-50 text-red-800", "No data": "bg-slate-100 text-slate-600",
};
const FIELD = "w-20 rounded-md border border-slate-300 px-2 py-1 text-sm";
const FILTERS: (RecoveryStatus | "Needs attention")[] = ["Needs attention", "Recoverable", "Needs condonation", "Cannot recover", "Safe", "No data"];

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export default function AttendancePage() {
  const { data, error, loading } = useCachedQuery("faculty:attendance", load);
  const [policy, setPolicy] = useState<Policy>(DEFAULT_POLICY);
  const [weekOverride, setWeekOverride] = useState<string>("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Needs attention");
  const [limit, setLimit] = useState(50);

  const weeksDone = weekOverride !== "" ? Number(weekOverride) : data?.week ?? 0;
  const planned = useMemo(() => (data ? plan(data.rows, weeksDone, policy) : []), [data, weeksDone, policy]);
  const counts = useMemo(() => summarize(planned), [planned]);
  const shown = useMemo(
    () => planned.filter((p) => (filter === "Needs attention" ? ["Recoverable", "Needs condonation", "Cannot recover"].includes(p.r.status) : p.r.status === filter)),
    [planned, filter],
  );

  if (error) return <EmptyState>Could not load attendance: {error}</EmptyState>;
  if (loading || !data) return <Skeleton className="h-96 w-full" />;

  const num = (v: string, min: number, max: number, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h1 className="text-2xl font-bold">Attendance recovery planner</h1>
        <p className="text-sm text-slate-500">
          How many of the remaining classes each student needs to attend to finish the term at the required attendance.
          Rules differ between universities, so set yours below. Percentages are each student&apos;s current average across subjects.
        </p>
      </div>

      <Card className="p-4 print:hidden">
        <h2 className="text-sm font-semibold">Policy</h2>
        <div className="mt-2 flex flex-wrap items-end gap-4 text-sm">
          <label className="grid gap-1">Required attendance %<input aria-label="Required attendance" className={FIELD} type="number" value={policy.threshold} onChange={(e) => setPolicy({ ...policy, threshold: num(e.target.value, 1, 100, 75) })} /></label>
          <label className="grid gap-1">Condonation (points)<input aria-label="Condonation" className={FIELD} type="number" value={policy.condonation} onChange={(e) => setPolicy({ ...policy, condonation: num(e.target.value, 0, 50, 10) })} /></label>
          <label className="grid gap-1">Weeks in term<input aria-label="Weeks in term" className={FIELD} type="number" value={policy.weeksInTerm} onChange={(e) => setPolicy({ ...policy, weeksInTerm: Math.round(num(e.target.value, 1, 60, 16)) })} /></label>
          <label className="grid gap-1">Classes per week<input aria-label="Classes per week" className={FIELD} type="number" value={policy.classesPerWeek} onChange={(e) => setPolicy({ ...policy, classesPerWeek: Math.round(num(e.target.value, 1, 60, 15)) })} /></label>
          <label className="grid gap-1">Weeks completed<input aria-label="Weeks completed" className={FIELD} type="number" value={weekOverride !== "" ? weekOverride : data.week ?? ""} onChange={(e) => setWeekOverride(String(num(e.target.value, 0, 60, 0)))} /></label>
        </div>
        {data.week == null && weekOverride === "" && <p className="mt-2 text-xs text-amber-700">The current week is not available from the data; enter weeks completed.</p>}
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5 print:hidden">
        {(["Safe", "Recoverable", "Needs condonation", "Cannot recover", "No data"] as RecoveryStatus[]).map((s) => (
          <Kpi key={s} label={s} value={counts[s].toLocaleString()} />
        ))}
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
          <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by status">
            {FILTERS.map((f) => (
              <button key={f} type="button" aria-pressed={filter === f} onClick={() => { setFilter(f); setLimit(50); }}
                className={`rounded-full border px-3 py-1 text-xs ${filter === f ? "border-blue-600 bg-blue-50 text-blue-800" : "border-slate-300 text-slate-600"}`}>{f}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => download("attendance-plan.csv", toCsv(shown))} disabled={shown.length === 0}>Download CSV</Button>
            <Button size="sm" variant="outline" onClick={() => window.print()} disabled={shown.length === 0}>Print notice list</Button>
          </div>
        </div>
        <p className="mt-2 hidden text-sm print:block">
          Attendance notice list: {policy.threshold}% required, {policy.condonation}-point condonation, week {weeksDone} of {policy.weeksInTerm}.
        </p>
        {shown.length === 0 ? (
          <EmptyState>No students in this group.</EmptyState>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr><th className="py-1 pr-3">Student</th><th className="pr-3">Now</th><th className="pr-3">Status</th><th className="pr-3">Needs to attend</th><th>What it means</th></tr>
              </thead>
              <tbody>
                {shown.slice(0, limit).map((p) => (
                  <tr key={p.student_id} className="border-t border-slate-100 align-top">
                    <td className="py-1.5 pr-3">
                      <Link className="text-blue-700 hover:underline print:text-black" href={`/faculty/student/${p.student_id}`}>{p.name}</Link>
                      <span className="block text-xs text-slate-500">{p.student_id} · {p.department} · Year {p.year}</span>
                    </td>
                    <td className="pr-3">{p.pct == null ? "–" : `${p.pct}%`}</td>
                    <td className="pr-3"><span className={`rounded-full px-2 py-0.5 text-xs ${TONE[p.r.status]}`}>{p.r.status}</span></td>
                    <td className="pr-3">{p.r.status === "No data" ? "–" : `${p.r.needed} of ${p.r.remaining}`}</td>
                    <td className="text-xs text-slate-600">{describe(p.r, policy)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {shown.length > limit && (
              <div className="mt-3 text-center print:hidden">
                <Button size="sm" variant="outline" onClick={() => setLimit(limit + 100)}>Show more ({shown.length - limit} left)</Button>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
