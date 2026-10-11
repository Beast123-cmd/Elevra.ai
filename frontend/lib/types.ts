export const PILLARS = ["academic", "attendance", "lms", "placement", "skills", "engagement", "feedback"] as const;
export type Pillar = (typeof PILLARS)[number];
export type Tier = "Red" | "Amber" | "Green" | "Not assessed";
export type Role = "admin" | "faculty" | "student";
export interface Driver { label: string; value: string; points: number }
export interface Risk { level: Tier; points: number; drivers: Driver[] }
export interface Profile {
  student_id: string; name: string; department: string; year: number; batch: string; section: string;
  gender: string; residence: string; mentor_faculty_id: string;
  pillars: Record<Pillar, number | null>;
  score: number; band: string; confidence: number; missing: Pillar[];
  contributions: { pillar: Pillar; points: number }[];
  academic_risk: Risk; placement_risk: Risk;
  model: { prob: number; factors: { feature: string; label: string; effect: number }[] };
  segment: string; priority: number; actions: string[]; engagement_drop: boolean; declining: boolean;
  metrics: Record<string, number | null>;
  percentiles: Record<string, number>;
  weekly: { week: number; logins: number | null; attendance: number | null; submit_rate: number | null }[];
  history: { semester: number; score: number; sgpa: number | null }[];
}
export interface Cohort {
  generated_at: string; current_week: number; n_students: number;
  weights: Record<Pillar, number>; bands: { min: number; name: string }[]; pillar_labels: Record<Pillar, string>;
  pillar_means: Record<Pillar, number>;
  dept_pillars: ({ dept: string } & Record<Pillar, number>)[];
  weekly_trend: { week: number; dept: string; logins: number; attendance: number }[];
  lead_time: { week: number; failed_logins: number; passed_logins: number; failed_attendance: number; passed_attendance: number }[];
  segments: { name: string; rule: string; action: string; count: number }[];
}
export interface ModelCard {
  features: { name: string; label: string; coef: number; mean: number; std: number }[]; intercept: number;
  metrics: {
    target: string; train_window: string; n_train: number; n_test: number; base_rate: number; threshold: number;
    auc: number; cv_auc: number; precision: number; recall: number; f1: number;
    baseline: { rule: string; auc: number; precision: number; recall: number; f1: number };
  };
  fairness: { group_type: string; group: string; n: number; flag_rate: number | null; recall: number | null; fpr: number | null }[];
}
export interface Insight { id: string; title: string; detail: string; severity: "info" | "warning" | "critical" }
export interface WhatIfResponse {
  score: number; band: string; delta: number; pillars: Record<Pillar, number | null>;
  academic_risk: Risk; placement_risk: Risk;
}
