import type { Driver, Tier } from "../../lib/types.ts";

export interface QueueRow {
  student_id: string; name: string; department: string; year: number;
  success_score: number; band: string; academic_risk: Tier; placement_risk: Tier; segment: string;
  priority: number; engagement_drop: boolean; mentor_faculty_id: string | null;
  actions: string[] | null;
  drivers: { academic?: Driver[]; placement?: Driver[] };
}

export interface QueueFilters {
  q: string; year: string; segment: string; mentor: string;
  risk: "Any" | "Academic Red" | "Placement Red" | "Early warning";
  hideContacted: boolean;
}

export function filterQueue(rows: QueueRow[], f: QueueFilters, contacted: Set<string>): QueueRow[] {
  const needle = f.q.trim().toLowerCase();
  return rows
    .filter(
      (r) =>
        (f.year === "All" || String(r.year) === f.year) &&
        (f.segment === "All" || r.segment === f.segment) &&
        (f.mentor === "All" || r.mentor_faculty_id === f.mentor) &&
        (f.risk === "Any" ||
          (f.risk === "Academic Red" && r.academic_risk === "Red") ||
          (f.risk === "Placement Red" && r.placement_risk === "Red") ||
          (f.risk === "Early warning" && r.engagement_drop)) &&
        (!f.hideContacted || !contacted.has(r.student_id)) &&
        (needle === "" || `${r.name} ${r.student_id}`.toLowerCase().includes(needle)),
    )
    .sort((a, b) => b.priority - a.priority);
}

/** The strongest reasons across both risk flags, so a mentor sees the "why" at a glance. */
export function topReasons(r: QueueRow, n = 2): Driver[] {
  return [...(r.drivers?.academic ?? []), ...(r.drivers?.placement ?? [])].sort((a, b) => b.points - a.points).slice(0, n);
}

const HEADER = ["student_id", "name", "department", "year", "score", "academic_risk", "placement_risk", "segment", "top_reason", "actions"];

/** Names and labels can start with = + - @, which spreadsheets run as formulas, so neutralise them. */
function cell(v: unknown): string {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(rows: QueueRow[]): string {
  const lines = rows.map((r) =>
    [r.student_id, r.name, r.department, r.year, r.success_score, r.academic_risk, r.placement_risk, r.segment,
      topReasons(r, 1)[0]?.label ?? "", (r.actions ?? []).join("; ")].map(cell).join(","),
  );
  return [HEADER.join(","), ...lines].join("\n");
}

type Store = Pick<Storage, "getItem" | "setItem">;
const KEY = "elevra-contacted";

/** "Contacted" ticks live in the browser only; any storage failure just means an empty list. */
export function readContacted(store: Store | null): Set<string> {
  try {
    const parsed = JSON.parse(store?.getItem(KEY) ?? "{}") as Record<string, boolean>;
    return new Set(Object.keys(parsed).filter((k) => parsed[k]));
  } catch {
    return new Set();
  }
}

export function writeContacted(store: Store | null, state: Record<string, boolean>): void {
  try {
    store?.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable (private mode, quota): ticks simply will not persist */
  }
}
