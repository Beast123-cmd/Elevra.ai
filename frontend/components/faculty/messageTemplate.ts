import type { Profile } from "../../lib/types.ts";

export const MESSAGE_KINDS = [
  ["student_checkin", "Check-in"],
  ["guardian_attendance", "Guardian: attendance"],
  ["placement_nudge", "Placement nudge"],
  ["encouragement", "Encouragement"],
] as const;
export type MessageKind = (typeof MESSAGE_KINDS)[number][0];

const PLACEMENT_ACTION = /mock|coding|aptitude|interview|bootcamp|placement/i;

/**
 * The same standard draft the API falls back to, built in the browser so a mentor can still write to a student when
 * the API is offline. Never quotes a score or a risk colour, never guesses a pronoun.
 */
export function localMessage(kind: MessageKind, p: Pick<Profile, "name" | "actions">): string {
  const name = p.name;
  if (kind === "guardian_attendance") {
    return `Dear Parent/Guardian, I am ${name}'s mentor. I would like to speak with you about ${name}'s attendance this term, so that we can support them together before it affects their eligibility for exams. Could we have a short call this week? Thank you for your support.`;
  }
  if (kind === "placement_nudge") {
    const step = ((p.actions ?? []).find((a) => PLACEMENT_ACTION.test(a)) ?? "pick one coding or aptitude practice task and finish it by Friday").replace(/\.$/, "");
    return `Hi ${name}, placement season is closer than it feels. A good step for this week: ${step.charAt(0).toLowerCase() + step.slice(1)}. Send me what you finish and I will give feedback. Happy to help you plan the rest.`;
  }
  if (kind === "encouragement") {
    return `Hi ${name}, I wanted to say that your effort has not gone unnoticed. Keep going, and if anything is getting in the way, tell me and we will sort it out together.`;
  }
  return `Hi ${name}, this is your mentor checking in. I would like to hear how things are going and see how I can help. Do you have a few minutes this week for a quick chat? No pressure; this is just to support you.`;
}

export const whatsappUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;
export const mailtoUrl = (subject: string, text: string) => `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
