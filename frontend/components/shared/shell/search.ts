/**
 * Turns what someone typed into a safe PostgREST filter for "find a student". Characters that have meaning in a
 * PostgREST `or=(...)` expression or a LIKE pattern are removed, so typing them cannot change the query.
 */
export function studentFilter(raw: string): string | null {
  const q = raw.replace(/[,()%_*\\:."']/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);
  if (q.length < 2) return null;
  if (/^\d+$/.test(q)) return `student_id.like.${q}*`;
  return `name.ilike.*${q}*`;
}
