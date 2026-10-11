"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { fmt } from "@/lib/format";
import { usePalette } from "@/components/shared/palette";
import { PILLARS, type Cohort, type Pillar } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mockSegments, SEGMENT_DEFS, type SegmentDef, type SegmentsData, type StudentRow } from "./segments-mock";

type State = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: SegmentsData };

const PAGE = 1000;
const COLUMNS = "student_id,name,department,year,success_score,band,priority,segment,academic,attendance,lms,placement,skills,engagement,feedback";
const PILLAR_LABEL: Record<Pillar, string> = {
  academic: "Academics", attendance: "Attendance", lms: "LMS", placement: "Placement",
  skills: "Skills", engagement: "Co-curricular", feedback: "Feedback",
};
const SHOWN = 25;

async function load(): Promise<SegmentsData> {
  const sb = createClient();
  const students: StudentRow[] = [];
  // Supabase caps a request at 1,000 rows, so read the cohort in pages.
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from("student_unified_view").select(COLUMNS).order("student_id").range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    students.push(...((data ?? []) as StudentRow[]));
    if ((data?.length ?? 0) < PAGE) break;
  }
  const { data: an, error } = await sb.from("analytics").select("payload").eq("key", "cohort").maybeSingle();
  if (error) throw new Error(error.message);
  const fromCohort = (an?.payload as Cohort | undefined)?.segments;
  const defs: SegmentDef[] = fromCohort?.length ? fromCohort.map(({ name, rule, action }) => ({ name, rule, action })) : SEGMENT_DEFS;
  return { defs, students };
}

const avg = (rows: StudentRow[], k: Pillar) => {
  const v = rows.map((r) => r[k]).filter((x): x is number => x !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

function CompareBar({ label, seg, all }: { label: string; seg: number | null; all: number | null }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {fmt(seg, 0)} <span className="text-muted-foreground">vs {fmt(all, 0)} cohort</span>
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-muted">
        <div className="h-2 rounded-full bg-slate-800" style={{ width: `${seg ?? 0}%` }} />
        {all !== null && <div className="absolute top-[-3px] h-[14px] w-0.5 bg-risk-red" style={{ left: `${all}%` }} title="Cohort average" />}
      </div>
    </div>
  );
}

function SegmentsView({ data }: { data: SegmentsData }) {
  const palette = usePalette();
  const [selected, setSelected] = useState<string>(data.defs[0]?.name ?? "");
  const [showAll, setShowAll] = useState(false);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    data.students.forEach((s) => { if (s.segment) c[s.segment] = (c[s.segment] ?? 0) + 1; });
    return c;
  }, [data.students]);

  const members = useMemo(
    () => data.students.filter((s) => s.segment === selected).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0)),
    [data.students, selected],
  );
  const def = data.defs.find((d) => d.name === selected);
  const visible = showAll ? members : members.slice(0, SHOWN);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {data.students.length.toLocaleString("en-IN")} students in {data.defs.length} groups. Each student belongs to the first group whose rule they match.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.defs.map((d) => (
          <button
            key={d.name}
            onClick={() => { setSelected(d.name); setShowAll(false); }}
            aria-pressed={selected === d.name}
            className={`rounded-xl border bg-card p-4 text-left transition hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-900 ${selected === d.name ? "ring-2 ring-foreground" : ""}`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium">{d.name}</p>
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: palette.segment[d.name] ?? palette.stone }} />
            </div>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{(counts[d.name] ?? 0).toLocaleString("en-IN")}</p>
            <p className="mt-2 text-xs text-muted-foreground">Rule: {d.rule}</p>
            <p className="mt-1 text-xs"><span className="text-muted-foreground">Action:</span> {d.action}</p>
          </button>
        ))}
      </div>

      {def && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{def.name}</CardTitle>
              <CardDescription>Average score in each area. The red line is the whole-cohort average.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground">No students in this group.</p>
              ) : (
                PILLARS.map((k) => <CompareBar key={k} label={PILLAR_LABEL[k]} seg={avg(members, k)} all={avg(data.students, k)} />)
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Students in this group</CardTitle>
              <CardDescription>Highest priority first. Open a student for the full picture.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground">No students match this group right now.</p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Dept</TableHead>
                        <TableHead>Year</TableHead>
                        <TableHead className="text-right">Score</TableHead>
                        <TableHead className="text-right">Priority</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visible.map((s) => (
                        <TableRow key={s.student_id}>
                          <TableCell>
                            <Link href={`/faculty/student/${s.student_id}`} className="font-medium underline-offset-2 hover:underline">{s.name}</Link>
                            <span className="ml-2 font-mono text-xs text-muted-foreground">{s.student_id}</span>
                          </TableCell>
                          <TableCell>{s.department}</TableCell>
                          <TableCell>{s.year}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmt(s.success_score, 1)}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmt(s.priority, 1)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {members.length > SHOWN && (
                    <button onClick={() => setShowAll((v) => !v)} className="mt-3 text-sm font-medium underline underline-offset-2">
                      {showAll ? "Show fewer" : `Show all ${members.length}`}
                    </button>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export function Segments() {
  const mock = useSearchParams().get("mock") === "1";
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    if (mock) {
      setState({ status: "ready", data: mockSegments() });
      return;
    }
    let cancelled = false;
    load()
      .then((data) => !cancelled && setState({ status: "ready", data }))
      .catch((e: Error) => !cancelled && setState({ status: "error", message: e.message }));
    return () => { cancelled = true; };
  }, [mock]);

  if (state.status === "loading") {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-36" />)}</div>
        <Skeleton className="h-72" />
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <Card role="alert">
        <CardHeader>
          <CardTitle>Couldn&apos;t load segments</CardTitle>
          <CardDescription>{state.message}. Check that you are signed in and try again.</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  if (state.data.students.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No students scored yet</CardTitle>
          <CardDescription>Segments appear once the data pipeline has scored the cohort.</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  return (
    <>
      {mock && <p className="mb-4 rounded-md bg-risk-amber-bg px-3 py-2 text-sm text-risk-amber">Showing sample data (?mock=1).</p>}
      <SegmentsView data={state.data} />
    </>
  );
}
