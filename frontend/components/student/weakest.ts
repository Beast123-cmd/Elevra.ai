import { PILLARS, type Pillar, type Profile } from "@/lib/types";

/** The student's lowest-scoring areas that actually have data (missing areas are never treated as weak). */
export function weakestPillars(p: Profile, n = 2): { pillar: Pillar; value: number }[] {
  return PILLARS.flatMap((k) => (p.pillars[k] === null ? [] : [{ pillar: k, value: p.pillars[k] as number }]))
    .sort((a, b) => a.value - b.value)
    .slice(0, n);
}
