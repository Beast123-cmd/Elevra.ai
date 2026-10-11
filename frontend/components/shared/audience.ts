/**
 * Notification audiences are stored as one string: 'all' | 'dept:<name>' | 'year:<2-4>' | 'student:<id>'.
 * Admins write them with buildAudience; the student feed filters with matchesAudience.
 */
export type AudienceKind = "all" | "dept" | "year" | "student";
export type Built = { ok: true; value: string } | { ok: false; error: string };

export function buildAudience(kind: string, raw: string): Built {
  const v = raw.trim();
  if (kind === "all") return { ok: true, value: "all" };
  if (kind === "dept") return v ? { ok: true, value: `dept:${v}` } : { ok: false, error: "Choose a department." };
  if (kind === "year") return /^[1-4]$/.test(v) ? { ok: true, value: `year:${v}` } : { ok: false, error: "Choose a year from 1 to 4." };
  if (kind === "student") return /^\d{5}$/.test(v) ? { ok: true, value: `student:${v}` } : { ok: false, error: "Enter a 5-digit student id." };
  return { ok: false, error: "Unknown audience type." };
}

export function matchesAudience(audience: string, s: { student_id: string; department: string; year: number }): boolean {
  if (audience === "all") return true;
  const i = audience.indexOf(":");
  if (i < 0) return false;
  const kind = audience.slice(0, i);
  const value = audience.slice(i + 1);
  if (!value) return false;
  if (kind === "dept") return s.department === value;
  if (kind === "year") return String(s.year) === value;
  if (kind === "student") return s.student_id === value;
  return false;
}

export function describeAudience(audience: string): string {
  if (audience === "all") return "Everyone";
  const i = audience.indexOf(":");
  const kind = audience.slice(0, i);
  const value = audience.slice(i + 1);
  if (i > 0 && value) {
    if (kind === "dept") return `Department: ${value}`;
    if (kind === "year") return `Year ${value}`;
    if (kind === "student") return `Student ${value}`;
  }
  return "Unknown audience";
}
