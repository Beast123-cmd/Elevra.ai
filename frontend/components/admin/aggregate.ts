import type { Pillar, Tier } from "../../lib/types.ts";

/** One row of student_unified_view, only the columns the admin overview needs. */
export interface OverviewRow {
  student_id: string; name: string; department: string; year: number; batch: string;
  success_score: number; band: string; academic_risk: Tier; placement_risk: Tier; segment: string; engagement_drop: boolean;
  academic: number | null; attendance: number | null; lms: number | null; placement: number | null;
  skills: number | null; engagement: number | null; feedback: number | null;
}

export interface Filters { department: string; year: string; batch: string }

const PILLAR_KEYS: Pillar[] = ["academic", "attendance", "lms", "placement", "skills", "engagement", "feedback"];
const BAND_ORDER = ["Critical", "Needs Attention", "On Track", "Thriving"];
const round1 = (n: number) => Math.round(n * 10) / 10;
const pct = (part: number, whole: number) => (whole === 0 ? 0 : round1((part / whole) * 100));

export function applyFilters(rows: OverviewRow[], f: Filters): OverviewRow[] {
  return rows.filter(
    (r) =>
      (f.department === "All" || r.department === f.department) &&
      (f.year === "All" || String(r.year) === f.year) &&
      (f.batch === "All" || r.batch === f.batch),
  );
}

export function filterOptions(rows: OverviewRow[]) {
  const uniq = (xs: string[]) => Array.from(new Set(xs)).sort();
  return {
    departments: uniq(rows.map((r) => r.department)),
    years: uniq(rows.map((r) => String(r.year))),
    batches: uniq(rows.map((r) => r.batch)),
  };
}

export function kpis(rows: OverviewRow[]) {
  const assessed = rows.filter((r) => r.placement_risk !== "Not assessed");
  const withPlacement = rows.filter((r) => r.placement !== null);
  return {
    students: rows.length,
    avgScore: rows.length === 0 ? null : round1(rows.reduce((a, r) => a + r.success_score, 0) / rows.length),
    academicRedPct: pct(rows.filter((r) => r.academic_risk === "Red").length, rows.length),
    placementRedPct: pct(assessed.filter((r) => r.placement_risk === "Red").length, assessed.length),
    placementReadyPct:
      withPlacement.length === 0 ? null : pct(withPlacement.filter((r) => (r.placement ?? 0) >= 70).length, withPlacement.length),
    earlyWarning: rows.filter((r) => r.engagement_drop).length,
  };
}

export function bandDistribution(rows: OverviewRow[]) {
  return BAND_ORDER.map((band) => ({ band, count: rows.filter((r) => r.band === band).length }));
}

export function riskBy(rows: OverviewRow[], key: "department" | "year") {
  const groups = new Map<string, { Red: number; Amber: number; Green: number; total: number }>();
  for (const r of rows) {
    const g = key === "year" ? `Year ${r.year}` : r.department;
    const cur = groups.get(g) ?? { Red: 0, Amber: 0, Green: 0, total: 0 };
    if (r.academic_risk === "Red" || r.academic_risk === "Amber" || r.academic_risk === "Green") cur[r.academic_risk] += 1;
    cur.total += 1;
    groups.set(g, cur);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, v]) => ({ group, ...v }));
}

export function quadrantPoints(rows: OverviewRow[]) {
  return rows
    .filter((r) => r.academic !== null && r.placement !== null)
    .map((r) => ({ id: r.student_id, name: r.name, segment: r.segment, x: r.academic as number, y: r.placement as number }));
}

export function heatmapByDepartment(rows: OverviewRow[]) {
  const depts = Array.from(new Set(rows.map((r) => r.department))).sort();
  return depts.map((department) => {
    const inDept = rows.filter((r) => r.department === department);
    const out: Record<string, number | string | null> = { department };
    for (const p of PILLAR_KEYS) {
      const vals = inDept.map((r) => r[p]).filter((v): v is number => v !== null);
      out[p] = vals.length === 0 ? null : round1(vals.reduce((a, b) => a + b, 0) / vals.length);
    }
    return out as { department: string } & Record<Pillar, number | null>;
  });
}
