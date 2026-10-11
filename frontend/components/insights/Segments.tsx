"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { fmt } from "@/lib/format";
import { PILLARS, type Cohort, type Pillar } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchFilterBar } from "@/components/shared/SearchFilterBar";
import { Pagination } from "@/components/shared/Pagination";
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
  const [selected, setSelected] = useState<string>(data.defs[0]?.name ?? "");
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("All");
  const [year, setYear] = useState("All");
  const [page, setPage] = useState(1);

  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    data.students.forEach((student) => { if (student.segment) result[student.segment] = (result[student.segment] ?? 0) + 1; });
    return result;
  }, [data.students]);
  const departments = useMemo(() => Array.from(new Set(data.students.map((student) => student.department))).sort(), [data.students]);
  const years = useMemo(() => Array.from(new Set(data.students.map((student) => String(student.year)))).sort(), [data.students]);
  const members = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return data.students
      .filter((student) => student.segment === selected)
      .filter((student) => department === "All" || student.department === department)
      .filter((student) => year === "All" || String(student.year) === year)
      .filter((student) => words.every((word) => `${student.name} ${student.student_id}`.toLowerCase().includes(word)))
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }, [data.students, selected, department, year, query]);
  const def = data.defs.find((item) => item.name === selected);
  const visible = members.slice((page - 1) * SHOWN, page * SHOWN);
  const activeFilters = Number(selected !== data.defs[0]?.name) + Number(department !== "All") + Number(year !== "All");
  useEffect(() => { setPage(1); }, [selected, department, year, query]);

  return (
    <div className="space-y-4">
      <SearchFilterBar
        label="Find students by segment"
        dataTour="shared-segment-filter"
        placeholder="Search students by name or ID"
        value={query}
        onChange={setQuery}
        activeFilters={activeFilters}
        onClear={() => { setQuery(""); setSelected(data.defs[0]?.name ?? ""); setDepartment("All"); setYear("All"); }}
        filters={<>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">Segment
            <select value={selected} onChange={(event) => setSelected(event.target.value)} className="h-10 rounded-lg border border-input bg-card px-3 text-sm text-foreground">
              {data.defs.map((item) => <option key={item.name} value={item.name}>{item.name} ({counts[item.name] ?? 0})</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">Department
            <select value={department} onChange={(event) => setDepartment(event.target.value)} className="h-10 rounded-lg border border-input bg-card px-3 text-sm text-foreground">
              <option>All</option>{departments.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">Year
            <select value={year} onChange={(event) => setYear(event.target.value)} className="h-10 rounded-lg border border-input bg-card px-3 text-sm text-foreground">
              <option>All</option>{years.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          {def && (
            <div className="space-y-3 rounded-lg border border-border bg-card p-3 sm:col-span-2">
              <div>
                <p className="text-sm font-semibold text-foreground">{def.name}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{def.rule}</p>
                <p className="text-xs leading-5"><span className="text-muted-foreground">Recommended action:</span> {def.action}</p>
              </div>
              {members.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {PILLARS.map((pillar) => <CompareBar key={pillar} label={PILLAR_LABEL[pillar]} seg={avg(members, pillar)} all={avg(data.students, pillar)} />)}
                </div>
              )}
            </div>
          )}
        </>}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <p><span className="font-semibold text-foreground">{members.length}</span> students in {selected}</p>
        <p>{data.students.length.toLocaleString("en-IN")} students across {data.defs.length} segments</p>
      </div>

      <Card data-pagination-root className="scroll-mt-24 rounded-xl border-border shadow-sm shadow-slate-900/[0.02]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Students in this segment</CardTitle>
          <CardDescription>Highest priority first. Open a student for the full picture.</CardDescription>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No students match these filters.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Dept</TableHead><TableHead>Year</TableHead><TableHead className="text-right">Score</TableHead><TableHead className="text-right">Priority</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {visible.map((student) => (
                      <TableRow key={student.student_id}>
                        <TableCell><Link href={`/faculty/student/${student.student_id}`} className="font-medium underline-offset-2 hover:underline">{student.name}</Link><span className="ml-2 font-mono text-xs text-muted-foreground">{student.student_id}</span></TableCell>
                        <TableCell>{student.department}</TableCell><TableCell>{student.year}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(student.success_score, 1)}</TableCell><TableCell className="text-right tabular-nums">{fmt(student.priority, 1)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Pagination page={page} totalItems={members.length} pageSize={SHOWN} label="Segment student pages" onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>
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
