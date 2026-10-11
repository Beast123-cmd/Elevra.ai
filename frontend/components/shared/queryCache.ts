/**
 * A small in-memory cache so moving between pages does not re-download the same data every time.
 * Entries newer than FRESH_MS are used as they are; older ones are still shown at once but refetched in the
 * background; anything older than MAX_AGE_MS is ignored. It lives only in the open tab and is emptied on sign-out
 * or when a different user signs in, so it can never show one person's data to another.
 */
export const FRESH_MS = 30_000;
export const MAX_AGE_MS = 5 * 60_000;

interface Entry { value: unknown; at: number }

const store = new Map<string, Entry>();
let owner: string | null = null;

export function readCache<T>(key: string, now: number = Date.now()): { value: T; fresh: boolean } | null {
  const hit = store.get(key);
  if (!hit) return null;
  const age = now - hit.at;
  if (age > MAX_AGE_MS) {
    store.delete(key);
    return null;
  }
  return { value: hit.value as T, fresh: age <= FRESH_MS };
}

export function writeCache(key: string, value: unknown, now: number = Date.now()): void {
  store.set(key, { value, at: now });
}

export function clearQueryCache(): void {
  store.clear();
}

/** Call with the signed-in user's id (or null when signed out). Changing it empties the cache. */
export function setCacheOwner(userId: string | null): void {
  if (userId !== owner) store.clear();
  owner = userId;
}

/** Forget cached entries whose key starts with `prefix`, e.g. after a write that makes them out of date. */
export function invalidateCache(prefix: string): void {
  for (const key of Array.from(store.keys())) if (key.startsWith(prefix)) store.delete(key);
}
