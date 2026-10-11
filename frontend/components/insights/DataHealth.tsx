"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Database, Eraser, FileText, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { DataHealthData, DataQualityRow, SourceStat } from "./data-health-types";
import { MOCK_DATA_HEALTH } from "./data-health-mock";

type State = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: DataHealthData };

const nf = new Intl.NumberFormat("en-IN");

async function load(): Promise<DataHealthData> {
  const sb = createClient();
  const [src, dq, an] = await Promise.all([
    sb.from("source_stats").select("*").order("source"),
    sb.from("data_quality").select("*").order("rows_affected", { ascending: false }),
    sb.from("analytics").select("payload").eq("key", "cohort").maybeSingle(),
  ]);
  const err = src.error ?? dq.error ?? an.error;
  if (err) throw new Error(err.message);
  return {
    sources: (src.data ?? []) as SourceStat[],
    quality: (dq.data ?? []) as DataQualityRow[],
    nStudents: (an.data?.payload as { n_students?: number } | null)?.n_students ?? null,
  };
}

function Kpi({ icon: Icon, label, value }: { icon: typeof Database; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="rounded-lg bg-muted p-2.5 text-foreground"><Icon className="h-5 w-5" /></div>
        <div>
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function HowWeJoin({ sources, nStudents }: { sources: number; nStudents: number | null }) {
  const steps = [
    { title: `${sources} source files`, body: "Each system uses its own ID format and units" },
    { title: "ID resolution", body: "Every ID is normalised to the 5-digit registry id; unknown IDs are logged" },
    { title: "Cleaning log", body: "Every fix is recorded below with rows affected" },
    { title: "Unified student view", body: nStudents ? `One row per student, ${nf.format(nStudents)} students` : "One row per student" },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>How we join the data</CardTitle>
        <CardDescription>From disconnected systems to one student record</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-stretch gap-3 lg:flex-row lg:items-center">
        {steps.map((s, i) => (
          <div key={s.title} className="flex flex-1 items-center gap-3">
            <div className="flex-1 rounded-lg border bg-muted/50 p-4">
              <p className="font-medium">{s.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
            </div>
            {i < steps.length - 1 && <ArrowRight className="hidden h-5 w-5 shrink-0 text-muted-foreground lg:block" />}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function DataHealth() {
  const mock = useSearchParams().get("mock") === "1";
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    if (mock) {
      setState({ status: "ready", data: MOCK_DATA_HEALTH });
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-40" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <Card role="alert">
        <CardHeader>
          <CardTitle>Couldn&apos;t load data health</CardTitle>
          <CardDescription>{state.message}. Check that you are signed in and try again.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { sources, quality, nStudents } = state.data;

  if (sources.length === 0 && quality.length === 0) {
    return (
      <Card data-tour="shared-data-cleaning">
        <CardHeader>
          <CardTitle>No integration results yet</CardTitle>
          <CardDescription>
            The data pipeline hasn&apos;t written source statistics yet. Once it has run, the sources, cleaning log and
            coverage appear here.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const rawRows = sources.reduce((a, s) => a + s.rows_in, 0);
  const issuesFixed = quality.reduce((a, q) => a + q.rows_affected, 0);
  const unified = nStudents ?? sources.find((s) => s.source.toLowerCase() === "registry")?.rows_out ?? null;
  const byCoverage = [...sources].sort((a, b) => a.students_covered_pct - b.students_covered_pct);

  return (
    <div className="space-y-6">
      {mock && (
        <p className="rounded-md bg-risk-amber-bg px-3 py-2 text-sm text-risk-amber">
          Showing sample data (?mock=1). Remove it from the address to see live results.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={FileText} label="Source files" value={nf.format(sources.length)} />
        <Kpi icon={Database} label="Raw rows ingested" value={nf.format(rawRows)} />
        <Kpi icon={Eraser} label="Rows fixed or flagged" value={nf.format(issuesFixed)} />
        <Kpi icon={Users} label="Unified students" value={unified === null ? "—" : nf.format(unified)} />
      </div>

      <HowWeJoin sources={sources.length} nStudents={unified} />

      <Card>
        <CardHeader>
          <CardTitle>Sources</CardTitle>
          <CardDescription>Each file arrives with its own ID format; rows out are after cleaning and de-duplication</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>File</TableHead>
                <TableHead>ID format</TableHead>
                <TableHead className="text-right">Rows in</TableHead>
                <TableHead className="text-right">Rows out</TableHead>
                <TableHead className="min-w-40">Student coverage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sources.map((s) => (
                <TableRow key={s.source}>
                  <TableCell className="font-medium">{s.source}</TableCell>
                  <TableCell className="font-mono text-xs">{s.file}</TableCell>
                  <TableCell className="font-mono text-xs">{s.id_format}</TableCell>
                  <TableCell className="text-right tabular-nums">{nf.format(s.rows_in)}</TableCell>
                  <TableCell className="text-right tabular-nums">{nf.format(s.rows_out)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={s.students_covered_pct} className="h-2" />
                      <span className="w-12 text-right text-xs tabular-nums">{s.students_covered_pct.toFixed(1)}%</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card data-tour="shared-data-cleaning" className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Cleaning log</CardTitle>
            <CardDescription>Every fix the pipeline made, largest first</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {quality.length === 0 ? (
              <p className="text-sm text-muted-foreground">No issues were logged.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead>Issue</TableHead>
                    <TableHead className="text-right">Rows</TableHead>
                    <TableHead>Action taken</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quality.map((q) => (
                    <TableRow key={q.id}>
                      <TableCell className="font-medium">{q.source}</TableCell>
                      <TableCell>{q.issue}</TableCell>
                      <TableCell className="text-right tabular-nums">{nf.format(q.rows_affected)}</TableCell>
                      <TableCell className="text-muted-foreground">{q.action}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pillar coverage</CardTitle>
            <CardDescription>Students with data, lowest first. Missing data is excluded from scores, never counted as 0.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {byCoverage.map((s) => (
              <div key={s.source}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{s.source}</span>
                  <span className="tabular-nums text-muted-foreground">{s.students_covered_pct.toFixed(1)}%</span>
                </div>
                <Progress value={s.students_covered_pct} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
