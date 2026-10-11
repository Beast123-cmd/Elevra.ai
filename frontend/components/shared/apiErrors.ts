/**
 * Turns a failed API call into something a person can act on. A browser reports "the server is not reachable"
 * (API not started, wrong address, network down) as a TypeError, which is very different from the server answering
 * with a reason; blaming the form for it, or saying nothing, sends people looking in the wrong place.
 */
const NETWORK = /failed to fetch|networkerror|load failed|fetch failed|network request failed|err_connection/i;

export function isNetworkError(e: unknown): boolean {
  return e instanceof TypeError || (e instanceof Error && NETWORK.test(e.message));
}

/** The reason the server gave, when it gave one: api() formats errors as "API /path failed: 409 - reason". */
export function serverReason(e: unknown): string {
  if (!(e instanceof Error)) return "";
  const at = e.message.indexOf(" - ");
  return at === -1 ? "" : e.message.slice(at + 3).trim();
}

export function describeApiError(e: unknown, action: string): string {
  if (isNetworkError(e)) return `${action} needs the Elevra server, which is not reachable right now. Check that the API is running, then try again.`;
  const why = serverReason(e);
  if (why) return `${action} failed: ${why}`;
  if (e instanceof Error && /\b(401|403)\b/.test(e.message)) return `${action} was refused. Sign in again, or ask an administrator for access.`;
  return `${action} failed. Please try again.`;
}

/** The same check for a deliberate health probe: true when the server answered at all. */
export async function apiReachable(base: string | undefined, timeoutMs = 4000): Promise<boolean> {
  if (!base) return false;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${base}/health`, { signal: ctrl.signal, cache: "no-store" });
    return r.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
