"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { readCache, writeCache } from "./queryCache";

interface State<T> { data: T | null; error: string | null; loading: boolean; refreshing: boolean }

/**
 * Stale-while-revalidate for a page's main data. Coming back to a page shows what was loaded a moment ago at once
 * and quietly refreshes it if it is getting old; the first visit shows the loading state as before.
 */
export function useCachedQuery<T>(key: string, fetcher: () => Promise<T>) {
  const [state, setState] = useState<State<T>>(() => {
    const hit = readCache<T>(key);
    return hit ? { data: hit.value, error: null, loading: false, refreshing: !hit.fresh } : { data: null, error: null, loading: true, refreshing: false };
  });
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(
    async (isCancelled: () => boolean) => {
      try {
        const value = await fetcherRef.current();
        writeCache(key, value);
        if (!isCancelled()) setState({ data: value, error: null, loading: false, refreshing: false });
      } catch (e) {
        if (isCancelled()) return;
        const message = e instanceof Error ? e.message : "Unknown error";
        // keep showing the last good data if a background refresh fails
        setState((s) => ({ data: s.data, error: s.data ? null : message, loading: false, refreshing: false }));
      }
    },
    [key],
  );

  useEffect(() => {
    let cancelled = false;
    const hit = readCache<T>(key);
    if (hit) {
      setState({ data: hit.value, error: null, loading: false, refreshing: !hit.fresh });
      if (hit.fresh) return;
    } else {
      setState({ data: null, error: null, loading: true, refreshing: false });
    }
    run(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [key, run]);

  const reload = useCallback(() => {
    setState((s) => ({ ...s, refreshing: true }));
    return run(() => false);
  }, [run]);

  return { ...state, reload };
}
