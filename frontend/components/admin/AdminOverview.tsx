"use client";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { coverage, SLA_DAYS, type CaseRow, type StudentRow } from "@/components/shared/cases";
import { chartChrome, usePalette } from "@/components/shared/palette";
import { Empty, PageHeader, Panel } from "@/components/shared/ui-kit";
import { Funnel, MiniRing, VisualStat } from "@/components/shared/viz";
import { SearchFilterBar } from "@/components/shared/SearchFilterBar";
import { PILLARS, type Insight } from "@/lib/types";
import { WeeklyBrief } from "./WeeklyBrief";
import {
  applyFilters, bandDistribution, filterOptions, heatmapByDepartment, kpis, quadrantPoints, riskBy, type OverviewRow,
} from "./aggregate";

const PILLAR_SHORT: Record<string, string> = {
  academic: "Academic", attendance: "Attendance", lms: "LMS", placement: "Placement", skills: "Skills", engagement: "Co-curr.", feedback: "Feedback",
};
/** Heat-map cell: below 50 tints toward brick, above toward evergreen, so weak spots stand out without a rainbow. */
function heat(v: number | null): React.CSSProperties {
  if (v === null) return { background: "hsl(var(--muted))" };
  const strength = Math.min(1, Math.abs(v - 55) / 35);
  const tone = v < 55 ? "var(--risk-red)" : "var(--primary)";
  return { background: `hsl(${tone} / ${0.08 + strength * 0.32})` };
}

/** Share of Red, Amber and Green in each group, as one 100% bar per row: easier to compare than stacked counts. */
function RiskShare({ data }: { data: ReturnType<typeof riskBy> }) {
  return (
    <div className="space-y-3">
      {data.map((d) => {
        const pct = (n: number) => (d.total === 0 ? 0 : (n / d.total) * 100);
        return (
          <div key={d.group}>
            <div className="mb-1 flex items-baseline justify-between text-[13px]">
              <span className="font-medium">{d.group}</span>
              <span className="tabular text-muted-foreground"><span className="font-semibold text-risk-red">{pct(d.Red).toFixed(0)}% Red</span> · {d.total} students</span>
            </div>
            <div className="flex h-2.5 overflow-hidden rounded-sm bg-muted" role="img" aria-label={`${d.group}: ${d.Red} Red, ${d.Amber} Amber, ${d.Green} Green`}>
              <span className="bg-risk-red" style={{ width: `${pct(d.Red)}%` }} />
              <span className="bg-highlight" style={{ width: `${pct(d.Amber)}%` }} />
              <span className="bg-risk-green/70" style={{ width: `${pct(d.Green)}%` }} />
            </div>
          </div>
        );
      })}
      <p className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-[1px] bg-risk-red" />Red · needs a check-in</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-[1px] bg-highlight" />Amber · watch</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-[1px] bg-risk-green/70" />Green</span>
      </p>
    </div>
  );
}

/** The closed loop in one line: how many students are flagged, and whether anyone is acting on it. */
function FollowThrough({ rows, cases }: { rows: OverviewRow[]; cases: CaseRow[] | null }) {
  const asStudents = rows.map((r) => ({ ...r, mentor_faculty_id: null, priority: 0 })) as unknown as StudentRow[];
  const c = coverage(asStudents, cases ?? []);
  const reached = cases === null ? 0 : c.contacted;
  return (
    <Panel
      title="From flag to follow-through"
      description="Flagging a student only helps if someone reaches out. Each bar is a share of all students in this selection."
      actions={<Link href="/admin/workload" className="inline-flex items-center gap-1 text-sm font-medium text-primary no-underline hover:underline">Open Response &amp; workload <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>}
    >
      <Funnel
        steps={[
          { label: "Students", value: rows.length, tone: "slate" },
          { label: "Need a check-in", value: c.red, tone: "highlight", note: `${rows.length ? Math.round((c.red / rows.length) * 100) : 0}% flagged Red on academics or placement` },
          { label: `Contacted in ${SLA_DAYS} days`, value: reached, tone: "primary", note: cases === null ? "Contact data unavailable right now." : `${c.pct}% of flagged students reached; ${c.never.toLocaleString()} never contacted` },
          { label: "Overdue follow-ups", value: cases === null ? 0 : c.overdueFollowUps, tone: "red", note: "Planned check-ins past their date" },
        ]}
      />
    </Panel>
  );
}

