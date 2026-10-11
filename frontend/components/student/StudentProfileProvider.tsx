"use client";

import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { MOCK_PROFILE } from "./mock-profile";
import type { ProfileState } from "./useStudentProfile";

export const StudentProfileContext = createContext<{ state: ProfileState; mock: boolean; load: () => void } | null>(null);

async function loadProfile(): Promise<Profile | null> {
  const sb = createClient();
  // The middleware already verifies the session. Reading its local claims avoids
  // a second Auth network round trip before the profile query can start.
  const { data: { session }, error: sessionError } = await sb.auth.getSession();
  if (sessionError) throw new Error(sessionError.message);
  const studentId = session?.user.app_metadata?.student_id as string | undefined;
  if (!studentId) throw new Error("This account isn't linked to a student record");

  const { data, error } = await sb.from("scores").select("profile").eq("student_id", studentId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.profile as Profile | undefined) ?? null;
}

export function StudentProfileProvider({ children }: { children: ReactNode }) {
  const mock = useSearchParams().get("mock") === "1";
  const [state, setState] = useState<ProfileState>(() => mock ? { status: "ready", profile: MOCK_PROFILE } : { status: "loading" });
  const inFlight = useRef(false);
  const generation = useRef(0);

  useEffect(() => {
    generation.current += 1;
    inFlight.current = false;
    if (mock) {
      setState({ status: "ready", profile: MOCK_PROFILE });
    } else {
      setState({ status: "loading" });
    }
  }, [mock]);

  const load = useCallback(() => {
    if (mock || inFlight.current) return;
    const requestGeneration = generation.current;
    inFlight.current = true;
    setState({ status: "loading" });
    loadProfile()
      .then((profile) => requestGeneration === generation.current && setState(profile ? { status: "ready", profile } : { status: "empty" }))
      .catch((error: Error) => requestGeneration === generation.current && setState({ status: "error", message: error.message }))
      .finally(() => {
        if (requestGeneration === generation.current) inFlight.current = false;
      });
  }, [mock]);

  const value = useMemo(() => ({ state, mock, load }), [state, mock, load]);
  return <StudentProfileContext.Provider value={value}>{children}</StudentProfileContext.Provider>;
}
