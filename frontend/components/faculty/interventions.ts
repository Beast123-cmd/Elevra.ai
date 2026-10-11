/** Must match the check constraint on interventions.type in db/migrations/001_init.sql (a test enforces this). */
export const INTERVENTION_TYPES = [
  "Mentoring call", "Remedial classes", "Coding bootcamp", "Attendance counselling", "Mock interviews", "Wellbeing referral",
] as const;
export type InterventionType = (typeof INTERVENTION_TYPES)[number];
export const STATUSES = ["planned", "in_progress", "done"] as const;
export type Status = (typeof STATUSES)[number];

export interface InterventionForm { type: string; note: string; followup_date: string }
export const NOTE_MAX = 500;

function isRealDate(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]);
}

/** Returns a map of field -> message. An empty object means the form is valid. */
export function validateIntervention(f: InterventionForm, now: Date = new Date()): Partial<Record<keyof InterventionForm, string>> {
  const errors: Partial<Record<keyof InterventionForm, string>> = {};
  if (!(INTERVENTION_TYPES as readonly string[]).includes(f.type)) errors.type = "Choose an intervention type.";
  if (f.note.length > NOTE_MAX) errors.note = `Keep the note under ${NOTE_MAX} characters.`;
  if (f.followup_date) {
    if (!isRealDate(f.followup_date)) errors.followup_date = "Enter a valid date.";
    else {
      const [y, m, d] = f.followup_date.split("-").map(Number);
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (new Date(y, m - 1, d) < today) errors.followup_date = "The follow-up date cannot be in the past.";
    }
  }
  return errors;
}

/** Faculty may open only their own mentees (admins may open anyone). RLS tightening comes later; this guards the UI now. */
export function canViewStudent(user: { role: string; facultyId: string | null }, studentMentorId: string | null): boolean {
  if (user.role === "admin") return true;
  return user.role === "faculty" && !!user.facultyId && user.facultyId === studentMentorId;
}
