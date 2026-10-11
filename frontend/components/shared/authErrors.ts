/**
 * Supabase returns an error object (it does not throw) when the auth server cannot be reached. That means
 * "we could not check", which is different from "this person is signed out" and must not log anyone out.
 */
export function isTransientAuthError(e: { name?: string; message?: string; status?: number } | null | undefined): boolean {
  if (!e) return false;
  if (e.name === "AuthRetryableFetchError") return true;
  if (e.status === 0 || (e.status ?? 0) >= 500) return true;
  return /fetch failed|timeout|timed out|ECONN|ENOTFOUND|EAI_AGAIN|network/i.test(e.message ?? "");
}
