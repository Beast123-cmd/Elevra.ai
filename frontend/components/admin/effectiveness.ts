export interface InterventionOutcome { type: string; score_before: number | null; score_after: number | null }

const round1 = (n: number) => Math.round(n * 10) / 10;
/** Postgres numerics can arrive as strings; null means "not recorded". */
const num = (v: unknown): number | null => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? null : Number(v));

/**
 * Average score change per intervention type. Only interventions with both a before and an
 * after score count; the rest are reported as `pending` so they are never mistaken for "no change".
 */
export function effectiveness(items: InterventionOutcome[]) {
  const byType = new Map<string, number[]>();
  let pending = 0;
  for (const i of items) {
    const before = num(i.score_before);
    const after = num(i.score_after);
    if (before === null || after === null) {
      pending += 1;
      continue;
    }
    byType.set(i.type, [...(byType.get(i.type) ?? []), after - before]);
  }
  const rows = Array.from(byType.entries())
    .map(([type, deltas]) => ({
      type,
      n: deltas.length,
      avgChange: round1(deltas.reduce((a, b) => a + b, 0) / deltas.length),
      improvedPct: round1((deltas.filter((d) => d > 0).length / deltas.length) * 100),
    }))
    .sort((a, b) => b.avgChange - a.avgChange);
  return { rows, pending, total: items.length };
}
