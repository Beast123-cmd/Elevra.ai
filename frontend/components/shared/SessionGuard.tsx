"use client";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { clearQueryCache, setCacheOwner } from "./queryCache";
import { isExplicitSignOutPending } from "./session";

/** Dispatched by lib/api.ts when the API answers 401, i.e. the access token was rejected. */
export const UNAUTHORIZED_EVENT = "elevra:unauthorized";

function leaveToLogin() {
  clearQueryCache();
  if (!window.location.pathname.startsWith("/login")) window.location.assign("/login");
}

/**
 * Mounted once in the root layout. It
 *  - sends the user to /login as soon as the session ends (signed out here or in another tab, or the refresh
 *    token was rejected), instead of leaving them on a protected page that can no longer load anything;
 *  - re-checks the session when the API reports 401;
 *  - keeps the in-memory data cache tied to the signed-in user;
 *  - removes Next.js's internal `_rsc` parameter from the address bar if a failed background fetch made the
 *    browser fall back to a full page load.
 */
export function SessionGuard() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("_rsc")) {
      url.searchParams.delete("_rsc");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }

    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setCacheOwner(session?.user.id ?? null);
      if (event === "SIGNED_OUT" && !isExplicitSignOutPending()) leaveToLogin();
    });

    async function onUnauthorized() {
      const { data: auth, error } = await supabase.auth.getUser();
      if (!auth.user && !error?.message?.toLowerCase().includes("fetch")) leaveToLogin();
    }
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    };
  }, []);

  return null;
}