export function AdminOverview({ rows, insights = [], cases = null }: { rows: OverviewRow[]; insights?: Insight[]; cases?: CaseRow[] | null }) {
  const router = useRouter();
  const p = usePalette();
  const chrome = chartChrome(p);
  const [filters, setFilters] = useState({ department: "All", year: "All", batch: "All" });
  const [query, setQuery] = useState("");
  const opts = useMemo(() => filterOptions(rows), [rows]);
  const view = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return applyFilters(rows, filters).filter((student) => {
      const searchable = `${student.name} ${student.student_id}`.toLowerCase();
      return words.every((word) => searchable.includes(word));
    });
  }, [rows, filters, query]);
  const k = useMemo(() => kpis(view), [view]);
  const dist = useMemo(() => bandDistribution(view), [view]);
  const byDept = useMemo(() => riskBy(view, "department"), [view]);
  const byYear = useMemo(() => riskBy(view, "year"), [view]);
  const points = useMemo(() => quadrantPoints(view), [view]);
  const heatmap = useMemo(() => heatmapByDepartment(view), [view]);
  const activeFilterCount = Number(filters.department !== "All") + Number(filters.year !== "All") + Number(filters.batch !== "All");
  const clearFilters = () => { setQuery(""); setFilters({ department: "All", year: "All", batch: "All" }); };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Institution"
        title="Overview"
        description="Seven campus data sources joined into one record per student, scored weekly. Click any dot in the readiness chart to open that student."
      />

      <SearchFilterBar
        label="Search students"
        dataTour="admin-overview-filter"
        placeholder="Search by student name or ID"
        value={query}
        onChange={setQuery}
        onSearch={() => setQuery((current) => current.trim())}
        activeFilters={activeFilterCount}
        onClear={clearFilters}
        filters={(
          <>
            {([
              ["department", "Department", opts.departments],
              ["year", "Year", opts.years],
              ["batch", "Batch", opts.batches],
            ] as const).map(([key, label, values]) => (
              <label key={key} className="grid gap-1 text-xs font-medium text-muted-foreground">{label}
                <select className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground" value={filters[key]} onChange={(e) => setFilters({ ...filters, [key]: e.target.value })}>
                  <option>All</option>{values.map((value) => <option key={value}>{value}</option>)}
                </select>
              </label>
            ))}
          </>
        )}
      />

      <WeeklyBrief rows={rows} />

      {view.length === 0 ? (
        <Empty>No students match these filters. Try clearing one.</Empty>
      ) : (
        <>
          <FollowThrough rows={view} cases={cases} />

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <VisualStat label="Average success score" value={k.avgScore?.toFixed(1) ?? "–"} note="out of 100, seven weighted pillars"
              visual={<MiniRing pct={k.avgScore ?? 0} tone="primary" label={`Average score ${k.avgScore} of 100`} />} />
            <VisualStat label="Academic risk: Red" value={`${k.academicRedPct}%`} note="needs a check-in"
              visual={<MiniRing pct={k.academicRedPct} tone="red" label={`${k.academicRedPct}% Red on academic risk`} />} />
            <VisualStat label="Placement risk: Red" value={`${k.placementRedPct}%`} note="3rd and 4th years assessed"
              visual={<MiniRing pct={k.placementRedPct} tone="red" label={`${k.placementRedPct}% Red on placement risk`} />} />
            <VisualStat label="Placement-ready" value={k.placementReadyPct === null ? "–" : `${k.placementReadyPct}%`} note="readiness score 70 or more"
              visual={<MiniRing pct={k.placementReadyPct ?? 0} tone="green" label={`${k.placementReadyPct}% placement-ready`} />} />
          </div>

          {insights.length > 0 && (
            <Panel title="What the data shows" description="Patterns found by joining the sources. Associations in a synthetic cohort, not proof of cause.">
              <ol className="divide-y divide-border">
                {insights.slice(0, 3).map((i, n) => (
                  <li key={i.id} className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[2.5rem_14rem_1fr] sm:gap-4">
                    <span className={`tabular font-serif text-xl font-semibold ${i.severity === "critical" ? "text-risk-red" : i.severity === "warning" ? "text-risk-amber" : "text-primary"}`}>{n + 1}.</span>
                    <span className="font-semibold">{i.title}</span>
                    <span className="text-sm leading-relaxed text-muted-foreground">{i.detail}</span>
                  </li>
                ))}
              </ol>
            </Panel>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Success score bands" description={`How ${view.length.toLocaleString()} students are distributed. ${k.earlyWarning} also show an early-warning drop in LMS activity.`}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={dist} margin={{ top: 20, left: -18, right: 4 }}>
                  <CartesianGrid {...chrome.grid} />
                  <XAxis dataKey="band" {...chrome.axis} interval={0} tick={{ ...chrome.axis.tick, fontSize: 11 }} />
                  <YAxis allowDecimals={false} {...chrome.axis} />
                  <Tooltip {...chrome.tooltip} />
                  <Bar isAnimationActive={false} dataKey="count" name="Students" barSize={44}>
                    {dist.map((d) => <Cell key={d.band} fill={p.band[d.band] ?? p.stone} />)}
                    <LabelList dataKey="count" position="top" style={{ fill: p.ink, fontSize: 12, fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Panel>
            <Panel title="Academic vs placement readiness" description="3rd and 4th years. Top-left: strong academically but not yet placement-ready.">
              {points.length === 0 ? (
                <Empty>No assessed students in this selection.</Empty>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <ScatterChart margin={{ left: -18, right: 8, top: 8 }}>
                    <CartesianGrid {...chrome.grid} vertical />
                    <XAxis type="number" dataKey="x" name="Academic" domain={[0, 100]} {...chrome.axis} label={{ value: "Academic", position: "insideBottomRight", offset: -2, fill: p.muted, fontSize: 11 }} />
                    <YAxis type="number" dataKey="y" name="Placement" domain={[0, 100]} {...chrome.axis} />
                    <ZAxis range={[22, 22]} />
                    <Tooltip
                      cursor={{ strokeDasharray: "3 3", stroke: p.grid }}
                      content={({ payload }) => payload?.[0] ? (
                        <div className="rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs">
                          <p className="font-medium">{payload[0].payload.name}</p>
                          <p className="text-muted-foreground">{payload[0].payload.segment}</p>
                        </div>
                      ) : null}
                    />
                    <Scatter isAnimationActive={false} data={points} onClick={(d: { id?: string; payload?: { id: string } }) => router.push(`/faculty/student/${d.payload?.id ?? d.id}`)}>
                      {points.map((pt) => <Cell key={pt.id} fill={p.segment[pt.segment] ?? p.stone} fillOpacity={0.75} cursor="pointer" />)}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              )}
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Academic risk by department" description="Share of students in each tier."><RiskShare data={byDept} /></Panel>
            <Panel title="Academic risk by year" description="Share of students in each tier."><RiskShare data={byYear} /></Panel>
          </div>

          <Panel title="Department × pillar" description="Average pillar score (0–100). Brick cells are below the cohort's typical level, green above. Students with no data for a pillar are left out.">
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full min-w-[560px] border-separate border-spacing-1 text-[13px]">
                <thead>
                  <tr>
                    <th className="px-2 py-1 text-left text-xs font-medium text-muted-foreground">Department</th>
                    {PILLARS.map((pl) => <th key={pl} className="px-2 py-1 text-xs font-medium text-muted-foreground">{PILLAR_SHORT[pl]}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {heatmap.map((h) => (
                    <tr key={h.department}>
                      <td className="px-2 py-1.5 font-medium">{h.department}</td>
                      {PILLARS.map((pl) => (
                        <td key={pl} className="tabular rounded-sm px-2 py-1.5 text-center" style={heat(h[pl])}>{h[pl] === null ? "–" : h[pl]?.toFixed(0)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
