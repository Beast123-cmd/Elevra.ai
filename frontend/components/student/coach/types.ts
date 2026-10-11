/** Shapes written by backend/routers/interview.py (mock_interviews.feedback v2) and the coaching tables (003 proposal). */
export type CriterionKey = "communication" | "technical_depth" | "problem_solving" | "project_knowledge";

export const CRITERIA: { key: CriterionKey; label: string }[] = [
  { key: "communication", label: "Communication" }, { key: "technical_depth", label: "Technical depth" },
  { key: "problem_solving", label: "Problem solving" }, { key: "project_knowledge", label: "Project knowledge" },
];

export interface QuestionReview {
  question: string; answer_summary: string; rating: number; good: string; missing: string; stronger: string[];
}
export interface FocusArea { topic: string; label: string; category: CriterionKey }
export interface PlanItem { day: number; task: string; topic: string }
export interface Revisit { topic: string; label?: string; result: "improved" | "resolved" | "gap" }

export interface CoachFeedback {
  criteria: Record<CriterionKey, number> | null;
  strengths: string[]; gaps: string[]; next_steps: string[];
  minutes?: number; questions?: number; mode?: "full" | "focus"; version?: number;
  per_question?: QuestionReview[]; focus_areas?: FocusArea[]; plan?: PlanItem[]; revisited?: Revisit[];
}

/** A row of interview_practice_tasks. */
export interface PracticeTask { id: number; day: number; task: string; done: boolean; interview_id?: number; focus_area_id?: number | null }

/** A row of interview_focus_areas. */
export interface FocusRow {
  id: number; topic: string; label: string; category: CriterionKey;
  status: "open" | "improving" | "resolved"; times_seen: number; last_result: "gap" | "improved" | "resolved" | null;
  updated_at: string;
}

export const STATUS_STYLE: Record<FocusRow["status"], { label: string; chip: string }> = {
  open: { label: "Needs practice", chip: "bg-amber-50 text-amber-900 ring-amber-100" },
  improving: { label: "Improving", chip: "bg-blue-50 text-blue-800 ring-blue-100" },
  resolved: { label: "Strong now", chip: "bg-[#eaf3ef] text-[#18574e] ring-[#d3e7dd]" },
};

export const REVISIT_LABEL: Record<Revisit["result"], string> = {
  resolved: "Strong now", improved: "Improved", gap: "Still needs practice",
};
