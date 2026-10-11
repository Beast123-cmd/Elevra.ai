import type { Cohort, Profile } from "@/lib/types";

/** Development fixtures that match lib/types.ts exactly. Replace with Supabase reads once Aayush's seed is in. */
export const MOCK_PROFILE: Profile = {
  student_id: "42178", name: "Aarav Sharma", department: "Comp", year: 3, batch: "2023-27", section: "A",
  gender: "M", residence: "Day Scholar", mentor_faculty_id: "F01",
  pillars: { academic: 52, attendance: 61, lms: 38, placement: 64, skills: 58, engagement: 25, feedback: 70 },
  score: 51.9, band: "Needs Attention", confidence: 100, missing: [],
  contributions: [
    { pillar: "lms", points: -6.4 }, { pillar: "attendance", points: -5.1 }, { pillar: "academic", points: -4.2 },
    { pillar: "engagement", points: -2.3 }, { pillar: "skills", points: -1.1 }, { pillar: "feedback", points: 2.4 },
    { pillar: "placement", points: 1.6 },
  ],
  academic_risk: {
    level: "Red", points: 9,
    drivers: [
      { label: "Attendance below detention line (65%)", value: "61%", points: 4 },
      { label: "Internal marks below 50%", value: "46%", points: 2 },
      { label: "LMS activity dropped sharply (wk 6-8 vs 1-4)", value: "-62%", points: 2 },
      { label: "Assignment submission below 60%", value: "48%", points: 1 },
    ],
  },
  placement_risk: {
    level: "Amber", points: 3,
    drivers: [
      { label: "Weak or no mock interview", value: "none", points: 1 },
      { label: "No verified hackathons or certifications", value: "0", points: 1 },
      { label: "Technical skill below 50", value: "44", points: 1 },
    ],
  },
  model: {
    prob: 0.71,
    factors: [
      { feature: "attendance_pct", label: "Attendance %", effect: 0.84 },
      { feature: "login_trend", label: "LMS trend", effect: 0.61 },
      { feature: "internal_pct", label: "Internal marks %", effect: 0.4 },
    ],
  },
  segment: "Silent disengagers", priority: 13.1, actions: [
    "Attendance counselling + guardian contact", "Mentor call within 48h (early warning)", "Take 2 mock interviews (in-app)",
  ],
  engagement_drop: true, declining: true,
  metrics: {
    cgpa: 6.4, backlogs: 1, internal_pct: 46, attendance_pct: 61, min_subject_attendance: 48, submit_rate: 0.48,
    login_consistency: 0.5, aptitude: 62, coding: 58, mock: null, tech_skill: 44, soft_skill: 70, certifications: 0,
    events: 1, clubs: 0, hackathons: 0, satisfaction: 3.5, faculty_rating: 4,
  },
  percentiles: { coding: 42, attendance: 12 },
  weekly: [3, 4, 4, 3, 2, 1, 1, 0].map((logins, i) => ({
    week: i + 1, logins, attendance: [88, 85, 82, 76, 70, 64, 60, 58][i], submit_rate: i < 4 ? 0.8 : 0.3,
  })),
  history: [{ semester: 1, score: 66, sgpa: 7.2 }, { semester: 2, score: 61, sgpa: 6.8 }, { semester: 3, score: 55, sgpa: 6.1 }, { semester: 4, score: 51.9, sgpa: null }],
};

export const MOCK_COHORT_MEANS: Cohort["pillar_means"] = {
  academic: 66, attendance: 80, lms: 62, placement: 58, skills: 63, engagement: 31, feedback: 68,
};
