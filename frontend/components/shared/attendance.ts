/**
 * Attendance recovery maths. Pure, so it can be tested without a browser. The policy is editable on the page because
 * the threshold and the condonation allowance differ between universities.
 */
export interface Policy {
  threshold: number;        // minimum attendance, percent (commonly 75)
  condonation: number;      // how many points below the threshold can be condoned (commonly 10-15)
  weeksInTerm: number;
  classesPerWeek: number;
}
export const DEFAULT_POLICY: Policy = { threshold: 75, condonation: 10, weeksInTerm: 16, classesPerWeek: 15 };

export type RecoveryStatus = "Safe" | "Recoverable" | "Needs condonation" | "Cannot recover" | "No data";

export interface Recovery {
  status: RecoveryStatus;
  held: number;            // classes held so far
  attended: number;        // classes attended so far (estimated from the percentage)
  remaining: number;       // classes still to be held
  needed: number;          // classes that must still be attended to finish the term at the threshold
  canMiss: number;         // classes that can still be missed and stay at the threshold (0 if none)
  projectedIfNoChange: number; // percent at term end if attendance continues at the current rate
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** `weeksDone` comes from the cohort's current week. Percentages outside 0..100 are rejected as "No data". */
export function recovery(pct: number | null | undefined, weeksDone: number, p: Policy = DEFAULT_POLICY): Recovery {
  const total = Math.max(0, Math.round(p.weeksInTerm * p.classesPerWeek));
  const held = Math.min(total, Math.max(0, Math.round(weeksDone * p.classesPerWeek)));
  const remaining = total - held;
  const empty: Recovery = { status: "No data", held, attended: 0, remaining, needed: 0, canMiss: 0, projectedIfNoChange: 0 };
  if (pct == null || !Number.isFinite(pct) || pct < 0 || pct > 100 || total === 0) return empty;

  const attended = (pct / 100) * held;
  const need = (threshold: number) => Math.max(0, Math.ceil((threshold / 100) * total - attended - 1e-9));
  const needed = need(p.threshold);
  const projected = held === 0 ? pct : round1(((attended + (pct / 100) * remaining) / total) * 100);
  const base = { held, attended: round1(attended), remaining, projectedIfNoChange: projected };

  // On track: continuing at the current rate ends the term at or above the threshold.
  if (pct >= p.threshold - 1e-9) {
    // misses allowed m: attended + (remaining - m) >= threshold * total
    const slack = Math.floor(attended + remaining - (p.threshold / 100) * total + 1e-9);
    return { ...base, status: "Safe", needed, canMiss: Math.min(remaining, Math.max(0, slack)) };
  }
  if (needed <= remaining) return { ...base, status: "Recoverable", needed, canMiss: 0 };
  const lower = need(Math.max(0, p.threshold - p.condonation));
  if (p.condonation > 0 && lower <= remaining) return { ...base, status: "Needs condonation", needed: lower, canMiss: 0 };
  return { ...base, status: "Cannot recover", needed, canMiss: 0 };
}

export interface AttendanceRow { student_id: string; name: string; department: string; year: number; mentor_faculty_id: string | null; pct: number | null }
export interface PlanRow extends AttendanceRow { r: Recovery }

const ORDER: Record<RecoveryStatus, number> = { "Cannot recover": 0, "Needs condonation": 1, Recoverable: 2, Safe: 3, "No data": 4 };

/** Students with the least room first: it is the order a mentor should act in. */
export function plan(rows: AttendanceRow[], weeksDone: number, p: Policy = DEFAULT_POLICY): PlanRow[] {
  return rows
    .map((row) => ({ ...row, r: recovery(row.pct, weeksDone, p) }))
    .sort((a, b) => ORDER[a.r.status] - ORDER[b.r.status] || (b.r.needed - a.r.needed) || a.student_id.localeCompare(b.student_id));
}

export function summarize(rows: PlanRow[]): Record<RecoveryStatus, number> {
  const out: Record<RecoveryStatus, number> = { Safe: 0, Recoverable: 0, "Needs condonation": 0, "Cannot recover": 0, "No data": 0 };
  for (const r of rows) out[r.r.status]++;
  return out;
}

/** Spreadsheet-safe cell: neutralises values a spreadsheet would execute as a formula, and quotes when needed. */
export function csvCell(v: string | number | null | undefined): string {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: PlanRow[]): string {
  const head = ["Student ID", "Name", "Department", "Year", "Mentor", "Attendance %", "Status", "Classes still needed", "Classes remaining", "Projected % at term end"];
  const lines = rows.map((x) => [x.student_id, x.name, x.department, x.year, x.mentor_faculty_id, x.pct, x.r.status, x.r.needed, x.r.remaining, x.r.projectedIfNoChange].map(csvCell).join(","));
  return [head.map(csvCell).join(","), ...lines].join("\n");
}

/** Plain-language line for a student or a mentor. Supportive, and it never predicts failure. */
export function describe(r: Recovery, p: Policy = DEFAULT_POLICY): string {
  switch (r.status) {
    case "Safe": return `On track. Can miss up to ${r.canMiss} of the remaining ${r.remaining} classes and stay at ${p.threshold}%.`;
    case "Recoverable": return `Needs a check-in. Attending ${r.needed} of the remaining ${r.remaining} classes reaches ${p.threshold}%.`;
    case "Needs condonation": return `Needs a check-in. Reaching ${p.threshold}% is out of reach, but attending ${r.needed} of the remaining ${r.remaining} classes gets within the ${p.condonation}-point condonation range.`;
    case "Cannot recover": return `Needs a check-in soon. Even attending every remaining class does not reach the condonation range; talk about options with the department.`;
    default: return "No attendance data yet.";
  }
}
