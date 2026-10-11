"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchAllRows } from "@/components/admin/paginate";
import { DEFAULT_POLICY, describe, plan, summarize, toCsv, type AttendanceRow, type Policy, type RecoveryStatus } from "@/components/shared/attendance";
import { SearchFilterBar } from "@/components/shared/SearchFilterBar";
import { Pagination } from "@/components/shared/Pagination";
import { matchesEveryWord } from "@/components/student/catalogSearch";
import { EmptyState } from "@/components/shared/Kpi";
import { Meter, ShareBar, type Tone } from "@/components/shared/viz";
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
  Safe: "bg-risk-green-bg text-risk-green", Recoverable: "bg-risk-amber-bg text-risk-amber",
  "Needs condonation": "bg-risk-amber-bg text-risk-amber", "Cannot recover": "bg-risk-red-bg text-risk-red", "No data": "bg-muted text-muted-foreground",
};
const METER: Record<RecoveryStatus, Tone> = { Safe: "green", Recoverable: "highlight", "Needs condonation": "amber", "Cannot recover": "red", "No data": "none" };
const FILTERS: (RecoveryStatus | "Needs attention")[] = ["Needs attention", "Recoverable", "Needs condonation", "Cannot recover", "Safe", "No data"];
const PAGE_SIZE = 25;

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
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const weeksDone = weekOverride !== "" ? Number(weekOverride) : data?.week ?? 0;
  const planned = useMemo(() => (data ? plan(data.rows, weeksDone, policy) : []), [data, weeksDone, policy]);
  const counts = useMemo(() => summarize(planned), [planned]);
  const shown = useMemo(
    () => planned
      .filter((p) => (filter === "Needs attention" ? ["Recoverable", "Needs condonation", "Cannot recover"].includes(p.r.status) : p.r.status === filter))
      .filter((p) => matchesEveryWord(query, `${p.name} ${p.student_id} ${p.department} ${p.year}`)),
    [planned, filter, query],
  );
  useEffect(() => { setPage(1); }, [query, filter]);

  if (error) return <EmptyState>Could not load attendance: {error}</EmptyState>;
  if (loading || !data) return <Skeleton className="h-96 w-full" />;

  const num = (v: string, min: number, max: number, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h1 className="text-lg font-bold leading-tight tracking-tight">Attendance recovery planner</h1>
      </div>

      <div className="print:hidden">
        <SearchFilterBar
          label="Search attendance records"
          dataTour="faculty-attendance-filter"
          placeholder="Search students by name or ID"
          value={query}
          onChange={setQuery}
          activeFilters={Number(filter !== "Needs attention") + Number(policy.threshold !== DEFAULT_POLICY.threshold || policy.condonation !== DEFAULT_POLICY.condonation || policy.weeksInTerm !== DEFAULT_POLICY.weeksInTerm || policy.classesPerWeek !== DEFAULT_POLICY.classesPerWeek || weekOverride !== "")}
          onClear={() => { setQuery(""); setFilter("Needs attention"); setPolicy(DEFAULT_POLICY); setWeekOverride(""); setPage(1); }}
          filters={<>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">Attendance status
              <select value={filter} onChange={(event) => { setFilter(event.target.value as (typeof FILTERS)[number]); setPage(1); }} className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/20">
                {FILTERS.map((status) => <option key={status}>{status}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">Required attendance %<input aria-label="Required attendance" className="h-10 rounded-lg border border-input bg-card px-3 text-sm text-foreground" type="number" value={policy.threshold} onChange={(e) => setPolicy({ ...policy, threshold: num(e.target.value, 1, 100, 75) })} /></label>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">Condonation points<input aria-label="Condonation" className="h-10 rounded-lg border border-input bg-card px-3 text-sm text-foreground" type="number" value={policy.condonation} onChange={(e) => setPolicy({ ...policy, condonation: num(e.target.value, 0, 50, 10) })} /></label>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">Weeks in term<input aria-label="Weeks in term" className="h-10 rounded-lg border border-input bg-card px-3 text-sm text-foreground" type="number" value={policy.weeksInTerm} onChange={(e) => setPolicy({ ...policy, weeksInTerm: Math.round(num(e.target.value, 1, 60, 16)) })} /></label>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">Classes per week<input aria-label="Classes per week" className="h-10 rounded-lg border border-input bg-card px-3 text-sm text-foreground" type="number" value={policy.classesPerWeek} onChange={(e) => setPolicy({ ...policy, classesPerWeek: Math.round(num(e.target.value, 1, 60, 15)) })} /></label>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">Weeks completed<input aria-label="Weeks completed" className="h-10 rounded-lg border border-input bg-card px-3 text-sm text-foreground" type="number" value={weekOverride !== "" ? weekOverride : data.week ?? ""} onChange={(e) => setWeekOverride(String(num(e.target.value, 0, 60, 0)))} /></label>
          </>}
        />
        {data.week == null && weekOverride === "" && <p className="mt-2 text-xs text-risk-amber">The current week is not available from the data; set it in Filter.</p>}
      </div>

      <section className="rounded-lg border border-border bg-card p-5 print:hidden">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[15px] font-semibold">Where {planned.length.toLocaleString()} students stand at week {weeksDone}</h2>
          <p className="text-[13px] text-muted-foreground">
            <span className="tabular font-serif text-lg font-semibold text-risk-red">{(counts.Recoverable + counts["Needs condonation"] + counts["Cannot recover"]).toLocaleString()}</span> need a check-in about attendance
          </p>
        </div>
        <ShareBar label="Students by attendance status" height={16} parts={[
          { label: "Safe", value: counts.Safe, tone: "green" },
          { label: "Recoverable", value: counts.Recoverable, tone: "highlight" },
          { label: "Needs condonation", value: counts["Needs condonation"], tone: "amber" },
          { label: "Cannot recover", value: counts["Cannot recover"], tone: "red" },
          ...(counts["No data"] > 0 ? [{ label: "No data", value: counts["No data"], tone: "none" as const }] : []),
        ]} />
      </section>

      <Card data-motion-card data-pagination-root className="scroll-mt-24 rounded-xl border-border shadow-sm shadow-slate-900/[0.02] space-y-3 p-4">
        <div className="flex justify-end gap-2 print:hidden">
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
              <thead className="text-xs text-muted-foreground">
                <tr><th className="min-w-[170px] py-1 pr-3 font-medium">Student</th><th className="min-w-[150px] pr-3 font-medium">Attendance now <span className="font-normal">(line = {policy.threshold}%)</span></th><th className="pr-3">Status</th><th className="whitespace-nowrap pr-3 font-medium">Needs to attend</th><th className="font-medium">What it means</th></tr>
              </thead>
              <tbody>
                {shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((p) => (
                  <tr key={p.student_id} className="border-t border-border align-top">
                    <td className="py-1.5 pr-3">
                      <Link className="text-primary hover:underline print:text-foreground" href={`/faculty/student/${p.student_id}`}>{p.name}</Link>
                      <span className="block text-xs text-muted-foreground">{p.student_id} · {p.department} · Year {p.year}</span>
                    </td>
                    <td className="pr-3">
                      {p.pct == null ? "–" : (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 pt-1"><Meter value={p.pct} target={policy.threshold} tone={METER[p.r.status]} label={`${p.pct}% against ${policy.threshold}% required`} /></div>
                          <span className="tabular w-11 text-right text-xs font-medium">{p.pct}%</span>
                        </div>
                      )}
                    </td>
                    <td className="pr-3"><span className={`whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium ${TONE[p.r.status]}`}>{p.r.status}</span></td>
                    <td className="pr-3">{p.r.status === "No data" ? "–" : `${p.r.needed} of ${p.r.remaining}`}</td>
                    <td className="text-xs text-muted-foreground">{describe(p.r, policy)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="print:hidden"><Pagination page={page} totalItems={shown.length} pageSize={PAGE_SIZE} label="Attendance pages" onPageChange={setPage} /></div>
          </div>
        )}
      </Card>
    </div>
  );
}
