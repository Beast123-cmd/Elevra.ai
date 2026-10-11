import type { Profile } from "@/lib/types";

// Sample student for previewing /student?mock=1 before the pipeline has seeded Supabase.
export const MOCK_PROFILE: Profile = {
  student_id: "42178", name: "Sample Student", department: "Comp", year: 3, batch: "2023-27", section: "B",
  gender: "F", residence: "Hostel", mentor_faculty_id: "F01",
  pillars: { academic: 62, attendance: 68, lms: 55, placement: 41, skills: 58, engagement: 35, feedback: 72 },
  score: 56.4, band: "Needs Attention", confidence: 100, missing: [],
  contributions: [
    { pillar: "placement", points: -4.1 },
    { pillar: "attendance", points: -2.6 },
    { pillar: "feedback", points: 1.2 },
  ],
  academic_risk: {
    level: "Amber", points: 4,
    drivers: [
      { label: "Attendance below 75% mandate", value: "68%", points: 2 },
      { label: "Active backlogs", value: "1", points: 2 },
    ],
  },
  placement_risk: {
    level: "Red", points: 7,
    drivers: [
      { label: "Placement readiness below 50", value: "41", points: 3 },
      { label: "Coding score below 40", value: "34", points: 2 },
      { label: "Weak or no mock interview", value: "none", points: 1 },
    ],
  },
  model: { prob: 0.42, factors: [] },
  segment: "Academic stars, placement unready", priority: 8.2,
  actions: ["Coding practice track (2 problems/day)", "Take 2 mock interviews (in-app)"],
  engagement_drop: false, declining: false,
  metrics: { cgpa: 7.1, backlogs: 1, attendance_pct: 68, internal_pct: 64, certifications: 0, hackathons: 0, events: 2, clubs: 1 },
  percentiles: { coding: 18 }, weekly: [], history: [],
};
