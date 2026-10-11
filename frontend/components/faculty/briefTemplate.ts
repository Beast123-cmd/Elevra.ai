import type { Profile, Risk } from "../../lib/types.ts";

const drivers = (r: Risk, n = 2) =>
  (r.drivers ?? []).slice(0, n).map((d) => `${d.label} (${d.value})`).join("; ");

/**
 * The same standard summary the API falls back to, built in the browser so a mentor still gets a brief when the
 * API is offline. Uses the name (never a guessed pronoun) and the "needs a check-in" framing.
 */
export function localBrief(p: Profile): string {
  const acad = p.academic_risk;
  const place = p.placement_risk;
  const parts = [
    `${p.name} (${p.department}, year ${p.year}) has a success score of ${Number(p.score).toFixed(1)} (${p.band}) with ${p.confidence ?? 100}% data confidence.`,
  ];
  if (acad.level === "Red" || acad.level === "Amber") parts.push(`Academic risk is ${acad.level}, mainly because of ${drivers(acad)}.`);
  if (place.level === "Not assessed") parts.push("Placement readiness is not yet assessed.");
  else if (place.level === "Red" || place.level === "Amber") parts.push(`Placement risk is ${place.level}, mainly because of ${drivers(place)}.`);
  if (p.engagement_drop) parts.push("LMS activity has dropped sharply in recent weeks, an early sign worth asking about.");
  if (p.declining) parts.push("The score has been declining over the last two semesters.");
  const flagged = acad.level === "Red" || acad.level === "Amber" || place.level === "Red" || place.level === "Amber" || p.engagement_drop;
  if (!flagged) parts.push(`No risk flags this week; ${p.name} appears to be on track.`);
  const actions = (p.actions ?? []).slice(0, 3);
  if (actions.length > 0) parts.push(`Suggested next steps: ${actions.map((a) => a.replace(/\.$/, "")).join("; ")}.`);
  parts.push("Treat these flags as a prompt for a conversation, not a judgement.");
  return parts.join(" ");
}
