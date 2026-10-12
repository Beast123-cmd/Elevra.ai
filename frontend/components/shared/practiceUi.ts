/** Types and display helpers for the practice analytics (mock tests, daily challenges, login streak). */

export const TOPIC_LABEL: Record<string, string> = { aptitude: "Aptitude", sql: "SQL", cpp: "C++", mcq: "MCQ", coding: "Coding" };
export const LEVEL_LABEL: Record<string, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };

export interface LevelStat { completed: number; avg_score: number | null }
export interface TopicStat {
  category: string; completed: number; gave_up: number; avg_score: number | null; completion_rate: number | null;
  by_difficulty: Record<string, LevelStat>;
}
export interface GroupShare { group: string; students: number; practised: number }
export interface Participation {
  total_students: number; practised_this_week: number; practised_last_week: number; checked_in_this_week: number;
  by_department: GroupShare[]; by_year: GroupShare[];
}
export interface PracticeOverview { as_of: string; topic_window_days: number; topics: TopicStat[]; participation: Participation }

export interface RecentTest { date: string; category: string; difficulty: string; mode: string; score_percent: number }
export interface StudentPractice {
  student_id: string; current_streak: number; best_streak: number; active_days_30: number; last_active: string | null;
  tests_completed: number; tests_gave_up: number; avg_score: number | null; trend: "up" | "down" | "steady" | null; recent_tests: RecentTest[];
}

/** Below this average a topic is shown as one that may need practice. */
export const PRACTICE_BELOW = 50;

export const share = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/** Topics with results first, lowest average first (where practice would help most); topics nobody took go last. */
export function topicsByNeed(topics: TopicStat[]): TopicStat[] {
  const rank = (t: TopicStat) => (t.avg_score === null ? Number.POSITIVE_INFINITY : t.avg_score);
  return [...topics].sort((a, b) => rank(a) - rank(b));
}

export const hasResults = (topics: TopicStat[]) => topics.some((t) => t.completed > 0);

export type ScoreTone = "red" | "amber" | "green";
export const scoreTone = (score: number): ScoreTone => (score < PRACTICE_BELOW ? "red" : score < 70 ? "amber" : "green");

/** "5 more than last week", "same as last week". Plain words, no arrows to decode. */
export function weekChange(thisWeek: number, lastWeek: number): string {
  const diff = thisWeek - lastWeek;
  if (diff === 0) return "same as last week";
  return `${Math.abs(diff)} ${diff > 0 ? "more" : "fewer"} than last week`;
}

/** Whole days from an ISO date (YYYY-MM-DD) to today, in the viewer's calendar. */
export function daysSince(iso: string, today: Date = new Date()): number {
  const [y, m, d] = iso.split("-").map(Number);
  const then = Date.UTC(y, m - 1, d);
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((now - then) / 86_400_000);
}

export function lastActiveText(iso: string | null, today: Date = new Date()): string {
  if (!iso) return "No practice yet";
  const days = daysSince(iso, today);
  return days <= 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
}

/** A gentle prompt for the mentor, not a judgement: nothing practised for a week or more (or ever). */
export const quietForAWeek = (iso: string | null, today: Date = new Date()) => iso === null || daysSince(iso, today) >= 7;

export const TREND_TEXT: Record<NonNullable<StudentPractice["trend"]>, string> = {
  up: "Recent test scores are rising", down: "Recent test scores are dropping", steady: "Recent test scores are steady",
};
