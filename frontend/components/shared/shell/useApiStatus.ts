"use client";
import { useEffect, useState } from "react";
import { apiReachable } from "@/components/shared/apiErrors";

/**
 * Whether the Elevra API (account tools, AI features, simulator) is reachable. Checked once on load and re-checked
 * every 20 seconds while it is down, so the banner clears by itself when the server comes back. Dashboards read the
 * database directly and are unaffected either way.
 */
export function useApiStatus(): "checking" | "up" | "down" {
  const [state, setState] = useState<"checking" | "up" | "down">("checking");
  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = async () => {
      const ok = await apiReachable(process.env.NEXT_PUBLIC_API_URL);
      if (!live) return;
      setState(ok ? "up" : "down");
      if (!ok) timer = setTimeout(check, 20_000);
    };
    check();
    return () => { live = false; if (timer) clearTimeout(timer); };
  }, []);
  return state;
}
