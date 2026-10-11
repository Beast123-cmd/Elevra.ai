"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { BandBadge, RiskBadge } from "@/components/shared/badges";
import { contactState, isRed, type CaseRow, type ContactState } from "@/components/shared/cases";
import { EmptyState } from "@/components/shared/Kpi";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { filterQueue, toCsv, topReasons, type QueueFilters, type QueueRow } from "./queue";

const FIELD = "mt-1 block h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm";
const SHOW_MAX = 200;
const RISK_OPTIONS: QueueFilters["risk"][] = ["Any", "Needs contact", "Academic Red", "Placement Red", "Early warning"];

function download(name: string, text: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function LastContact({ state, red }: { state: ContactState; red: boolean }) {
  if (state.kind === "never") return <span className={red ? "font-medium text-red-700" : "text-slate-400"}>{red ? "Not contacted" : "—"}</span>;
  const label = state.daysAgo === 0 ? "Today" : state.daysAgo === 1 ? "Yesterday" : `${state.daysAgo} days ago`;
  return <span className={state.kind === "stale" && red ? "font-medium text-amber-700" : "text-slate-700"}>{label}</span>;
}

export function ActionQueue({ rows, cases, showMentorFilter }: { rows: QueueRow[]; cases: CaseRow[]; showMentorFilter: boolean }) {
  const [f, setF] = useState<QueueFilters>({ q: "", year: "All", risk: "Any", segment: "All", mentor: "All", hideContacted: false });

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

  const select = (key: "year" | "segment" | "mentor", label: string, values: string[]) => (
    <label className="text-xs text-slate-500">
      {label}
      <select className={FIELD} value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })}>
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
        <h2 className="text-xl font-bold">All mentees</h2>
        <p className="text-sm text-slate-500">
          Ranked by priority: who to contact, why, and what to do. Flags are prompts for a conversation, not judgements.
        </p>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          <label className="col-span-2 text-xs text-slate-500">
            Search
            <input className={FIELD} placeholder="Name or student id" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
          </label>
          {select("year", "Year", years)}
          <label className="text-xs text-slate-500">
            Show
            <select className={FIELD} value={f.risk} onChange={(e) => setF({ ...f, risk: e.target.value as QueueFilters["risk"] })}>
              {RISK_OPTIONS.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          {select("segment", "Segment", segments)}
          {showMentorFilter && select("mentor", "Mentor", mentors)}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={f.hideContacted} onChange={(e) => setF({ ...f, hideContacted: e.target.checked })} />
            Hide students contacted in the last 7 days
          </label>
          <span className="text-slate-500">{shown.length} students</span>
          <Button className="ml-auto" size="sm" disabled={shown.length === 0} onClick={() => download("action-queue.csv", toCsv(shown))}>
            Export CSV
          </Button>
        </div>
      </Card>

      {shown.length === 0 ? (
        <EmptyState>
          {rows.length === 0 ? "No mentees are assigned to you yet. Ask an admin to assign mentees." : "No students match these filters. Try clearing one."}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="p-3">#</th><th className="p-3">Student</th><th className="p-3">Score</th><th className="p-3">Risk</th>
                <th className="p-3">Why</th><th className="p-3">Suggested action</th><th className="p-3">Last contact</th>
              </tr>
            </thead>
            <tbody>
              {shown.slice(0, SHOW_MAX).map((s, i) => (
                <tr key={s.student_id} className="border-t align-top">
                  <td className="p-3 text-slate-400">{i + 1}</td>
                  <td className="p-3">
                    <Link className="font-medium text-blue-700 hover:underline" href={`/faculty/student/${s.student_id}`}>{s.name}</Link>
                    <div className="text-xs text-slate-500">{s.student_id} · {s.department} · Y{s.year}{s.mentor_faculty_id ? ` · ${s.mentor_faculty_id}` : ""}</div>
                  </td>
                  <td className="p-3">
                    <div className="font-semibold">{s.success_score.toFixed(1)}</div>
                    <BandBadge band={s.band} />
                  </td>
                  <td className="space-y-1 p-3">
                    <RiskBadge level={s.academic_risk} prefix="Acad" />
                    <br />
                    <RiskBadge level={s.placement_risk} prefix="Place" />
                    {s.engagement_drop && <div className="text-xs text-amber-700">⚠ LMS drop</div>}
                  </td>
                  <td className="p-3 text-xs">
                    {topReasons(s, 2).map((d) => (
                      <div key={d.label}>• {d.label} ({d.value})</div>
                    ))}
                  </td>
                  <td className="p-3 text-xs">{s.actions?.[0] ?? "Routine monthly check-in"}</td>
                  <td className="p-3 text-xs"><LastContact state={states.get(s.student_id) ?? { kind: "never" }} red={isRed(s)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length > SHOW_MAX && (
            <p className="p-3 text-xs text-slate-500">Showing the top {SHOW_MAX} by priority. Narrow the filters or export the CSV for all {shown.length}.</p>
          )}
        </div>
      )}
    </div>
  );
}
