import type { Pillar } from "../../lib/types";

export interface SkillRow { skill: string; category: string; level: number }
export interface CourseLike {
  title: string; tag: string; skills: Pillar[]; departments: string[];
  trains?: string[]; level?: "Beginner" | "Intermediate" | "Advanced";
}
export type Group = "gap" | "deeper" | "placement" | "other";
export interface Recommendation<C extends CourseLike> { course: C; group: Group; score: number; reason: string; skill?: string }

export const GROUP_LABEL: Record<Group, { title: string; hint: string }> = {
  gap: { title: "Fix a gap", hint: "Skills where you score lowest" },
  deeper: { title: "Go deeper", hint: "Build on what you are already good at" },
  placement: { title: "For placement", hint: "Skills campus drives ask for" },
  other: { title: "More for you", hint: "Rest of the catalog for your branch" },
};

const GAP_BELOW = 55;      // a skill under this counts as a gap
const STRONG_FROM = 70;    // a skill from this counts as a strength
const PLACEMENT_SKILLS = new Set(["DSA", "Problem solving", "Logical reasoning", "Communication", "English language", "Public speaking", "Databases", "Python"]);

/** The course level that suits a given skill level. */
export function levelFor(skillLevel: number): "Beginner" | "Intermediate" | "Advanced" {
  return skillLevel < 50 ? "Beginner" : skillLevel < 75 ? "Intermediate" : "Advanced";
}
const RANK = { Beginner: 0, Intermediate: 1, Advanced: 2 } as const;

/** Ranks the catalog for one student from their real skill levels. Pure and deterministic. */
export function recommend<C extends CourseLike>(
  catalog: C[], skills: SkillRow[], department: string, weakPillars: Pillar[] = [], placementWeak = false,
): Recommendation<C>[] {
  const level = new Map(skills.map((s) => [s.skill, s.level]));
  const out: Recommendation<C>[] = [];
  for (const course of catalog) {
    if (course.departments.length && !course.departments.includes(department)) continue;
    const trained = (course.trains ?? []).filter((t) => level.has(t));
    // The skill this course is mainly for = the student's weakest trained skill that it covers (else the first).
    const main = trained.length ? trained.reduce((a, b) => (level.get(a)! <= level.get(b)! ? a : b)) : undefined;
    const L = main ? level.get(main)! : undefined;
    const fit = L !== undefined && course.level ? 1 - Math.min(1, Math.abs(RANK[levelFor(L)] - RANK[course.level]) / 2) : 0.5;
    const helpsWeakPillar = course.skills.some((p) => weakPillars.includes(p));
    let group: Group = "other"; let score = helpsWeakPillar ? 10 : 0; let reason = "";
    if (main && L !== undefined) {
      if (L < GAP_BELOW) {
        group = "gap"; score = 100 + (GAP_BELOW - L) * 1.2 + fit * 25;
        reason = `Your ${main} is ${Math.round(L)}/100 — one of your lower skills. ${course.level ?? "This"} level suits where you are.`;
      } else if (L >= STRONG_FROM && course.level && RANK[course.level] >= 1) {
        group = "deeper"; score = 60 + (L - STRONG_FROM) * 0.6 + fit * 20;
        reason = `You already score ${Math.round(L)}/100 in ${main}. This ${course.level.toLowerCase()} course takes it further.`;
      } else if (placementWeak && trained.some((t) => PLACEMENT_SKILLS.has(t)) && course.skills.includes("placement")) {
        group = "placement"; score = 70 + fit * 20;
        reason = `Placement drives test ${main}, and yours is ${Math.round(L)}/100.`;
      } else {
        score = 30 + fit * 20 + (helpsWeakPillar ? 10 : 0);
        reason = `Builds ${main} (you are at ${Math.round(L)}/100).`;
      }
    } else if (placementWeak && course.skills.includes("placement")) {
      group = "placement"; score = 40; reason = "Helps your placement readiness, which is your weakest area right now.";
    } else if (helpsWeakPillar) {
      reason = "Helps one of your weaker score areas.";
    }
    out.push({ course, group, score, reason, skill: main });
  }
  return out.sort((a, b) => b.score - a.score || a.course.title.localeCompare(b.course.title));
}

/** Skills where the student is weakest, for a short summary line. */
export function weakestSkills(skills: SkillRow[], n = 3): SkillRow[] {
  return [...skills].sort((a, b) => a.level - b.level).slice(0, n);
}
