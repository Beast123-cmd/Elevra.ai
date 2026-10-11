import { csvCell } from "../shared/attendance.ts";

/**
 * Evidence for accreditation-style reviews (for example NAAC criterion 2.2: identifying slow and advanced learners,
 * mentoring arrangements, and the support given). Pure functions so the numbers can be tested; the page only
 * fetches and renders. Thresholds are editable because institutions define "slow" and "advanced" differently.
 */
export interface Learner { student_id: string; name: string; department: string; year: number; mentor_faculty_id: string | null; academic: number | null; success_score: number }
export interface Thresholds { slowBelow: number; advancedAbove: number }
export const DEFAULT_THRESHOLDS: Thresholds = { slowBelow: 50, advancedAbove: 75 };

export type Group = "Slow" | "Average" | "Advanced" | "Not assessed";

export function classify(academic: number | null | undefined, t: Thresholds = DEFAULT_THRESHOLDS): Group {
  if (academic == null || !Number.isFinite(academic)) return "Not assessed";
  if (academic < t.slowBelow) return "Slow";
  if (academic > t.advancedAbove) return "Advanced";
  return "Average";
}

export interface DeptRow { department: string; total: number; slow: number; average: number; advanced: number; notAssessed: number; slowPct: number; advancedPct: number }
const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 1000) / 10);

export function byDepartment(rows: Learner[], t: Thresholds = DEFAULT_THRESHOLDS): { depts: DeptRow[]; all: DeptRow } {
  const make = (department: string, subset: Learner[]): DeptRow => {
    const g = subset.map((r) => classify(r.academic, t));
    const count = (k: Group) => g.filter((x) => x === k).length;
    const assessed = subset.length - count("Not assessed");
    return {
      department, total: subset.length, slow: count("Slow"), average: count("Average"), advanced: count("Advanced"),
      notAssessed: count("Not assessed"), slowPct: pct(count("Slow"), assessed), advancedPct: pct(count("Advanced"), assessed),
    };
  };
  const names = Array.from(new Set(rows.map((r) => r.department))).sort();
  return { depts: names.map((d) => make(d, rows.filter((r) => r.department === d))), all: make("All departments", rows) };
}

export interface MentorRow { mentor: string; name: string; department: string; mentees: number }
export function mentorAllocation(rows: Learner[], faculty: { faculty_id: string; name: string; department: string }[]): MentorRow[] {
  const counts = new Map<string, number>();
  for (const r of rows) if (r.mentor_faculty_id) counts.set(r.mentor_faculty_id, (counts.get(r.mentor_faculty_id) ?? 0) + 1);
  const out = faculty.map((f) => ({ mentor: f.faculty_id, name: f.name, department: f.department, mentees: counts.get(f.faculty_id) ?? 0 }));
  const unassigned = rows.filter((r) => !r.mentor_faculty_id).length;
  if (unassigned > 0) out.push({ mentor: "-", name: "No mentor assigned", department: "-", mentees: unassigned });
  return out.sort((a, b) => b.mentees - a.mentees || a.mentor.localeCompare(b.mentor));
}

export interface SupportRow { id: number; student_id: string; faculty_id: string | null; type: string; status: string; created_at: string; is_seeded: boolean }
export function supportSummary(rows: SupportRow[]) {
  const live = rows.filter((r) => !r.is_seeded);
  const byType = new Map<string, number>();
  for (const r of live) byType.set(r.type, (byType.get(r.type) ?? 0) + 1);
  return {
    live: live.length,
    seeded: rows.length - live.length,
    students: new Set(live.map((r) => r.student_id)).size,
    done: live.filter((r) => r.status === "done").length,
    byType: Array.from(byType.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
  };
}

/** How many slow learners have at least one live support record: the question reviewers ask. */
export function slowLearnerSupport(rows: Learner[], support: SupportRow[], t: Thresholds = DEFAULT_THRESHOLDS) {
  const slow = rows.filter((r) => classify(r.academic, t) === "Slow");
  const supported = new Set(support.filter((s) => !s.is_seeded).map((s) => s.student_id));
  const withSupport = slow.filter((r) => supported.has(r.student_id)).length;
  return { slow: slow.length, withSupport, pct: pct(withSupport, slow.length) };
}

export function learnersCsv(rows: Learner[], t: Thresholds = DEFAULT_THRESHOLDS): string {
  const head = ["Student ID", "Name", "Department", "Year", "Mentor", "Academic score", "Group"];
  const lines = rows.map((r) => [r.student_id, r.name, r.department, r.year, r.mentor_faculty_id, r.academic, classify(r.academic, t)].map(csvCell).join(","));
  return [head.map(csvCell).join(","), ...lines].join("\n");
}

export function mentorsCsv(rows: MentorRow[]): string {
  const head = ["Mentor ID", "Name", "Department", "Mentees"];
  return [head.map(csvCell).join(","), ...rows.map((r) => [r.mentor, r.name, r.department, r.mentees].map(csvCell).join(","))].join("\n");
}

export function supportCsv(rows: SupportRow[]): string {
  const head = ["Record", "Student ID", "Mentor", "Type", "Status", "Logged on"];
  const lines = rows.filter((r) => !r.is_seeded).map((r) => [r.id, r.student_id, r.faculty_id, r.type, r.status, r.created_at.slice(0, 10)].map(csvCell).join(","));
  return [head.map(csvCell).join(","), ...lines].join("\n");
}
