import type { DataHealthData } from "./data-health-types";

// Sample data for previewing the page with ?mock=1 before the pipeline has seeded Supabase.
export const MOCK_DATA_HEALTH: DataHealthData = {
  nStudents: 1500,
  sources: [
    { source: "Registry", file: "students.csv", id_format: "42178", rows_in: 1500, rows_out: 1500, students_covered_pct: 100 },
    { source: "Academic", file: "academic.csv", id_format: "SCA-42178", rows_in: 5840, rows_out: 5712, students_covered_pct: 100 },
    { source: "Attendance", file: "attendance.csv", id_format: "sca42178", rows_in: 96400, rows_out: 95980, students_covered_pct: 99.6 },
    { source: "LMS", file: "lms.csv", id_format: "42178@campus.edu", rows_in: 143000, rows_out: 141200, students_covered_pct: 98.9 },
    { source: "Engagement", file: "engagement.csv", id_format: "42178", rows_in: 7200, rows_out: 7150, students_covered_pct: 91.4 },
    { source: "Placement", file: "placement.csv", id_format: "SCA-42178 (padded)", rows_in: 1020, rows_out: 1018, students_covered_pct: 68.0 },
    { source: "Skills", file: "skills.csv", id_format: "42178", rows_in: 8900, rows_out: 8900, students_covered_pct: 97.2 },
    { source: "Feedback", file: "feedback.csv", id_format: "sca-42178", rows_in: 3900, rows_out: 3866, students_covered_pct: 94.5 },
  ],
  quality: [
    { id: 1, source: "Attendance", issue: "ID formats differed from registry (sca42178, trailing spaces)", rows_affected: 412, action: "Normalised to 5-digit student_id" },
    { id: 2, source: "LMS", issue: "Email-style IDs, 5% upper-case", rows_affected: 7150, action: "Extracted 5-digit id from email" },
    { id: 3, source: "Academic", issue: "Department names inconsistent (E&TC, AIDS, Comp Engg)", rows_affected: 1180, action: "Mapped to Comp / IT / ENTC / AI&DS" },
    { id: 4, source: "Academic", issue: "Duplicate semester rows", rows_affected: 128, action: "Kept latest, removed duplicates" },
    { id: 5, source: "Attendance", issue: "Percentages stored as fractions (0–1)", rows_affected: 2890, action: "Multiplied by 100" },
    { id: 6, source: "Placement", issue: "Blank mock-interview score (not taken)", rows_affected: 153, action: "Left empty; pillar re-weighted, not scored 0" },
    { id: 7, source: "Skills", issue: "Mixed 0–10 and 0–100 scales", rows_affected: 1840, action: "Rescaled to 0–100" },
    { id: 8, source: "LMS", issue: "Negative or impossible minutes", rows_affected: 61, action: "Set to empty and logged" },
  ],
};
