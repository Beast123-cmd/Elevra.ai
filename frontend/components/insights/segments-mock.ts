import type { Pillar } from "@/lib/types";

export interface SegmentDef { name: string; rule: string; action: string }
export interface StudentRow {
  student_id: string; name: string; department: string; year: number;
  success_score: number | null; band: string | null; priority: number | null; segment: string | null;
  academic: number | null; attendance: number | null; lms: number | null; placement: number | null;
  skills: number | null; engagement: number | null; feedback: number | null;
}
export interface SegmentsData { defs: SegmentDef[]; students: StudentRow[] }
export type PillarKey = Pillar;

export const SEGMENT_DEFS: SegmentDef[] = [
  { name: "Silent disengagers", rule: "Sharp LMS drop or attendance falling >= 10 pp over 4 weeks", action: "Mentor call within 48 hours" },
  { name: "Academic stars, placement unready", rule: "Academic >= 75 and placement < 55", action: "Coding practice + 2 mock interviews" },
  { name: "Engaged but struggling", rule: "Co-curricular >= 60 and academic < 55", action: "Remedial classes + mentoring" },
  { name: "Skilled but irregular", rule: "Skills >= 70 and attendance < 75", action: "Attendance counselling" },
  { name: "Placement-ready all-rounders", rule: "Score >= 75 and placement >= 70", action: "Advanced opportunities + peer mentoring" },
  { name: "Steady middle", rule: "No major pattern", action: "Monthly nudges" },
];

// Deterministic sample so ?mock=1 always looks the same.
const DEPTS = ["Comp", "IT", "ENTC", "AI&DS"];
const PROFILES: Record<string, number[]> = {
  "Silent disengagers": [55, 50, 38, 52, 55, 40, 60],
  "Academic stars, placement unready": [82, 78, 66, 40, 60, 45, 70],
  "Engaged but struggling": [48, 62, 55, 55, 58, 72, 60],
  "Skilled but irregular": [60, 68, 62, 58, 78, 50, 62],
  "Placement-ready all-rounders": [84, 86, 80, 82, 80, 65, 78],
  "Steady middle": [64, 76, 64, 62, 62, 40, 66],
};
const COUNTS = [90, 120, 80, 70, 110, 330];

export function mockSegments(): SegmentsData {
  const students: StudentRow[] = [];
  let n = 0;
  SEGMENT_DEFS.forEach((d, si) => {
    for (let i = 0; i < COUNTS[si]; i++, n++) {
      const j = ((n * 37) % 11) - 5;
      const v = PROFILES[d.name].map((x) => Math.max(0, Math.min(100, x + j)));
      students.push({
        student_id: String(40000 + n), name: `Sample Student ${n + 1}`, department: DEPTS[n % 4], year: 2 + (n % 3),
        success_score: Math.round(v.reduce((a, b) => a + b, 0) / 7 * 10) / 10, band: null,
        priority: Math.round(((n * 53) % 100)) / 10, segment: d.name,
        academic: v[0], attendance: v[1], lms: v[2], placement: v[3], skills: v[4], engagement: v[5], feedback: v[6],
      });
    }
  });
  return { defs: SEGMENT_DEFS, students };
}
