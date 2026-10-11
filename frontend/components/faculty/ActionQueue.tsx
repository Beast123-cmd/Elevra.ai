"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { BandBadge, RiskBadge } from "@/components/shared/badges";
import { contactState, isRed, type CaseRow, type ContactState } from "@/components/shared/cases";
import { EmptyState } from "@/components/shared/Kpi";
import { SearchFilterBar } from "@/components/shared/SearchFilterBar";
import { Pagination } from "@/components/shared/Pagination";
import { Button } from "@/components/ui/button";
import { filterQueue, toCsv, topReasons, type QueueFilters, type QueueRow } from "./queue";

const PAGE_SIZE = 25;
const RISK_OPTIONS: QueueFilters["risk"][] = ["Any", "Needs contact", "Academic Red", "Placement Red", "Early warning"];

function download(name: string, text: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function LastContact({ state, red }: { state: ContactState; red: boolean }) {
  if (state.kind === "never") return <span className={red ? "font-medium text-risk-red" : "text-muted-foreground"}>{red ? "Not contacted" : "—"}</span>;
  const label = state.daysAgo === 0 ? "Today" : state.daysAgo === 1 ? "Yesterday" : `${state.daysAgo} days ago`;
  return <span className={state.kind === "stale" && red ? "font-medium text-risk-amber" : "text-foreground"}>{label}</span>;
}

export function ActionQueue({ rows, cases, showMentorFilter }: { rows: QueueRow[]; cases: CaseRow[]; showMentorFilter: boolean }) {
  const [f, setF] = useState<QueueFilters>({ q: "", year: "All", risk: "Any", segment: "All", mentor: "All", hideContacted: false });
  const [page, setPage] = useState(1);

  const states = useMemo(() => {
    const now = new Date();
    return new Map(rows.map((r) => [r.student_id, contactState(r.student_id, cases, now)]));
  }, [rows, cases]);
  const contacted = useMemo(() => new Set(rows.filter((r) => states.get(r.student_id)?.kind === "ok").map((r) => r.student_id)), [rows, states]);
  const shown = useMemo(() => filterQueue(rows, f, contacted), [rows, f, contacted]);
  const uniq = (xs: (string | null)[]) => Array.from(new Set(xs.filter((x): x is string => !!x))).sort();
  const years = uniq(rows.map((r) => String(r.year)));
  const segments = uniq(rows.map((r) => r.segment));
  const mentors = uniq(rows.map((r) => r.mentor_faculty_id));
  const activeFilterCount = Number(f.year !== "All") + Number(f.segment !== "All") + Number(f.mentor !== "All") + Number(f.risk !== "Any") + Number(f.hideContacted);
  const updateFilters = (next: QueueFilters | ((current: QueueFilters) => QueueFilters)) => {
    setF(next);
    setPage(1);
  };
  const pageRows = shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const select = (key: "year" | "segment" | "mentor", label: string, values: string[]) => (
    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <select className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground" value={f[key]} onChange={(e) => updateFilters({ ...f, [key]: e.target.value })}>
        <option>All</option>
        {values.map((v) => (
          <option key={v}>{v}</option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-serif text-xl font-semibold">All mentees</h2>
        <p className="text-sm text-muted-foreground">
          Ranked by priority: who to contact, why, and what to do. Flags are prompts for a conversation, not judgements.
        </p>
      </div>

      <div className="space-y-2">
        <SearchFilterBar
          label="Search mentees"
          dataTour="shared-queue-search"
          placeholder="Search by name or student ID"
          value={f.q}
          onChange={(q) => updateFilters((current) => ({ ...current, q }))}
          activeFilters={activeFilterCount}
          onClear={() => updateFilters({ q: "", year: "All", risk: "Any", segment: "All", mentor: "All", hideContacted: false })}
          filters={<>
            {select("year", "Year", years)}
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">Risk
              <select className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground" value={f.risk} onChange={(e) => updateFilters({ ...f, risk: e.target.value as QueueFilters["risk"] })}>
                {RISK_OPTIONS.map((v) => <option key={v}>{v}</option>)}
              </select>
            </label>
            {select("segment", "Segment", segments)}
            {showMentorFilter && select("mentor", "Mentor", mentors)}
            <label className="flex min-h-10 items-center gap-2 text-sm text-foreground sm:col-span-2">
              <input type="checkbox" checked={f.hideContacted} onChange={(e) => updateFilters({ ...f, hideContacted: e.target.checked })} />
              Hide students contacted in the last 7 days
            </label>
          </>}
        />
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">{shown.length} students</span>
          <Button size="sm" disabled={shown.length === 0} onClick={() => download("action-queue.csv", toCsv(shown))}>Export CSV</Button>
        </div>
      </div>

      {shown.length === 0 ? (
        <EmptyState>
          {rows.length === 0 ? "No mentees are assigned to you yet. Ask an admin to assign mentees." : "No students match these filters. Try clearing one."}
        </EmptyState>
      ) : (
        <div data-pagination-root className="scroll-mt-24 rounded-lg border border-border bg-card">
          {/* phones: one card per student, the same facts in reading order */}
          <ol className="divide-y divide-border md:hidden">
            {pageRows.map((s, i) => (
              <li key={s.student_id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link className="font-medium text-primary hover:underline" href={`/faculty/student/${s.student_id}`}>
                      <span className="tabular mr-1.5 font-mono text-xs text-muted-foreground">{(page - 1) * PAGE_SIZE + i + 1}.</span>{s.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{s.student_id} · {s.department} · Y{s.year}{s.mentor_faculty_id ? ` · ${s.mentor_faculty_id}` : ""}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="tabular font-serif text-lg font-semibold leading-none">{s.success_score.toFixed(1)}</p>
                    <div className="mt-1"><BandBadge band={s.band} /></div>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <RiskBadge level={s.academic_risk} prefix="Academic" />
                  <RiskBadge level={s.placement_risk} prefix="Placement" />
                  {s.engagement_drop && <span className="text-xs font-medium text-risk-amber">LMS activity dropped</span>}
                </div>
                <ul className="mt-2 space-y-0.5 text-[13px] text-muted-foreground">
                  {topReasons(s, 2).map((d) => <li key={d.label}>{d.label} ({d.value})</li>)}
                </ul>
                <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2 text-[13px]">
                  <span><span className="text-muted-foreground">Next: </span>{s.actions?.[0] ?? "Routine monthly check-in"}</span>
                  <LastContact state={states.get(s.student_id) ?? { kind: "never" }} red={isRed(s)} />
                </div>
              </li>
            ))}
          </ol>
          <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs font-medium text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 font-medium">#</th><th className="px-3 py-2.5 font-medium">Student</th><th className="px-3 py-2.5 font-medium">Score</th><th className="px-3 py-2.5 font-medium">Risk</th>
                <th className="px-3 py-2.5 font-medium">Why</th><th className="px-3 py-2.5 font-medium">Suggested action</th><th className="px-3 py-2.5 font-medium">Last contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pageRows.map((s, i) => (
                <tr key={s.student_id} className="align-top transition-colors hover:bg-muted/40">
                  <td className="tabular p-3 font-mono text-xs text-muted-foreground">{(page - 1) * PAGE_SIZE + i + 1}</td>
                  <td className="p-3">
                    <Link className="font-medium text-primary hover:underline" href={`/faculty/student/${s.student_id}`}>{s.name}</Link>
                    <div className="text-xs text-muted-foreground">{s.student_id} · {s.department} · Y{s.year}{s.mentor_faculty_id ? ` · ${s.mentor_faculty_id}` : ""}</div>
                  </td>
                  <td className="p-3">
                    <div className="tabular font-serif text-base font-semibold">{s.success_score.toFixed(1)}</div>
                    <BandBadge band={s.band} />
                  </td>
                  <td className="p-3">
                    <div className="flex flex-col items-start gap-1">
                      <RiskBadge level={s.academic_risk} prefix="Acad" />
                      <RiskBadge level={s.placement_risk} prefix="Place" />
                      {s.engagement_drop && <span className="text-xs font-medium text-risk-amber">LMS drop</span>}
                    </div>
                  </td>
                  <td className="max-w-[340px] p-3 text-xs leading-relaxed">
                    {topReasons(s, 2).map((d) => <div key={d.label}>{d.label} <span className="text-muted-foreground">({d.value})</span></div>)}
                  </td>
                  <td className="max-w-[220px] p-3 text-xs leading-relaxed">{s.actions?.[0] ?? "Routine monthly check-in"}</td>
                  <td className="p-3 text-xs"><LastContact state={states.get(s.student_id) ?? { kind: "never" }} red={isRed(s)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <div className="px-3 pb-4"><Pagination page={page} totalItems={shown.length} pageSize={PAGE_SIZE} label="Mentee pages" onPageChange={setPage} /></div>
        </div>
      )}
    </div>
  );
}
