import type { Tier } from "../../lib/types.ts";

/**
 * "Cases": the closed loop between a risk flag and a person acting on it. An intervention record is a case:
 * logging one is contact, its status says whether it is done, and its follow-up date says when to look again.
 * Everything here is pure so it can be tested without a database or a browser.
 */
export interface CaseRow {
  id: number; student_id: string; type: string; status: "planned" | "in_progress" | "done";
  followup_date: string | null; created_at: string; is_seeded: boolean; note?: string | null;
}

export interface StudentRow {
  student_id: string; name: string; department: string; year: number; mentor_faculty_id: string | null;
  academic_risk: Tier; placement_risk: Tier; priority: number;
}

/** Contact target in days. Early-alert practice is two to seven days; it is a prompt, not proof of effect. */
export const SLA_DAYS = 7;
const DAY_MS = 86_400_000;
const round1 = (n: number) => Math.round(n * 10) / 10;

export const isRed = (s: Pick<StudentRow, "academic_risk" | "placement_risk">) => s.academic_risk === "Red" || s.placement_risk === "Red";

/** Local calendar date as YYYY-MM-DD, so due dates compare as plain strings. */
function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export type ContactState = { kind: "never" } | { kind: "ok"; daysAgo: number } | { kind: "stale"; daysAgo: number };

/**
 * Has someone acted for this student recently? Only live interventions count (seeded history is demonstration data),
 * and a task that is merely planned is not contact yet.
 */
export function contactState(studentId: string, cases: CaseRow[], now: Date = new Date()): ContactState {
  let latest: number | null = null;
  for (const c of cases) {
    if (c.student_id !== studentId || c.is_seeded || c.status === "planned") continue;
    const t = new Date(c.created_at).getTime();
    if (latest === null || t > latest) latest = t;
  }
  if (latest === null) return { kind: "never" };
  const daysAgo = Math.max(0, Math.floor((now.getTime() - latest) / DAY_MS));
  return daysAgo <= SLA_DAYS ? { kind: "ok", daysAgo } : { kind: "stale", daysAgo };
}

/** Red students nobody has contacted within the target, most urgent first, capped so the list stays workable. */
export function needsContact(rows: StudentRow[], cases: CaseRow[], now: Date = new Date(), cap = 5): StudentRow[] {
  return rows
    .filter((r) => isRed(r) && contactState(r.student_id, cases, now).kind !== "ok")
    .sort((a, b) => b.priority - a.priority)
    .slice(0, cap);
}

export function followUps(cases: CaseRow[], now: Date = new Date()) {
  const today = ymd(now);
  const weekEnd = ymd(addDays(now, SLA_DAYS));
  const open = cases.filter((c) => c.status !== "done");
  const byDate = (a: CaseRow, b: CaseRow) => (a.followup_date ?? "").localeCompare(b.followup_date ?? "");
  return {
    overdue: open.filter((c) => c.followup_date && c.followup_date < today).sort(byDate),
    today: open.filter((c) => c.followup_date === today),
    upcoming: open.filter((c) => c.followup_date && c.followup_date > today && c.followup_date <= weekEnd).sort(byDate),
    undated: open.filter((c) => !c.followup_date),
  };
}

export function coverage(rows: StudentRow[], cases: CaseRow[], now: Date = new Date()) {
  const reds = rows.filter(isRed);
  const ids = new Set(rows.map((r) => r.student_id));
  const states = reds.map((r) => contactState(r.student_id, cases, now).kind);
  const contacted = states.filter((k) => k === "ok").length;
  return {
    red: reds.length,
    contacted,
    never: states.filter((k) => k === "never").length,
    stale: states.filter((k) => k === "stale").length,
    pct: reds.length === 0 ? 0 : round1((contacted / reds.length) * 100),
    overdueFollowUps: followUps(cases.filter((c) => ids.has(c.student_id)), now).overdue.length,
  };
}

export interface MentorLoad { mentor: string; mentees: number; red: number; contacted: number; uncontacted: number; overdue: number }

export function mentorLoads(rows: StudentRow[], cases: CaseRow[], now: Date = new Date()): MentorLoad[] {
  const byMentor = new Map<string, StudentRow[]>();
  for (const r of rows) {
    const m = r.mentor_faculty_id ?? "unassigned";
    byMentor.set(m, [...(byMentor.get(m) ?? []), r]);
  }
  return Array.from(byMentor.entries())
    .map(([mentor, mine]) => {
      const c = coverage(mine, cases, now);
      return { mentor, mentees: mine.length, red: c.red, contacted: c.contacted, uncontacted: c.red - c.contacted, overdue: c.overdueFollowUps };
    })
    .sort((a, b) => b.red - a.red || b.uncontacted - a.uncontacted || a.mentor.localeCompare(b.mentor));
}

export interface Move { student_id: string; name: string; from: string; to: string; reason: string }

/**
 * Suggests moving Red students from overloaded mentors to lighter ones in the same department. It never moves a
 * student a mentor is already working with, and it stops once the gap is within the tolerance. Suggestions only:
 * an administrator applies them.
 */
export function suggestRebalance(
  rows: StudentRow[], cases: CaseRow[], mentors: { faculty_id: string; department: string }[],
  now: Date = new Date(), opts: { tolerance?: number; maxMoves?: number } = {},
): Move[] {
  const tolerance = opts.tolerance ?? 2;
  const maxMoves = opts.maxMoves ?? 10;
  const moves: Move[] = [];
  const moved = new Set<string>();
  const redCount = new Map<string, number>();
  for (const m of mentors) redCount.set(m.faculty_id, 0);
  for (const r of rows) if (isRed(r) && r.mentor_faculty_id && redCount.has(r.mentor_faculty_id)) redCount.set(r.mentor_faculty_id, (redCount.get(r.mentor_faculty_id) ?? 0) + 1);

  const departments = Array.from(new Set(mentors.map((m) => m.department)));
  for (const dept of departments) {
    const team = mentors.filter((m) => m.department === dept).map((m) => m.faculty_id);
    while (moves.length < maxMoves) {
      const sorted = [...team].sort((a, b) => (redCount.get(b) ?? 0) - (redCount.get(a) ?? 0));
      const donor = sorted[0];
      const receiver = sorted[sorted.length - 1];
      if (!donor || donor === receiver || (redCount.get(donor) ?? 0) - (redCount.get(receiver) ?? 0) <= tolerance) break;
      const candidate = rows
        .filter((r) => r.mentor_faculty_id === donor && isRed(r) && !moved.has(r.student_id) && contactState(r.student_id, cases, now).kind === "never")
        .sort((a, b) => a.priority - b.priority)[0];
      if (!candidate) break;
      moved.add(candidate.student_id);
      redCount.set(donor, (redCount.get(donor) ?? 0) - 1);
      redCount.set(receiver, (redCount.get(receiver) ?? 0) + 1);
      moves.push({
        student_id: candidate.student_id, name: candidate.name, from: donor, to: receiver,
        reason: `${donor} has ${(redCount.get(donor) ?? 0) + 1} Red students and ${receiver} has ${(redCount.get(receiver) ?? 0) - 1}; this student has not been contacted yet`,
      });
    }
  }
  return moves;
}
